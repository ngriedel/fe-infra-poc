import type { FastifyRequest, FastifyReply } from 'fastify';
import type { SessionUser } from '@aic/bff/contracts';
import { unauthenticated } from '../errors';

/**
 * preHandler that 401s if there's no session user, otherwise stashes the
 * user on the request for downstream handlers via `req.user`.
 */
export async function requireSession(req: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const user = req.session.get('user') as SessionUser | undefined;
  // Reject a missing session, and — critically — a session minted for a
  // different BFF/audience: a foreign cookie must never be honoured as this
  // BFF's user (cross-audience privilege escalation).
  if (!user || user.audience !== req.server.expectedAudience) throw unauthenticated();
  req.user = user;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: SessionUser;
  }
}
