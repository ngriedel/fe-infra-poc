import type { FastifyRequest, FastifyReply } from 'fastify';
import type { SessionUser } from '@aic/bff/contracts';
import { unauthenticated } from '../errors';

/**
 * preHandler that 401s if there's no session user, otherwise stashes the
 * user on the request for downstream handlers via `req.user`.
 */
export async function requireSession(req: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const user = req.session.get('user') as SessionUser | undefined;
  if (!user) throw unauthenticated();
  req.user = user;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: SessionUser;
  }
}
