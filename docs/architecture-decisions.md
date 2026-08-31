# Architecture decisions

A living record of the big calls behind the AIC POC, with the reasoning that goes with each. Written to be readable as a pitch, not a checklist — every decision below was chosen because the upside materially outweighs the cost, and the costs are listed honestly so we can revisit them as the POC grows.

> **Status legend:** ✅ Decided · 🔄 Revisitable post-POC · 🟡 Open

---

## Decisions at a glance

| Area             | Decision                                                              | Status |
| ---------------- | --------------------------------------------------------------------- | ------ |
| Repo layout      | Nx monorepo, pnpm workspaces                                          | ✅     |
| Frontends        | Two Angular apps (client, agent), more later                          | ✅     |
| Backend pattern  | BFF per frontend (Fastify)                                            | ✅     |
| BFF topology     | Two separate processes, not one shared                                | ✅     |
| UI library       | Spartan NG + Tailwind, Angular CDK for primitives                     | ✅     |
| Shared contracts | Zod schemas in a shared lib                                           | ✅     |
| Client auth      | Magic link + OTP (passwordless)                                       | ✅     |
| Agent auth       | Enterprise SSO via OIDC against Azure AD                              | ✅     |
| Sessions         | Stateless encrypted cookie now; server-side store for agent BFF later | 🔄     |
| Domain model     | Pure TypeScript lib, framework-free                                   | ✅     |
| State mgmt       | Signals + lightweight per-feature stores                              | 🔄     |
| Realtime         | Not in POC scope                                                      | 🟡     |

---

## Why an Nx monorepo

A single repository where multiple apps and libs live together, with a build graph that understands what depends on what.

**Pros**

- **One source of truth for shared code.** UI components, validation schemas, domain models, and HTTP clients are written once. The client and agent apps cannot drift on a `Policy` shape because they import the same type.
- **Atomic cross-cutting changes.** A change to a shared DTO touches the schema, both BFFs, and both frontends in one PR. No coordinated multi-repo dance, no "BFF deployed before frontend" race.
- **Affected-only CI.** Nx only rebuilds/retests projects whose inputs changed. As we add more apps, CI time grows sub-linearly, not linearly.
- **Consistent tooling.** One ESLint config, one Prettier config, one TypeScript baseline, one test runner per language tier. Onboarding new devs is "clone and go", not "configure six repos".
- **Code generators.** `nx g` creates a new app, lib, or component pre-wired to our conventions — no copy-paste drift over time.

**Cons (and how we handle them)**

- Larger working tree to clone — negligible at our size.
- Single CI pipeline to design carefully — Nx's affected commands handle this; we'll tune as the repo grows.
- Tempts teams to over-share code — we mitigate with explicit lib boundaries (`shared/*`, `bff/*`, `domain/*`) and Nx's module-boundary lint rule.

**Bottom line:** the moment we have more than one frontend talking to more than one backend with shared types, polyrepo costs you more in coordination than it saves in isolation.

---

## Why two Angular frontends instead of one app with role-based UI

A natural alternative would be a single Angular app that renders differently for clients vs agents.

**Pros of separate apps**

- **Different audiences, different products.** A consumer buying insurance has nothing in common with an agent processing claims — different layouts, density, navigation, vocabulary, performance budgets.
- **Independent release cadence.** Agent-only features ship without retesting the consumer surface.
- **Different security postures.** Agent app may need stricter CSP, internal-network-only access, MDM integration. Consumer app is public-facing. Mixing them complicates both.
- **Smaller bundles for consumers.** Consumers download only consumer code, not the agent workbench they'll never see.
- **Different auth mechanisms** (see below) — a single app with two auth flows is a security smell.
- **Independent A/B testing.** Experimenting on the consumer funnel doesn't risk destabilizing agent workflows.

**Cons**

- More projects to keep in lockstep on shared components — solved by the shared `libs/` layer.
- Two deploy pipelines — already implied by the BFF pattern.

**Bottom line:** "one app, two modes" looks cheaper at week one and gets more expensive every week after. Separate apps with shared libs is the long-term-cheap option.

---

## Why the BFF pattern at all

A Backend-for-Frontend is a thin, frontend-specific server that sits between the browser and downstream APIs. Each frontend gets its own.

**Pros**

- **Auth lives server-side.** Tokens never touch the browser. The frontend sees only a signed, HttpOnly session cookie — immune to XSS-based token theft.
- **Request aggregation.** One call from the browser fans out to several upstream calls server-side, on a fat low-latency link. Fewer mobile round-trips → faster perceived UX (see [bff-latency.md](bff-latency.md)).
- **Payload shaping.** The BFF returns exactly what the UI needs. Smaller payloads, simpler frontend code, less over-fetching.
- **Decouples frontend velocity from upstream API velocity.** When the insurance API changes, only the BFF mapping layer changes — the Angular app doesn't.
- **Single point for cross-cutting policy.** Rate limiting, audit logging, feature flags, request shaping, and observability are all enforced in one process per frontend.
- **Safer secret handling.** API keys, signing secrets, downstream credentials live in the BFF environment, not in `angular.json` or env-injected at build time.

**Cons**

- One extra hop. Real, but small and almost always dominated by the wins above. Quantified in [bff-latency.md](bff-latency.md).
- Another deployable. Mitigated by deploying alongside the frontend (same pipeline, same region).

**Bottom line:** for any app that does auth, calls more than one API, or runs on mobile networks, the BFF pattern pays for itself before the first release.

---

## Why two BFFs instead of one shared backend

We could have run one Fastify process serving both frontends with route prefixes. We chose two.

**Pros**

- **Auth strategies don't have to coexist in one process.** Magic-link cookies for clients and Azure AD OIDC sessions for agents stay completely separated — no `if (req.audience === 'agent')` branching in middleware.
- **Blast radius isolation.** A bug or DoS in the consumer-facing BFF cannot take down the agent workbench, and vice versa. They share zero runtime state.
- **Independent scaling.** Consumer traffic spikes (marketing push, renewal season) scale only the consumer BFF. Agent BFF stays steady and cheap.
- **Different deployment targets.** The agent BFF can sit behind a corporate firewall / VNet; the consumer BFF lives on the public internet. Different security boundaries, cleanly.
- **Cleaner code.** Each BFF reads top-to-bottom as one frontend's server. No conditionals reasoning about "which frontend am I serving right now".
- **Independent release cadence.** Roll out a new agent feature without redeploying the consumer surface.

**Cons**

- Two processes to run locally — Nx `run-many` handles this in dev with one command.
- Two pipelines, two sets of dashboards — solved by templating; everything common lives in `libs/bff/core`.
- Risk of code duplication — mitigated by sharing everything _non-frontend-specific_ (Fastify plugins, validators, HTTP clients) via `libs/bff/*`.

**Bottom line:** one shared backend was cheaper to start but compounds coupling forever. Two BFFs cost a marginal amount of infra and pay back in clarity and safety.

---

## Why Spartan NG + Tailwind + Angular CDK

Spartan NG is the Angular port of the shadcn pattern — unstyled, accessible primitives that you compose and theme with Tailwind. Angular CDK provides the low-level behaviours (overlay, focus management, drag-drop, a11y).

**Pros**

- **Custom look without fighting the framework.** Material insists on its own design language; escaping it is more work than starting from a neutral base.
- **Two visual identities, one component library.** Client app reads as friendly and consumer-grade; agent app reads as dense and utilitarian. Both use the same components, just different Tailwind tokens.
- **Modern, on-brand aesthetic out of the box.** Shadcn-style UI is the current industry default for SaaS — instantly familiar to users, easy to recruit devs for.
- **First-class Tailwind.** Tailwind utility classes are easy to read, easy to grep, easy to delete. No SCSS partials, no `::ng-deep` battles.
- **CDK underneath for the hard parts.** Spartan delegates accessibility, overlays, and focus traps to Angular CDK — the same library Material uses. We get Material's a11y rigour with none of its visual baggage.
- **Easy to override per app.** Each frontend has its own `tailwind.config.ts` extending one shared preset; brand colours and density are app-local.
- **Copy-in escape hatch.** If we ever need to fork a component, Spartan's pattern makes that trivial — the component code lives in our repo.

**Cons**

- Younger ecosystem than Material — fewer community recipes; we may write a few helpers ourselves.
- No heavyweight data grid in Spartan — we'll reach for AG Grid or TanStack Table when we need one. (CDK covers virtual scroll for simpler cases.)
- Tailwind has a learning curve for devs new to utility-CSS — short and one-time.

**Bottom line:** Spartan + Tailwind + CDK gives us a modern, custom-looking UI in a fraction of the time it takes to detune Material, and the CDK underpinning means we don't trade accessibility for aesthetics.

---

## Why Zod for shared contracts

A single Zod schema validates the request on the Fastify side, infers the TypeScript type for the frontend, and powers Angular form validation.

**Pros**

- **One source of truth.** The same schema validates inbound BFF requests, types the typed-client method on the frontend, and seeds form validators. Drift between server and client is structurally impossible.
- **Runtime safety at boundaries.** Fastify rejects malformed payloads before any handler runs. The frontend rejects bad form input before sending.
- **Excellent TS inference.** `z.infer<typeof X>` gives us first-class types without code generation steps.
- **Composable and testable.** Schemas are plain values you can reuse, extend, refine, and unit-test.
- **Mature Fastify integration** via `fastify-type-provider-zod` — request validation, response validation, and OpenAPI generation come together.

**Cons**

- Schemas are slightly more verbose than `interface` declarations — paid back the first time a malformed payload would have broken production.
- Slight runtime cost on validation — negligible for our payload sizes.

**Alternatives considered:** TypeBox (faster runtime, less ergonomic on the frontend); class-validator (decorator-heavy, awkward to share). Zod wins on developer experience and on the shared-frontend story.

**Bottom line:** if validation and types are going to exist anyway, they should be the same artefact.

---

## Why magic link + OTP for the client app

Consumer-facing apps live or die on friction. The client app uses passwordless email magic links plus OTP fallback.

**Pros**

- **No passwords to forget, leak, or reuse.** Eliminates the entire password-reset support burden.
- **Lower drop-off in signup.** Industry data consistently shows passwordless flows convert better than password registration.
- **Phishing-resistant by design.** No password to harvest.
- **OTP fallback** for users on devices where opening an email link is awkward (in-app browsers, kiosk mode).
- **Simple to operate.** No password storage means no hashing policy, no breach-disclosure exposure, no password rotation rules.
- **Trivially upgradeable to WebAuthn / passkeys** once we want to.

**Cons**

- Email deliverability is on the critical path — we'll need a reputable transactional mail provider (SES, Postmark, SendGrid) and monitoring. Worth the trade.
- A compromised email account compromises the insurance account — true of any "reset by email" flow today, including password resets.

**Bottom line:** consumers won't accept friction we'd happily impose on staff. Passwordless is the right default for the public-facing surface.

---

## Why enterprise SSO (Azure AD OIDC) for the agent app

Agents are employees on a managed corporate identity. They should sign in with the same account they use for Outlook.

**Pros**

- **Zero new credentials for agents.** They sign in with their work account. Onboarding is "add user to the agent group in Entra ID".
- **Offboarding is instant.** Disabling the user in Entra ID immediately revokes access — no separate user table to remember to clean.
- **MFA / conditional access for free.** Whatever the corporate Entra policy enforces (MFA, device compliance, location restrictions) automatically applies to the agent app.
- **Audit trail lives in one place.** Sign-in logs, risky-sign-in detection, and compliance reports are already in Entra.
- **Standard OIDC.** No vendor lock-in beyond the IdP itself; switching to Okta/Auth0 later is configuration, not code.
- **Token exchange and refresh happen server-side.** The agent BFF holds the refresh token; the browser only holds a session cookie.

**Cons**

- Requires an Azure AD app registration and admin consent — one-time setup with the platform team.
- Local dev needs either a dev tenant or a stub IdP — handled with a dev-mode flag in the BFF.

**Bottom line:** internal users belong on enterprise SSO. Anything else duplicates identity management the company already pays for.

---

## Why stateless encrypted-cookie sessions (for now)

Both BFFs currently use `@fastify/secure-session` — the entire session is encrypted into the cookie, and the server holds no session state. No Redis, no database.

**Pros**

- **Zero session infrastructure** for the POC — nothing to stand up, monitor, or back up.
- **Free horizontal scaling** — any BFF instance can read any cookie; no shared store, no sticky sessions.
- **Good enough for the client BFF long-term** — consumer sessions are low-sensitivity and there are no downstream tokens to conceal.

**Cons (and the plan)**

- **No server-side revocation** — a stolen cookie stays valid until expiry. Acceptable for consumer sessions; not for staff.
- **~4 KB cookie ceiling** — fine for a `SessionUser`, too small once you stash OIDC access/refresh tokens.
- **Key rotation invalidates all sessions.**

**The split:** the client BFF likely keeps cookies forever (low-sensitivity, no tokens). The **agent BFF moves to a server-side store** (Redis/Valkey on Azure, or Postgres if we already run it) at the same time we wire the real Azure provider — because that's when we start holding tokens that must stay server-side and staff sessions that must be revocable. The swap is localized to `libs/bff/core` thanks to the `createBffServer` factory + `requireSession` guard; no routes or frontend code move.

Full reasoning, the model comparison, and store alternatives: **[session-strategy.md](session-strategy.md)**.

**Bottom line:** don't buy session infrastructure before the requirement that needs it arrives. Cookies now; a store for the agent BFF exactly when token custody + revocation land.

---

## Why design for N frontends from day one

The POC ships with two frontends, but the structure assumes more are coming (broker portal, admin console, claims adjuster mobile web, partner self-serve).

**Pros**

- **Each new frontend = one app folder + one BFF folder.** Nothing in the architecture changes; we use the same generators, the same libs, the same patterns.
- **Shared libs grow naturally.** A component built for the agent app is available to the broker app the day it lands.
- **No "big rewrite when we add a third frontend".** That rewrite is the most expensive event in most codebases. We avoid it by paying a small amount upfront.
- **Per-frontend deployment, per-frontend security posture, per-frontend release cadence** — all free once the pattern is in place for two.

**Cons**

- Slightly more ceremony at week one than "just throw it in `src/`" — the ceremony pays back the second time we need it.

**Bottom line:** scaling from 2 → 5 frontends with this structure is boring. Scaling from 1 → 2 without it is the painful step we've already absorbed.

---

## What this unlocks for the business

- **Faster feature delivery** once the scaffolding is in place — shared libs mean a feature touches one component, not three forks of it.
- **Lower security risk** — tokens never reach the browser, auth strategies are isolated per audience, schemas validate at the boundary.
- **Lower onboarding cost** for new engineers — one repo, one toolchain, one set of conventions.
- **Cheaper experimentation** — spin up a new frontend (partner portal, mobile-web claims, internal admin) in days, not weeks.
- **Independent scaling and blast-radius isolation** — consumer traffic spikes don't risk agent operations.
- **Vendor-portable identity** — standard OIDC means we're not locked into Azure AD if procurement changes its mind.

---

## Library naming and the tag vocabulary

Folders group; **tags enforce**. Nx is explicit that folder structure is
convention rather than mechanism — `@nx/enforce-module-boundaries` reads tags, not
paths — so both are documented here and the tags are the part that fails a build.

### Naming

A lib's project name is `<scope>-<leaf>`, and its import alias is
`@aic-<scope>/<leaf>` — the first dash becomes the slash:

| Folder                 | Project           | Alias                  |
| ---------------------- | ----------------- | ---------------------- |
| `libs/shared/ui`       | `shared-ui`       | `@aic-shared/ui`       |
| `libs/shared/bff-core` | `shared-bff-core` | `@aic-shared/bff-core` |
| `libs/agent/contracts` | `agent-contracts` | `@aic-agent/contracts` |

Two reasons this is a rule rather than a preference:

- **`@nx/js:lib` derives the name from the last folder segment** when `--name` is
  omitted. That is how `libs/bff/contracts` came to own the bare word `contracts`
  and force `agent-contracts` / `broker-contracts` to be hand-named around it. The
  generator actively produces the drift.
- **One slash, because an alias is a package name.** npm allows exactly one `/`,
  the scope separator, so `@aic/shared/ui` is invalid as a package name. New Nx
  workspaces default to package-manager workspaces where the alias _is_ the
  package name — this spelling is Nx's documented flattening
  ([switch-to-workspaces-project-references](https://nx.dev/docs/kb/switch-to-workspaces-project-references)),
  and adopting it now avoids renaming twice.

Enforced by `workspace-conventions.spec.ts`, which also asserts every
`project.json` declares a `name` — mandatory, not stylistic: Nx passes `json.name`
straight through with no folder fallback, and with no sibling `package.json` a
missing name throws at graph construction.

### `scope:` — who owns it

`client` · `agent` · `dealer` · `broker` · `shared`

A portal and its BFF share a scope. `scope:shared` may depend only on
`scope:shared`; every other scope may depend on itself and `shared`. This is what
stops one portal's contract change breaking another.

### `type:` — what kind of thing it is

| Tag                | Means                                                        | May depend on                                      |
| ------------------ | ------------------------------------------------------------ | -------------------------------------------------- |
| `type:app`         | An Angular portal                                            | `ui`, `auth`, `contracts`                          |
| `type:bff`         | A Fastify BFF                                                | `bff-core`, `bff-auth`, `data-access`, `contracts` |
| `type:ui`          | Presentational components — no HTTP, router or store         | nothing                                            |
| `type:contracts`   | Zod schemas + inferred types                                 | nothing                                            |
| `type:auth`        | Frontend session wrapper                                     | `contracts`                                        |
| `type:bff-core`    | Fastify factory, plugins, guards, env                        | `contracts`                                        |
| `type:bff-auth`    | An auth method (OIDC/SSO)                                    | `bff-core`, `contracts`                            |
| `type:data-access` | Generated upstream clients (e.g. the ESL OpenAPI→Zod client) | `contracts`                                        |

Nx's guidance is to keep the number of types low and to say what each one means;
undocumented types are the actual violation, not the count. Adding one is a
deliberate act — add it here first, then to `eslint.config.mjs`.

## Risks and mitigations

| Risk                                 | Mitigation                                                                  |
| ------------------------------------ | --------------------------------------------------------------------------- |
| Monorepo CI gets slow as it grows    | Nx affected-graph + remote cache (Nx Cloud or self-hosted)                  |
| Shared libs accumulate too much code | Strict Nx module-boundary lint rules; review for "is this really shared?"   |
| Two BFFs duplicate logic             | All non-frontend-specific code lives in `libs/bff/core`; reviewed for drift |
| Spartan NG ecosystem is young        | CDK is mature; we can fork any Spartan component if needed                  |
| Magic-link deliverability            | Reputable provider, SPF/DKIM/DMARC, bounce/complaint monitoring             |
| Azure AD setup blocks dev            | Dev-mode stub IdP in agent BFF — works without a real tenant                |
| Session cookie size grows            | Server-side session store (Redis) once we cross ~4 KB                       |

---

## Explicitly out of scope for the POC

Listing these so the manager knows what we're _not_ claiming to demonstrate:

- Real downstream insurance API integration (we'll stub one upstream)
- Production-grade observability (basic logging only — full OpenTelemetry comes later)
- Multi-region deployment
- Mobile native apps (web-only for now; structure supports adding them as new "frontends")
- Realtime / WebSocket flows
- Full accessibility audit (we follow CDK defaults; formal WCAG audit is a separate workstream)

---

## Open questions

- **State management library** — signals + per-feature stores is the default. Revisit if a feature genuinely needs NgRx.
- **i18n strategy** — Angular's built-in `@angular/localize` vs Transloco. Decide before we ship the second locale.
- **Feature flags** — in-house tiny abstraction now, real provider (LaunchDarkly, GrowthBook, ConfigCat) later.
- **Component documentation** — Storybook is the obvious pick; defer the install until we have ≥10 components.

---

## How this document is meant to be read

Each section is independently editable. As decisions get made, add a new section; as decisions get revised, mark the old one ✅→🔄 and add a new one with a date and the reason for the change. Decisions get _amended_, not silently overwritten — that's how a year from now we'll still understand why the codebase looks the way it does.
