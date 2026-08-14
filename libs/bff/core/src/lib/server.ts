import Fastify, { type FastifyServerOptions } from 'fastify';
import {
  type ZodTypeProvider,
  serializerCompiler,
  validatorCompiler,
} from 'fastify-type-provider-zod';
import type { SessionUser } from '@aic/bff/contracts';
import { securityPlugin } from './plugins/security.plugin';
import { secureSessionPlugin } from './plugins/secure-session.plugin';
import { errorHandlerPlugin } from './plugins/error-handler.plugin';

export interface CreateBffServerOptions {
  nodeEnv: 'development' | 'test' | 'production';
  sessionSecret: string;
  frontendOrigin: string;
  logPretty: boolean;
  /**
   * Which audience this BFF serves. Namespaces the session cookie AND is
   * enforced by `requireSession`, so one BFF can never accept a session
   * minted by another (cross-audience confusion / privilege escalation).
   */
  audience: SessionUser['audience'];
}

/**
 * Build a Fastify instance with the AIC BFF baseline:
 *   - Pino logger (pretty in dev)
 *   - Zod request/response validation + serialization
 *   - Helmet + CORS locked to the matching frontend origin
 *   - Secure cookie session (cookie namespaced per audience)
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
  await app.register(secureSessionPlugin, {
    secret: opts.sessionSecret,
    secure: opts.nodeEnv === 'production',
    // Namespace the cookie per audience so a foreign BFF's session cookie is
    // never even read by this one (belt to the audience-check's braces).
    cookieName: `sid.${opts.audience}`,
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
