import { requireSession, unauthenticated, type BffServer } from '@aic/bff/core';
import { policiesResponseSchema } from '@aic/bff/contracts';
import { createEslClient } from '@aic/bff/esl-client';

/**
 * Broker-facing policies, sourced from the upstream ESL. Mirrors agent-bff's
 * route: `requireSession` rejects anything without a valid *broker* session,
 * the session user's identity is forwarded as plain `X-User-*` headers, the
 * generated Zodios client validates the upstream response against its OpenAPI
 * contract, and fastify-type-provider-zod validates our own FE contract on the
 * way out.
 */
export async function registerPolicyRoutes(
  app: BffServer,
  opts: { eslBaseUrl: string },
): Promise<void> {
  const esl = createEslClient(opts.eslBaseUrl);

  app.get('/api/policies', {
    preHandler: requireSession,
    schema: { response: { 200: policiesResponseSchema } },
    handler: async (req) => {
      const user = req.user;
      if (!user) throw unauthenticated();
      const policies = await esl.getPolicies({
        userId: user.id,
        email: user.email,
        roles: user.roles,
      });
      return { policies };
    },
  });
}
