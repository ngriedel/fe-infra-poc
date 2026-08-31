# Who owns a contract?

Why the policy schema is **not** shared, what the BFF does to the upstream record,
and how Nx makes the boundary a build failure rather than a code-review note.

---

## 1. The problem

The upstream ESL returns a fat record — 24 fields today, and real enterprise systems
carry far more. No single frontend needs all of it:

| Audience | Fields it actually uses     | Count |
| -------- | --------------------------- | ----- |
| agent    | `fieldA`–`fieldE`           | 9     |
| dealer   | `fieldF`–`fieldJ`           | 9     |
| broker   | `fieldA`, `fieldK`–`fieldO` | 10    |
| _nobody_ | `fieldP`–`fieldT`           | —     |

(Each also gets `id`, `product`, `status`, `monthlyPremium`.)

Two things to notice. `fieldA` is used by **both** agent and broker — overlap is normal.
And `fieldP`–`fieldT` are used by **no one**, so they must never leave a BFF.

## 2. Two kinds of contract, often confused

**Upstream (ESL → BFF).** One system, one schema, genuinely shared. It's generated from
the ESL's OpenAPI document into `libs/bff/esl-client`, and Zodios validates every response
against it — so upstream contract drift fails at our boundary instead of leaking malformed
data downstream. Sharing this is correct.

**Downstream (BFF → its own frontend).** Owned by exactly one (BFF, frontend) pair. This
is the one that must **not** be shared. A single `policySchema` imported by all four
frontends quietly rebuilds the one-generic-API problem that the BFF pattern exists to
solve: adding a field for the agent app changes the dealer app's types, and removing one
for dealers breaks brokers. The apps stop being independent.

So `policy.ts` moved **out** of `@aic-shared/contracts` and into three per-audience libs.

What stays in `@aic-shared/contracts` is only what is genuinely cross-cutting — the session
user shape, the error envelope, health. Every pair really does share those.

```
libs/bff/contracts       scope:shared   auth, errors, health   ← everyone
libs/agent/contracts     scope:agent    agent policy view      ← agent + agent-bff only
libs/dealer/contracts    scope:dealer   dealer policy view     ← dealer + dealer-bff only
libs/broker/contracts    scope:broker   broker policy view     ← broker + broker-bff only
```

## 3. The projection

Each BFF maps the upstream record to its own view in a small named function
(`toDealerPolicy` and friends), written **field by field**:

```ts
function toDealerPolicy(p: EslPolicy): DealerPolicy {
  return {
    id: p.id,
    product: p.product,
    status: p.status,
    monthlyPremium: p.monthlyPremium,
    fieldF: p.fieldF,
    // …
  };
}
```

**Why not a spread or a `pick()` helper?** Because `{ ...p }` means the day someone adds a
column upstream, it silently starts flowing to the browser. That is how PII leaks. Listing
the fields makes every addition a deliberate, reviewable edit — the tedium is the feature.

There is a second line of defence. The route declares its response schema:

```ts
schema: { response: { 200: dealerPoliciesResponseSchema } }
```

`fastify-type-provider-zod` serializes through that schema, and zod objects drop unknown
keys. So even a mapper that leaked would be caught on the way out. This is verified rather
than assumed — `apps/dealer-bff/src/routes/policies.spec.ts` wires up a deliberately leaky
handler that returns all 24 fields and asserts only the 9 dealer fields survive.

## 4. How the boundary is enforced

Every project carries Nx tags. The libraries are tagged by **scope** (which audience owns
them) and **type** (what layer they are):

```jsonc
// libs/dealer/contracts/project.json
"tags": ["scope:dealer", "type:contracts"]
```

`eslint.config.mjs` turns those tags into rules:

```js
{ sourceTag: 'scope:dealer', onlyDependOnLibsWithTags: ['scope:dealer', 'scope:shared'] }
```

Read plainly: **anything tagged `scope:dealer` may only import from `scope:dealer` or
`scope:shared`.** The dealer app and dealer-bff are both `scope:dealer`, so they can reach
the dealer contract and the shared one — and nothing else.

This is a lint **error**, not a warning, and `lint` is part of the gate. So an import that
crosses audiences fails the build:

```
apps/dealer/src/app/home/home-page.component.ts
  7:1  error  A project tagged with "scope:dealer" can only depend on libs tagged
              with "scope:dealer", "scope:shared"   @nx/enforce-module-boundaries
```

That message is from an actual run: the rule was tested by having the dealer app import
`@aic-agent/contracts` and confirming lint rejected it. It also caught a genuine mistake
while this was being built — the first draft of the dealer projection test imported the
agent and broker schemas to compare shapes, and was refused.

The point is that "don't share contracts across audiences" stops being a convention someone
has to remember in review. A newcomer who reaches for the wrong import finds out in seconds,
from the compiler rather than from a person.

`type:` tags layer on the same way — `type:contracts` may depend on nothing, `type:app` only
on `ui`/`auth`/`contracts`, and so on — which is why the ESL route couldn't simply be hoisted
into `esl-client` (`type:data-access` may only reach `type:contracts`).

## 5. Cost, honestly

Three small libraries instead of one file, and three near-identical mapper functions. That
duplication is deliberate: these views are _expected_ to diverge, and a shared base schema
with per-audience `.pick()` would re-couple exactly what we just separated — a change to the
base would ripple into all three frontends.

If a fourth audience ever needs an identical view to an existing one, share it then, on
purpose, rather than assuming it up front.
