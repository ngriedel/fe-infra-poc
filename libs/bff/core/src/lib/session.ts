import type { SessionUser } from '@aic/bff/contracts';

/**
 * Augment Fastify's secure-session to be strongly typed with our SessionUser.
 *
 * Consumers (each BFF) import this type and use `req.session.get('user')`
 * with full type inference.
 */
declare module '@fastify/secure-session' {
  interface SessionData {
    user: SessionUser;
  }
}

export type {};
