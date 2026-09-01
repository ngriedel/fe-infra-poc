# BFF security & best-practice review (2026-07-01)

Web-verified audit of the two Fastify BFFs + shared `libs/bff/*`, with an
adversarial verification pass. This records what was **fixed** and what remains a
deliberate **recommendation** (mostly "productionize the auth" work).

> Verified after fixes: `nx build client-bff` + `agent-bff`, `tsc --noEmit` on every
> BFF project (0 errors), `nx run-many -t lint` (10 projects, 0 warnings),
> `nx format:check` (clean).

## Fixed

| #   | Area     | Defect                                                                                                                                                                                                                                     | Fix                                                                                                                                                                                                                                                                   |
| --- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Sessions | `secure-session.plugin.ts` pre-registered `@fastify/cookie` **without a secret**, suppressing secure-session's own signed registration → SSO `/api/auth/login` **threw at runtime** and the state cookie was unsigned (CSRF control void). | Removed the redundant `app.register(cookie)`; secure-session now registers it with a derived signing secret.                                                                                                                                                          |
| 2   | Errors   | `err instanceof ZodError` was **dead code** under fastify-type-provider-zod v6 → every invalid request returned **500 instead of 400**.                                                                                                    | `hasZodFastifySchemaValidationErrors` → 400; `isResponseSerializationError` → 500 (logged, not leaked); AppError + raw-ZodError fallback kept.                                                                                                                        |
| 3   | Config   | `LOG_PRETTY: z.coerce.boolean()` coerces the string `"false"` → `true` → pino-pretty ships to prod.                                                                                                                                        | `z.enum(['true','false']).transform(v => v === 'true')`.                                                                                                                                                                                                              |
| 4   | Auth     | OTP was a **fixed env value** (`DEV_FIXED_OTP`=`123456`) **returned in the response unconditionally**; no attempt limit.                                                                                                                   | CSPRNG OTP (`crypto.randomInt`) in `ChallengeStore`; attempt counter (invalidate after 5); `devOtp` returned only when `NODE_ENV !== 'production'`; `DEV_FIXED_OTP` removed.                                                                                          |
| 5   | Auth     | SSO `returnTo` was unvalidated → **open redirect** off-site.                                                                                                                                                                               | Shared `safeReturnToSchema` (same-origin relative only; unsafe coerced to `/`) on the login query, re-validated before the callback redirect.                                                                                                                         |
| 6   | Auth     | `OIDC_MODE` defaulted to `stub` with **no production guard** — a misconfigured prod would hand out canned agent sessions.                                                                                                                  | `buildProvider` throws if `stub` && `NODE_ENV==='production'` (fail closed).                                                                                                                                                                                          |
| 7   | Headers  | `helmet({ contentSecurityPolicy: false })` shipped to prod unconditionally.                                                                                                                                                                | Strict CSP (`defaultSrc 'none'`) in prod, relaxed only outside prod (`nodeEnv` threaded through `securityPlugin`).                                                                                                                                                    |
| 8   | Hygiene  | Raw email (PII) logged at info; logout + health routes had no response schema; OIDC query schemas duplicated instead of shared; deprecated zod-3 idioms.                                                                                   | Dropped email from logs (kept `challengeId`); response schemas on logout + both health routes (`healthResponseSchema`); OIDC schemas moved to `@aic-shared/contracts`; `z.email`/`z.iso.datetime`/`z.strictObject`; eslint `no-unused-vars` `argsIgnorePattern:'^_'`. |

### Refuted (no change)

**Session fixation / "regenerate on login"** — does **not** apply here.
`@fastify/secure-session` is stateless (state lives in an encrypted cookie; there
is no server-side session id to rotate), so there is nothing to fix. The
adversarial pass caught this as a false positive.

## Open — recommended, not applied

### `openid-client` 5.7.1 → 6.8.7 — scoped 2026-09-01, not attempted

The largest single piece of debt in the auth path, and not a version bump. Three
things have to move together, which is why it wants its own window:

1. **v6 is pure ESM** (`"type": "module"`). All four BFFs build CJS with
   `bundle: false`, and `redis-store.ts` carries a comment saying v5 was chosen
   for exactly that reason. Either the import becomes a dynamic `import()`, or the
   BFF build target moves to ESM — which re-tests the Nx runtime path resolver that
   makes `bundle: false` work.
2. **The API is different, not renamed.** `Issuer` and `generators` — both used in
   `entra-provider.ts` — do not exist in v6, which is functional throughout. This
   is a rewrite of the relying-party code, not a find-and-replace.
3. **It cannot be verified locally.** `OIDC_MODE` defaults to `stub`, so the real
   Entra path is exercised only against a tenant with an app registration. Landing
   an untested rewrite of the login flow is worse than the debt.

Sequence when it is taken on: move the BFF build to ESM first and prove the
existing v5 flow still works, then rewrite the provider, then verify against a real
tenant before merging. Do not bundle it with anything else.

These are prod-hardening / design decisions (the auth is intentionally stubbed for
the POC), ordered roughly by value:

1. **Rate-limiting** — add `@fastify/rate-limit` on `/api/auth/request` + `/verify` (pairs with the OTP attempt counter).
2. **Real OTP delivery** — send the code by email in prod (the `TODO(prod)` in `auth/routes.ts`); the response never carries it.
3. **CSRF defense-in-depth** — today SameSite=lax is the only control on cookie-authed POSTs. Add an `Origin`/`Sec-Fetch-Site` allowlist preHandler (light, same-origin BFF) or `@fastify/csrf-protection`; document the chosen posture in [session-strategy.md](session-strategy.md).
4. **OIDC hardening (before the Azure path)** — extend the `OidcProvider` seam to carry **nonce + PKCE**, and validate the `id_token` (sig/aud/iss/nonce). `openid-client` handles most of this; the interface must carry it.
5. **OTP hashing at rest** — when the challenge store moves to Redis/DB, store a hash (compare with `crypto.timingSafeEqual`), never the code.
6. **Ops** — graceful shutdown (`SIGTERM`/`SIGINT` → `app.close()`); `trustProxy` + explicit `bodyLimit` when behind a proxy; move `pino-pretty` to `devDependencies`; consider a `SESSION_SECRET` key-rotation array.
7. **BFF tests** — there are none; add unit/integration tests for the auth flows (a login→callback happy-path test would have caught the cookie-signing throw). _(Done: a `typecheck` target — `tsc --noEmit` — is now on all 5 BFF projects + `shared/ui`, so `nx run-many -t typecheck` covers the esbuild-built BFFs; Angular projects stay covered by `build`.)_
