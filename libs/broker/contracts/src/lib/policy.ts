import { z } from 'zod';

/**
 * The BROKER view of a policy — the contract between `broker-bff` and the
 * `broker` frontend, and nobody else.
 *
 * See the note in the agent contract: a BFF→FE contract belongs to one pair.
 *
 * Brokers need K–O, PLUS `fieldA`, which the agent view also exposes. That
 * overlap is deliberate: two audiences wanting the same upstream field is normal
 * and costs nothing. What matters is that each declares its own needs, so
 * dropping `fieldA` from the agent view later cannot silently break brokers.
 */
export const brokerPolicySchema = z.object({
  id: z.string(),
  product: z.string(),
  status: z.string(),
  monthlyPremium: z.number().int(),
  // Broker-specific slice, plus one field the agent view happens to share.
  fieldA: z.string(),
  fieldK: z.string(),
  fieldL: z.boolean(),
  fieldM: z.number().int(),
  fieldN: z.string(),
  fieldO: z.number().int(),
});
export type BrokerPolicy = z.infer<typeof brokerPolicySchema>;

export const brokerPoliciesResponseSchema = z.object({
  policies: z.array(brokerPolicySchema),
});
export type BrokerPoliciesResponse = z.infer<typeof brokerPoliciesResponseSchema>;
