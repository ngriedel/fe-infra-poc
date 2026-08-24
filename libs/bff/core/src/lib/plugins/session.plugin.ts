import fp from 'fastify-plugin';
import fastifyCookie from '@fastify/cookie';
import fastifySession from '@fastify/session';
import { Redis } from 'ioredis';
import { RedisSessionStore } from './redis-store';
import '../session';

export interface SessionPluginOptions {
  /**
   * Signing secret (>= 32 chars). Signs the session-id cookie AND, via
   * `@fastify/cookie`, the SSO `oidc_state` cookie (`signed: true`).
   */
  secret: string;
  /** Session cookie name — namespaced per audience (e.g. `sid.agent`). */
  cookieName: string;
  /** True in production (HTTPS-only cookie). */
  secure: boolean;
  /** Redis connection URL (ioredis). */
  redisUrl: string;
  /** Session lifetime in seconds (cookie maxAge + Redis TTL). */
  ttlSeconds: number;
}

/**
 * Server-side session backed by Redis:
 *   - opaque signed session-id cookie (per-audience name)
 *   - `{ user, cookie, … }` stored in Redis with a TTL → shared across BFF
 *     instances and revocable/expirable server-side
 *   - `@fastify/cookie` registered WITH a secret so the `oidc_state` CSRF
 *     cookie stays signed.
 */
export const sessionPlugin = fp(async (app, opts: SessionPluginOptions) => {
  await app.register(fastifyCookie, { secret: opts.secret });

  const redis = new Redis(opts.redisUrl);
  // Shared connection: the session store owns its lifecycle, but features like
  // the OTP challenge store and rate limiter reuse it rather than each opening
  // their own socket to the same server.
  app.decorate('redis', redis);
  app.addHook('onClose', async () => {
    await redis.quit();
  });

  await app.register(fastifySession, {
    secret: opts.secret,
    cookieName: opts.cookieName,
    store: new RedisSessionStore(redis, opts.ttlSeconds),
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: opts.secure,
      path: '/',
      maxAge: opts.ttlSeconds * 1000, // @fastify/session cookie maxAge is in ms
    },
  });
});

declare module 'fastify' {
  interface FastifyInstance {
    /** Shared ioredis connection, registered by `sessionPlugin`. */
    redis: Redis;
  }
}
