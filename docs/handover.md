# Handover — next steps

Working handover for a fresh session. Read this + the linked docs, then start with **§5**.
§3 (dealer/broker via Entra External ID) and §4 (client OTP tier) are **done** — kept as
reference for the tenant setup, gotchas, and deliberately-deferred items.

---

## 1. Orientation (read first)

- **Repo:** Nx monorepo, pnpm, Node 24, **branch `azure`** (all work lives here, not `main`).
- **Shape:** 4 frontends + 4 BFFs + shared libs.
  - FE: `client` (4200), `agent` (4201), `dealer` (4202), `broker` (4203).
  - BFF: `client-bff` (3001), `agent-bff` (3002), `dealer-bff` (3003), `broker-bff` (3004).
  - Libs: `bff/{core,contracts,auth-sso,esl-client}`, `shared/{ui,auth}`.
  - Infra (docker-compose): **Redis** (6379), **ESL stub** (8081), **Mailpit** (1025 SMTP / 8025 inbox).
- **Deeper context (all current):**
  - [feature-overview.md](feature-overview.md) — app architecture.
  - [auth-flow.md](auth-flow.md) — plain-English walkthrough of the whole login flow
    (browser → cookie → Redis → Entra → ESL). Start here if auth is unfamiliar.
  - [spartan-ui-architecture.md](spartan-ui-architecture.md) — UI (Tailwind v4 + Spartan 1.0 helm).
  - [bff-security-review.md](bff-security-review.md) — BFF audit: fixed items + standing hardening.
  - [session-strategy.md](session-strategy.md), [angular-22-upgrade.md](angular-22-upgrade.md).
- The assistant's project memory already carries the full decision history (auth tiers, etc.).

## 2. Current state (done + verified, committed on `azure`)

| Area                                                                                                                                                           | State                             |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| UI — Tailwind v4, canonical Spartan 1.0 helm, shared token theme, dark/light/system toggle                                                                     | ✅                                |
| **Agent SSO** — real Entra **workforce** OIDC (openid-client v5, PKCE + nonce + id_token validation), audience isolation                                       | ✅ proven E2E in browser          |
| Sessions — `@fastify/session` + **Redis** (opaque signed id, 8h TTL, `regenerate()` on login)                                                                  | ✅ verified                       |
| Enterprise upstream slice — Spring Boot **ESL stub** (OpenAPI) → generated Zod client (`esl-client`) → agent-bff forwards identity → agent FE renders policies | ✅ verified E2E                   |
| **dealer/broker** — real Entra **External ID** (CIAM) email+password, audience isolation, ESL slice                                                            | ✅ proven E2E in browser (see §3) |
| **client OTP tier** — Redis-backed challenges, HMAC-hashed codes, real mailer (Mailpit), rate-limited                                                          | ✅ verified E2E                   |

**Full gate is green:** `nx run-many -t lint test build typecheck` (16 projects) + `nx format:check`.

**Run it:** `docker compose up -d` (Redis + ESL), then `pnpm dev` (all 8 apps) or `nx serve <project>`.
If `pnpm` isn't on PATH in a shell, use `corepack pnpm …` or `./node_modules/.bin/nx …`.

---

## 3. DONE: dealer/broker → Entra External ID (email/password)

> **Status: complete and proven E2E in the browser on 2026-08-24.** Kept in full below
> because it documents the tenant setup, the gotchas hit, and the known deviations.
> Next work is **§5**.

### Goal & why it was small

dealer + broker are the **tier-2** apps: users sign in with **email + password managed in
Entra External ID** (CIAM), one tenant per audience, **self-service sign-up DISABLED**
(accounts provisioned by admin/Graph). Passwords live in Entra — no bespoke password store.

**Crucially, it reuses the agent machinery.** External ID is still an OIDC auth-code flow;
`EntraOidcProvider` ([libs/bff/auth-sso/src/lib/entra-provider.ts](../libs/bff/auth-sso/src/lib/entra-provider.ts))
already does discovery + PKCE + nonce + id_token validation and states in its own docstring
that it "serves SSO and email/password apps alike — they differ only by `authority` + config."
So the code change is: **point dealer-bff/broker-bff's `azure` case at the External ID authority.**

### ✅ Code changes — DONE (mirrors agent-bff, the reference)

Full gate green (`lint test build typecheck` × 16 projects + `format:check`). What changed:

1. **`apps/dealer-bff/src/env.ts` + `apps/broker-bff/src/env.ts`** — added `AZURE_AUTHORITY`
   (optional; falls back to the workforce authority derived from `AZURE_TENANT_ID`).
2. **`apps/dealer-bff/src/main.ts` + `apps/broker-bff/src/main.ts`** — the `case 'azure'` branch
   now builds a real `EntraOidcProvider` (audience `dealer`/`broker`, `defaultRoles`
   `['dealer']`/`['broker']`). The `stub` branch is untouched and still the default.
3. **`libs/bff/auth-sso/src/lib/entra-provider.ts`** — hardened for CIAM ahead of first login:
   - email now resolves `email` → `emails[0]` → `preferred_username` → synthetic fallback
     (External ID commonly emits `emails: [..]` for local accounts);
   - new `defaultRoles` config, used when the id_token carries no `roles` claim — keeps
     azure-mode role display at parity with stub mode.
4. **FE** — dealer/broker login buttons re-labelled "Continue with Microsoft" → **"Sign in"**,
   and the stub-specific hint replaced with email/password + no-self-signup copy.
5. **`.env.example`** (dealer-bff, broker-bff, agent-bff) — documents `AZURE_AUTHORITY` and
   the redirect-URI-must-be-the-Angular-origin gotcha.

**Smoke-verified** (dealer-bff, `OIDC_MODE=azure` against `login.microsoftonline.com/common`):
boots in azure mode, `GET /api/auth/login` → 302 to the IdP authorize URL with
`code_challenge_method=S256` + `state` + `nonce`, and a signed httpOnly `SameSite=Lax`
`oidc_state` cookie. Everything up to the token exchange is proven; the exchange + claim
mapping need the real tenant below.

### ESL slice extended to dealer + broker

The placeholder marketing cards on both home pages were replaced with a **"Fetch policies"
button** that exercises the whole authenticated chain on demand:
Angular → BFF (`requireSession`, audience-checked) → ESL (`X-User-*` identity) → generated
Zod client → FE contract → rendered.

- New `apps/{dealer,broker}-bff/src/routes/policies.ts` + `ESL_BASE_URL` in both `env.ts`.
- The route is **duplicated per app rather than shared**: `eslint.config.mjs` restricts
  `type:data-access` (esl-client) to `type:contracts`, so it can't take a `bff-core`
  dependency. Promote to a shared lib (and add a depConstraint) if a 4th consumer appears.

### Entra tenant actually used (POC)

**Throwaway CIAM tenant "Gmaven Test"** — a pre-existing external tenant, reused rather than
creating a new one. A proper corporate Azure tenant comes at development time; swapping is
config-only (`AZURE_AUTHORITY` + 2 client id/secret pairs).

- One tenant, **two app registrations** (`AIC Dealer`, `AIC Broker`), platform **Web**
  (NOT SPA — SPA is a public-client type and rejects the BFF's server-side secret exchange).
- Redirect URIs are the **Angular dev origins**: `:4202` / `:4203`, not the BFF ports.
- Both apps attached to the existing `signup-signin` user flow (Email with password).
- `.env` values live locally (gitignored); `.env.example` documents the shape.

**CIAM authority gotcha:** discovery resolves at both `https://gmaventest.ciamlogin.com/<tid>/v2.0`
and the GUID-subdomain form, but the `issuer` it returns is always
`https://<tid>.ciamlogin.com/<tid>/v2.0`. That mismatch is harmless — `Issuer.discover`
(openid-client 5.7.1) does no issuer/URL consistency check and id*token `iss` validation
uses the \_discovered* issuer. The friendlier host is configured so users see a readable
sign-in URL.

### ⚠️ Known deviations from the tier-2 model

1. **Self-service sign-up is ENABLED** on that tenant's `signup-signin` flow — the opposite
   of the "accounts are AIC-issued" model, and it contradicts the copy now on the login
   pages. Harmless on a throwaway POC tenant (it's how the test user was created), but
   **must be closed on the corporate tenant**.
2. **One tenant for both audiences, with no app-assignment gate.** Any user in the directory
   can currently sign into either app. The recommendation is to keep one tenant (a CIAM
   directory is meant to be shared across apps for one population) and gate at the app layer:
   Enterprise application → _Assignment required = Yes_ + app roles. Unassigned users then
   fail at Entra's authorize endpoint (`AADSTS50105`) before a token is ever issued.
   If real app roles are assigned, **drop `defaultRoles`** for those apps — otherwise a
   BFF-side role check is vacuous.

### Claim mapping — what real CIAM tokens actually returned

Verified on first login; no code change was needed:

- `email` → a **real address** (not the `<oid>@no-email.local` fallback).
- `name` → present, so `displayName` isn't just the email echoed back.
- `roles` → **absent**, as expected; `defaultRoles` supplied `['dealer']`/`['broker']`.

### Verified E2E (2026-08-24)

- Browser login on both portals → Entra hosted email/password page → back to `/` signed in.
- Redis holds one `sess:*` key per portal, 8h TTL, correct `audience` + `roles`.
- **Cross-audience isolation proven by test**: a dealer-signed cookie gets **401** at
  broker-bff and vice versa, while each same-audience call returns **200** + live ESL data.
  Three independent locks: per-audience cookie name (`sid.dealer`), distinct
  `SESSION_SECRET`, and the `audience` check in `require-session.ts`.
  (Ports don't scope cookies — the browser really does hold both at once.)
- `OIDC_MODE=stub` still works and remains the default for dev/CI without Entra.
- Full gate green: `nx run-many -t lint test build typecheck` (16 projects) + `format:check`.

---

## 4. DONE: client OTP tier

The public tier was a placeholder (in-memory store, plaintext codes, a `TODO(prod)` where
the mail send should be). Now real:

- **`ChallengeStore` is Redis-backed** (`otp:<id>` hash, 10-min TTL). Expiry is Redis's job,
  so there's no sweep and no window where an expired record is still readable.
- **Codes are never stored** — only an HMAC-SHA256, keyed by the BFF's `SESSION_SECRET` and
  salted with the challenge id. Compared with `timingSafeEqual`. A Redis dump yields nothing.
- **Attempts capped at 5** via atomic `HINCRBY`; the challenge is destroyed on the 5th wrong
  guess, so the 6-digit space can't be walked.
- **Real mailer** — nodemailer → **Mailpit** (new docker-compose service; SMTP `:1025`, web
  inbox **http://localhost:8025**). Mailpit is the maintained successor to MailHog and
  forwards nothing, so real addresses are safe in testing. Swapping in SES/SendGrid is a
  config change behind `createMailer`.
- **`EXPOSE_DEV_OTP` now defaults to FALSE**, so the normal path exercises the real send.
  Set it to `true` in `apps/client-bff/.env` to have the login form auto-fill again. Refused
  outright when `NODE_ENV=production`.

**Rate limiting is now global**, registered in `createBffServer` so all four BFFs get it:
loose 300/min per IP as a backstop, Redis-backed (shared across instances) and namespaced
per audience. The OTP routes tighten it — `/api/auth/request` 5 per 10 min,
`/api/auth/verify` 10 per 10 min.

**Bug found and fixed while doing this:** the central error handler flattened _every_
unrecognised throwable to a 500, including errors that already carried a status — so the
rate limiter's 429 surfaced as `INTERNAL_ERROR`, as would a malformed JSON body's 400. It
now preserves any 4xx (5xx still becomes an opaque `INTERNAL_ERROR`) and maps 429 to a
`RATE_LIMITED` contract code.

**Verified E2E:** code requested → mail lands in Mailpit → Redis holds only the hash → wrong
codes increment attempts 1-4 then destroy the challenge on 5 → correct code creates a
`client` session → 6th request in the window returns 429 `RATE_LIMITED`.

---

## 5. NEXT

- **Remaining BFF hardening** (see [bff-security-review.md](bff-security-review.md)): CSRF
  posture (Origin/Sec-Fetch-Site or `@fastify/csrf-protection`), graceful shutdown,
  `trustProxy`/`bodyLimit`, move `pino-pretty` to devDeps. Rate-limit and OTP-hashing are
  now done.
- **Close the tier-2 Entra gaps** when moving to a corporate tenant: disable self-service
  sign-up, add app-assignment + app roles, then drop `defaultRoles`. Deliberately deferred —
  the corporate tenant will be built from scratch anyway, and it's config-only.
- **BFF → ESL is unauthenticated**: identity is asserted in plain `X-User-*` headers and the
  ESL trusts them. Deliberately out of POC scope — HMAC is an established in-house pattern
  to apply at integration time.
- **Rate-limit keying** is per-IP only. Keying `/api/auth/request` on the email as well would
  stop one host burning through many addresses; needs a `preHandler` hook so the body is
  parsed first.
- **CI** (out of POC scope — GoCD + devops conversation): the gate exists but nothing runs
  it automatically.

---

## 6. Reference

- **Ports:** FE 4200/4201/4202/4203 · BFF 3001/3002/3003/3004 · Redis 6379 · ESL 8081.
- **Gate:** `nx run-many -t lint test build typecheck` + `nx format:check`. Angular apps are
  type-checked by `build`; the Node/TS libs+BFFs have an explicit `typecheck` target.
- **Gotchas learned:**
  - Redirect URI = **Angular dev origin**, not the BFF port.
  - Entra app registration platform must be **Web**, not SPA — SPA is a public-client type
    and rejects the BFF's server-side `client_secret` token exchange.
  - CIAM discovery returns a **GUID-subdomain `issuer`** regardless of which host you
    discover on; harmless, `openid-client` validates against the discovered issuer.
  - esbuild `bundle:false` watch **does not pick up newly-added files** — restart
    `nx serve <bff>` after adding a route module, or it dies on `Cannot find module`.
  - `openid-client` pinned to **v5** (CJS) — v6 is ESM-only and breaks the esbuild `bundle:false` build.
  - Session store is Redis-backed (`libs/bff/core/src/lib/plugins/session.plugin.ts` +
    `redis-store.ts`); `@fastify/cookie` is registered **with a secret** so the `oidc_state`
    CSRF cookie is signed.
  - `.env` files are **gitignored** (real secrets local); each BFF needs a distinct `SESSION_SECRET`.
  - If `pnpm` is missing on a shell's PATH, use `corepack pnpm` or `./node_modules/.bin/nx`.
- **ESL contract regen** (if you touch the stub): re-fetch `curl http://localhost:8081/v3/api-docs`
  → `libs/bff/esl-client/openapi/esl.openapi.json`, then rerun `openapi-zod-client` (command in
  [esl-client.ts](../libs/bff/esl-client/src/lib/esl-client.ts) docblock).
