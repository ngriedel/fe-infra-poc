import { sessionResponseSchema } from '@aic-shared/contracts';
import type { BffServer } from '../server';
import { requireSession } from '../guards/require-session';

/**
 * The session endpoints every BFF exposes, regardless of how the user
 * authenticated (magic-link, SSO, …):
 *   - GET  /api/auth/session — current user, or 401
 *   - POST /api/auth/logout  — clear the session cookie
 *
 * Auth-method libs (e.g. `@aic-shared/bff-auth-sso`) own only the login flow;
 * the read + teardown of a session is shared here.
 */
export async function registerSessionRoutes(app: BffServer): Promise<void> {
  app.get('/api/auth/session', {
    preHandler: requireSession,
    schema: { response: { 200: sessionResponseSchema } },
    handler: async (req) => ({ user: req.user ?? null }),
  });

  app.post('/api/auth/logout', {
    schema: { response: { 200: sessionResponseSchema } },
    handler: async (req) => {
      await req.session.destroy();
      return { user: null };
    },
  });
}
