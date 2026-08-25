import { requireSession, unauthenticated, type BffServer } from '@aic/bff/core';
import { brokerPoliciesResponseSchema, type BrokerPolicy } from '@aic/broker/contracts';
import { createEslClient, type Policy as EslPolicy } from '@aic/bff/esl-client';

/**
 * Project the fat upstream ESL record down to the BROKER view.
 *
 * Field by field on purpose — see the note in agent-bff's copy. Brokers take
 * K–O plus `fieldA`, which the agent view also exposes: overlap between
 * audiences is normal and costs nothing, because each declares its own needs
 * rather than sharing one schema.
 *
 * Upstream currently carries 24 fields; brokers see 10.
 */
function toBrokerPolicy(p: EslPolicy): BrokerPolicy {
  return {
    id: p.id,
    product: p.product,
    status: p.status,
    monthlyPremium: p.monthlyPremium,
    fieldA: p.fieldA,
    fieldK: p.fieldK,
    fieldL: p.fieldL,
    fieldM: p.fieldM,
    fieldN: p.fieldN,
    fieldO: p.fieldO,
  };
}

/**
 * Broker-facing policies. `requireSession` rejects anything without a valid
 * *broker* session, identity is forwarded as `X-User-*` headers, the generated
 * Zodios client validates the upstream response against its OpenAPI contract,
 * we project to the broker view, and fastify-type-provider-zod validates our own
 * FE contract on the way out.
 */
export async function registerPolicyRoutes(
  app: BffServer,
  opts: { eslBaseUrl: string },
): Promise<void> {
  const esl = createEslClient(opts.eslBaseUrl);

  app.get('/api/policies', {
    preHandler: requireSession,
    schema: { response: { 200: brokerPoliciesResponseSchema } },
    handler: async (req) => {
      const user = req.user;
      if (!user) throw unauthenticated();
      const policies = await esl.getPolicies({
        userId: user.id,
        email: user.email,
        roles: user.roles,
      });
      return { policies: policies.map(toBrokerPolicy) };
    },
  });
}
