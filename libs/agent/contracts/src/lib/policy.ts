import * as z from 'zod';

/**
 * The AGENT view of a policy — the contract between `agent-bff` and the `agent`
 * frontend, and nobody else.
 *
 * This is deliberately NOT shared with dealer/broker. A BFF→FE contract is owned
 * by exactly one (BFF, frontend) pair; sharing one policy shape across all four
 * audiences would recreate the single generic API that the BFF pattern exists to
 * avoid, and would let a change made for the agent app break the dealer app.
 * The Nx tag `scope:agent` makes that ownership enforceable rather than a
 * convention — see `eslint.config.mjs`.
 *
 * The upstream ESL record carries 20 filler fields on top of the four meaningful
 * ones. Agents need A–E; everything else never leaves `agent-bff`.
 */
export const agentPolicySchema = z.object({
  id: z.string(),
  product: z.string(),
  status: z.string(),
  monthlyPremium: z.number().int(),
  // Agent-specific slice of the upstream record.
  fieldA: z.string(),
  fieldB: z.string(),
  fieldC: z.number().int(),
  fieldD: z.number().int(),
  fieldE: z.boolean(),
});
export type AgentPolicy = z.infer<typeof agentPolicySchema>;

export const agentPoliciesResponseSchema = z.object({
  policies: z.array(agentPolicySchema),
});
export type AgentPoliciesResponse = z.infer<typeof agentPoliciesResponseSchema>;
