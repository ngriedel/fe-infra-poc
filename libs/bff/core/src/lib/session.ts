import type { SessionUser } from '@aic/bff/contracts';

/**
 * Strongly type the server-side session (`@fastify/session`) with our
 * `SessionUser`. Consumers use `req.session.get('user')` /
 * `req.session.set('user', …)` with full type inference.
 */
declare module 'fastify' {
  interface Session {
    user?: SessionUser;
  }
}

export type {};
