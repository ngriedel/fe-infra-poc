import { requireSession, unauthenticated, type BffServer } from '@aic/bff/core';
import { agentPoliciesResponseSchema, type AgentPolicy } from '@aic/agent/contracts';
import { createEslClient, type Policy as EslPolicy } from '@aic/bff/esl-client';

/**
 * Project the fat upstream ESL record down to the AGENT view.
 *
 * Written out field by field on purpose. A spread (`{ ...p, ... }`) or a
 * `pick()` helper would mean that the day someone adds a column upstream, it
 * silently starts flowing to the browser — which is how PII leaks. Listing the
 * fields makes every addition a deliberate, reviewable edit.
 *
 * Upstream currently carries 24 fields; agents see 9.
 */
function toAgentPolicy(p: EslPolicy): AgentPolicy {
  return {
    id: p.id,
    product: p.product,
    status: p.status,
    monthlyPremium: p.monthlyPremium,
    fieldA: p.fieldA,
    fieldB: p.fieldB,
    fieldC: p.fieldC,
    fieldD: p.fieldD,
    fieldE: p.fieldE,
  };
}

/**
 * Agent-facing policies, sourced from the upstream ESL. The session user's
 * identity is forwarded as plain `X-User-*` headers; the generated Zodios
 * client validates the upstream response against its OpenAPI contract, we
 * project it to the agent view, and fastify-type-provider-zod then validates
 * our own FE contract on the way out — which also strips anything the projection
 * shouldn't have included.
 */
export async function registerPolicyRoutes(
  app: BffServer,
  opts: { eslBaseUrl: string },
): Promise<void> {
  const esl = createEslClient(opts.eslBaseUrl);

  app.get('/api/policies', {
    preHandler: requireSession,
    schema: { response: { 200: agentPoliciesResponseSchema } },
    handler: async (req) => {
      const user = req.user;
      if (!user) throw unauthenticated();
      const policies = await esl.getPolicies({
        userId: user.id,
        email: user.email,
        roles: user.roles,
      });
      return { policies: policies.map(toAgentPolicy) };
    },
  });
}
