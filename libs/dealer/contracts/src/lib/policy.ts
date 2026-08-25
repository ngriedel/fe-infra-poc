import { z } from 'zod';

/**
 * The DEALER view of a policy — the contract between `dealer-bff` and the
 * `dealer` frontend, and nobody else.
 *
 * See the note in the agent contract: a BFF→FE contract belongs to one pair.
 * The Nx tag `scope:dealer` means the agent and broker apps cannot import this
 * even by accident — the lint rule rejects it.
 *
 * Dealers need F–J of the upstream record. Note the deliberate NON-overlap with
 * the agent slice: the same upstream row projects to a different shape per
 * audience, which is the whole point.
 */
export const dealerPolicySchema = z.object({
  id: z.string(),
  product: z.string(),
  status: z.string(),
  monthlyPremium: z.number().int(),
  // Dealer-specific slice of the upstream record.
  fieldF: z.string(),
  fieldG: z.number().int(),
  fieldH: z.boolean(),
  fieldI: z.string(),
  fieldJ: z.number().int(),
});
export type DealerPolicy = z.infer<typeof dealerPolicySchema>;

export const dealerPoliciesResponseSchema = z.object({
  policies: z.array(dealerPolicySchema),
});
export type DealerPoliciesResponse = z.infer<typeof dealerPoliciesResponseSchema>;
