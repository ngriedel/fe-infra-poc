import { z } from 'zod';

/**
 * The BFF's own policy contract exposed to the frontend. Shaped from the
 * upstream ESL response (which is validated separately against its generated
 * OpenAPI→Zod contract in `@aic/bff/esl-client`). Kept here so the agent FE and
 * agent-bff share one source of truth.
 */
export const policySchema = z.object({
  id: z.string(),
  product: z.string(),
  status: z.string(),
  monthlyPremium: z.number().int(),
});
export type Policy = z.infer<typeof policySchema>;

export const policiesResponseSchema = z.object({
  policies: z.array(policySchema),
});
export type PoliciesResponse = z.infer<typeof policiesResponseSchema>;
