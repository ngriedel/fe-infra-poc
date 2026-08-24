# Handover — next steps (start: dealer/broker Entra External ID auth)

Working handover for a fresh session. Read this + the linked docs, then start with
**§3 (dealer/broker email/password via Entra External ID)**.

---

## 1. Orientation (read first)

- **Repo:** Nx monorepo, pnpm, Node 24, **branch `azure`** (all work lives here, not `main`).
- **Shape:** 4 frontends + 4 BFFs + shared libs.
  - FE: `client` (4200), `agent` (4201), `dealer` (4202), `broker` (4203).
  - BFF: `client-bff` (3001), `agent-bff` (3002), `dealer-bff` (3003), `broker-bff` (3004).
  - Libs: `bff/{core,contracts,auth-sso,esl-client}`, `shared/{ui,auth}`.
  - Infra (docker-compose): **Redis** (6379), **ESL stub** (8081).
- **Deeper context (all current):**
  - [feature-overview.md](feature-overview.md) — app architecture.
  - [spartan-ui-architecture.md](spartan-ui-architecture.md) — UI (Tailwind v4 + Spartan 1.0 helm).
  - [bff-security-review.md](bff-security-review.md) — BFF audit: fixed items + standing hardening.
  - [session-strategy.md](session-strategy.md), [angular-22-upgrade.md](angular-22-upgrade.md).
- The assistant's project memory already carries the full decision history (auth tiers, etc.).

## 2. Current state (done + verified, committed on `azure`)

| Area                                                                                                                                                           | State                                                                          |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| UI — Tailwind v4, canonical Spartan 1.0 helm, shared token theme, dark/light/system toggle                                                                     | ✅                                                                             |
| **Agent SSO** — real Entra **workforce** OIDC (openid-client v5, PKCE + nonce + id_token validation), audience isolation                                       | ✅ proven E2E in browser                                                       |
| Sessions — `@fastify/session` + **Redis** (opaque signed id, 8h TTL, `regenerate()` on login)                                                                  | ✅ verified                                                                    |
| Enterprise upstream slice — Spring Boot **ESL stub** (OpenAPI) → generated Zod client (`esl-client`) → agent-bff forwards identity → agent FE renders policies | ✅ verified E2E                                                                |
| dealer/broker                                                                                                                                                  | ⚠️ **auth is still the SSO _stub_** — this is §3                               |
| client OTP tier                                                                                                                                                | ⚠️ CSPRNG OTP + attempts + Redis-ready, but **no real mailer / no rate-limit** |

**Full gate is green:** `nx run-many -t lint test build typecheck` (16 projects) + `nx format:check`.

**Run it:** `docker compose up -d` (Redis + ESL), then `pnpm dev` (all 8 apps) or `nx serve <project>`.
If `pnpm` isn't on PATH in a shell, use `corepack pnpm …` or `./node_modules/.bin/nx …`.

---

## 3. NEXT: dealer/broker → Entra External ID (email/password)

### Goal & why it's small

dealer + broker are the **tier-2** apps: users sign in with **email + password managed in
Entra External ID** (CIAM), one tenant per audience, **self-service sign-up DISABLED**
(accounts provisioned by admin/Graph). Passwords live in Entra — no bespoke password store.

**Crucially, it reuses the agent machinery.** External ID is still an OIDC auth-code flow;
`EntraOidcProvider` ([libs/bff/auth-sso/src/lib/entra-provider.ts](../libs/bff/auth-sso/src/lib/entra-provider.ts))
already does discovery + PKCE + nonce + id_token validation and states in its own docstring
that it "serves SSO and email/password apps alike — they differ only by `authority` + config."
So the code change is: **point dealer-bff/broker-bff's `azure` case at the External ID authority.**

### Code changes (mirror agent-bff, which is the reference)

Reference implementation: [apps/agent-bff/src/main.ts](../apps/agent-bff/src/main.ts) `buildProvider`.

1. **`apps/dealer-bff/src/env.ts` + `apps/broker-bff/src/env.ts`** — add `AZURE_AUTHORITY`
   (agent-bff already has it; dealer/broker don't):
   ```ts
   AZURE_AUTHORITY: z.string().url().optional(), // External ID CIAM authority
   ```
2. **`apps/dealer-bff/src/main.ts` + `apps/broker-bff/src/main.ts`** — replace the
   `case 'azure': throw …` with the real provider (copy agent-bff's block, change `audience`):
   ```ts
   import { registerSsoAuthRoutes, StubOidcProvider, EntraOidcProvider, type OidcProvider } from '@aic/bff/auth-sso';
   // …
   case 'azure': {
     const { AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_REDIRECT_URI } = env;
     if (!AZURE_TENANT_ID || !AZURE_CLIENT_ID || !AZURE_CLIENT_SECRET || !AZURE_REDIRECT_URI) {
       throw new Error('OIDC_MODE=azure requires AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_REDIRECT_URI');
     }
     return new EntraOidcProvider({
       authority: env.AZURE_AUTHORITY ?? `https://login.microsoftonline.com/${AZURE_TENANT_ID}/v2.0`,
       clientId: AZURE_CLIENT_ID,
       clientSecret: AZURE_CLIENT_SECRET,
       redirectUri: AZURE_REDIRECT_URI,
       audience: 'dealer', // 'broker' in broker-bff
     });
   }
   ```
   For External ID, `AZURE_AUTHORITY` is set (CIAM), so the workforce fallback is overridden.
3. **FE (optional):** the dealer/broker login pages
   ([apps/dealer/src/app/auth/login-page.component.ts](../apps/dealer/src/app/auth/login-page.component.ts))
   call `auth.beginLogin('/')` → `/api/auth/login` — unchanged for External ID (it just
   redirects to Entra's hosted **email/password** page). Consider re-labelling the button
   from "Continue with Microsoft" to "Sign in".

### Entra-side setup (manual — user has an Azure account)

Per the plan, start the test with **ONE External ID tenant + TWO app registrations**
(dealer + broker); truly separate tenants is later config.

1. Create an **Entra External ID** (CIAM) tenant. Add a **sign-in user flow**;
   **disable self-service sign-up** (invite/admin-provisioned only).
2. Register 2 apps (dealer, broker). For each, set the **redirect URI to the ANGULAR dev
   origin**, NOT the BFF port:
   - dealer → `http://localhost:4202/api/auth/callback`
   - broker → `http://localhost:4203/api/auth/callback`
     (This bit the agent slice: the state cookie won't reach the callback if the redirect URI
     is the BFF's own `:3003/:3004`.)
3. Provision a test user (email + password).
4. Collect: tenant id, per-app client id + secret, and the **CIAM authority**
   (e.g. `https://<tenant>.ciamlogin.com/<tenant-id>/v2.0`). Confirm `‹authority›/.well-known/openid-configuration`
   resolves — `openid-client`'s `Issuer.discover(authority)` must succeed.

### `.env` (gitignored — user creates locally)

`apps/dealer-bff/.env` (broker analogous on `:4203` / port `3004`):

```
NODE_ENV=development
HOST=0.0.0.0
PORT=3003
SESSION_SECRET=<64-hex, distinct per BFF>
FRONTEND_ORIGIN=http://localhost:4202
LOG_PRETTY=true
OIDC_MODE=azure
AZURE_TENANT_ID=<external-id tenant id>
AZURE_CLIENT_ID=<dealer app client id>
AZURE_CLIENT_SECRET=<dealer app secret>
AZURE_AUTHORITY=https://<tenant>.ciamlogin.com/<tenant-id>/v2.0
AZURE_REDIRECT_URI=http://localhost:4202/api/auth/callback
POST_LOGIN_DEFAULT=/
```

### ⚠️ Likely gotcha — claim mapping

`EntraOidcProvider.toSessionUser` maps `oid`/`email`/`name`/`roles`. **External ID (CIAM)
tokens differ from workforce tokens**: `email` may need to be enabled as an emitted claim (or
arrive as `emails[0]`/`preferred_username`), and app `roles` are usually absent unless app
roles are assigned in the External ID app. **Verify the claim mapping** on first login and
adjust `toSessionUser` if needed (e.g. fall back to `preferred_username`, assign a default
`['dealer']` role). This is the main place the "config-only" reuse might need a small tweak.

### Verify (mirror the agent slice)

- With real `.env` in place: `docker compose up -d`, then `nx serve dealer-bff` + `nx serve dealer`.
- Browser: `http://localhost:4202` → login → **Entra hosted email/password page** → back to `/`.
- Confirm: `GET /api/auth/session` shows `audience: "dealer"`; a `sess:*` key exists in Redis
  (`docker exec aic-redis redis-cli keys 'sess:*'`).
- Keep `OIDC_MODE=stub` working (dev/CI without Entra); don't remove the stub branch.
- Run the gate before finishing: `nx run-many -t lint test build typecheck` + `nx format:check`.

---

## 4. After dealer/broker

- **client OTP tier:** real transactional mailer (dev inbox Ethereal/Mailhog), `@fastify/rate-limit`
  on `/api/auth/request` + `/verify`. The OTP already uses CSPRNG + an attempts counter.
- **Standing BFF hardening** (see [bff-security-review.md](bff-security-review.md)): rate-limit,
  CSRF posture (Origin/Sec-Fetch-Site or `@fastify/csrf-protection`), OTP hashing at rest,
  graceful shutdown, `trustProxy`/`bodyLimit`, move `pino-pretty` to devDeps.
- **CI:** wire `nx affected -t lint test build typecheck` (+ `format:check`) into a pipeline —
  the gate exists but nothing runs it automatically.

---

## 5. Reference

- **Ports:** FE 4200/4201/4202/4203 · BFF 3001/3002/3003/3004 · Redis 6379 · ESL 8081.
- **Gate:** `nx run-many -t lint test build typecheck` + `nx format:check`. Angular apps are
  type-checked by `build`; the Node/TS libs+BFFs have an explicit `typecheck` target.
- **Gotchas learned:**
  - Redirect URI = **Angular dev origin**, not the BFF port.
  - `openid-client` pinned to **v5** (CJS) — v6 is ESM-only and breaks the esbuild `bundle:false` build.
  - Session store is Redis-backed (`libs/bff/core/src/lib/plugins/session.plugin.ts` +
    `redis-store.ts`); `@fastify/cookie` is registered **with a secret** so the `oidc_state`
    CSRF cookie is signed.
  - `.env` files are **gitignored** (real secrets local); each BFF needs a distinct `SESSION_SECRET`.
  - If `pnpm` is missing on a shell's PATH, use `corepack pnpm` or `./node_modules/.bin/nx`.
- **ESL contract regen** (if you touch the stub): re-fetch `curl http://localhost:8081/v3/api-docs`
  → `libs/bff/esl-client/openapi/esl.openapi.json`, then rerun `openapi-zod-client` (command in
  [esl-client.ts](../libs/bff/esl-client/src/lib/esl-client.ts) docblock).
