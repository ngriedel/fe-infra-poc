import Fastify, { type FastifyServerOptions } from 'fastify';
import fastifyRateLimit from '@fastify/rate-limit';
import {
  type ZodTypeProvider,
  serializerCompiler,
  validatorCompiler,
} from 'fastify-type-provider-zod';
import type { SessionUser } from '@aic-shared/contracts';
import { securityPlugin } from './plugins/security.plugin';
import { sessionPlugin } from './plugins/session.plugin';
import { errorHandlerPlugin } from './plugins/error-handler.plugin';

/** Session lifetime: cookie maxAge + Redis TTL. */
const SESSION_TTL_SECONDS = 60 * 60 * 8; // 8 hours

/**
 * Global request ceiling per IP. Deliberately loose — it's a backstop against
 * runaway clients, not the real defence. Sensitive routes (OTP request/verify)
 * set their own much tighter `config.rateLimit`.
 */
const GLOBAL_RATE_LIMIT_MAX = 300;
const GLOBAL_RATE_LIMIT_WINDOW = '1 minute';

/**
 * Max request body. These BFFs take an email and a 6-digit code — Fastify's 1MB
 * default lets a caller make us buffer a megabyte before validation rejects it.
 */
const BODY_LIMIT_BYTES = 64 * 1024;

export interface CreateBffServerOptions {
  nodeEnv: 'development' | 'test' | 'production';
  sessionSecret: string;
  frontendOrigin: string;
  logPretty: boolean;
  /** Redis connection URL for the server-side session store. */
  redisUrl: string;
  /**
   * Which audience this BFF serves. Namespaces the session cookie AND is
   * enforced by `requireSession`, so one BFF can never accept a session
   * minted by another (cross-audience confusion / privilege escalation).
   */
  audience: SessionUser['audience'];
  /**
   * Whether to trust `X-Forwarded-*` when deriving `req.ip` (from `TRUST_PROXY`).
   * Governs rate-limit bucketing — see the env docs. Defaults to off.
   */
  trustProxy?: boolean | number | string;
}

/**
 * Build a Fastify instance with the AIC BFF baseline:
 *   - Pino logger (pretty in dev)
 *   - Zod request/response validation + serialization
 *   - Helmet + CORS locked to the matching frontend origin
 *   - Redis-backed server-side session (cookie namespaced per audience)
 *   - Redis-backed rate limiting (loose global cap; routes tighten it)
 *   - Centralised error → JSON-envelope mapping
 *
 * Caller adds routes + per-app plugins.
 */
export async function createBffServer(opts: CreateBffServerOptions) {
  const fastifyOpts: FastifyServerOptions = {
    logger: opts.logPretty
      ? {
          level: 'info',
          transport: { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss.l' } },
        }
      : { level: 'info' },
    trustProxy: opts.trustProxy ?? false,
    bodyLimit: BODY_LIMIT_BYTES,
  };

  const app = Fastify(fastifyOpts).withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // Expose this BFF's own audience so `requireSession` can reject a session
  // that was minted by a different BFF.
  app.decorate('expectedAudience', opts.audience);

  await app.register(securityPlugin, {
    corsOrigin: opts.frontendOrigin,
    nodeEnv: opts.nodeEnv,
  });
  await app.register(sessionPlugin, {
    secret: opts.sessionSecret,
    secure: opts.nodeEnv === 'production',
    // Namespace the cookie per audience so a foreign BFF's session cookie is
    // never even read by this one (belt to the audience-check's braces).
    cookieName: `sid.${opts.audience}`,
    redisUrl: opts.redisUrl,
    ttlSeconds: SESSION_TTL_SECONDS,
  });
  // After sessionPlugin — reuses the Redis connection it decorates, so limits
  // are shared across BFF instances instead of being per-process.
  await app.register(fastifyRateLimit, {
    global: true,
    max: GLOBAL_RATE_LIMIT_MAX,
    timeWindow: GLOBAL_RATE_LIMIT_WINDOW,
    redis: app.redis,
    // Keep this BFF's counters separate from the other audiences sharing Redis.
    nameSpace: `rl:${opts.audience}:`,
  });
  await app.register(errorHandlerPlugin);

  return app;
}

export type BffServer = Awaited<ReturnType<typeof createBffServer>>;

declare module 'fastify' {
  interface FastifyInstance {
    /** The audience this BFF serves; set by `createBffServer`. */
    expectedAudience: SessionUser['audience'];
  }
}
