import { requireSession, unauthenticated, type BffServer } from '@aic/bff/core';
import { dealerPoliciesResponseSchema, type DealerPolicy } from '@aic/dealer/contracts';
import { createEslClient, type Policy as EslPolicy } from '@aic/bff/esl-client';

/**
 * Project the fat upstream ESL record down to the DEALER view.
 *
 * Field by field on purpose — see the note in agent-bff's copy. Dealers get a
 * different slice (F–J) from agents (A–E) off the very same upstream row, which
 * is the point of a BFF: one enterprise record, several tailored views.
 *
 * Upstream currently carries 24 fields; dealers see 9.
 */
function toDealerPolicy(p: EslPolicy): DealerPolicy {
  return {
    id: p.id,
    product: p.product,
    status: p.status,
    monthlyPremium: p.monthlyPremium,
    fieldF: p.fieldF,
    fieldG: p.fieldG,
    fieldH: p.fieldH,
    fieldI: p.fieldI,
    fieldJ: p.fieldJ,
  };
}

/**
 * Dealer-facing policies. `requireSession` rejects anything without a valid
 * *dealer* session, identity is forwarded as `X-User-*` headers, the generated
 * Zodios client validates the upstream response against its OpenAPI contract,
 * we project to the dealer view, and fastify-type-provider-zod validates our own
 * FE contract on the way out.
 */
export async function registerPolicyRoutes(
  app: BffServer,
  opts: { eslBaseUrl: string },
): Promise<void> {
  const esl = createEslClient(opts.eslBaseUrl);

  app.get('/api/policies', {
    preHandler: requireSession,
    schema: { response: { 200: dealerPoliciesResponseSchema } },
    handler: async (req) => {
      const user = req.user;
      if (!user) throw unauthenticated();
      const policies = await esl.getPolicies({
        userId: user.id,
        email: user.email,
        roles: user.roles,
      });
      return { policies: policies.map(toDealerPolicy) };
    },
  });
}
