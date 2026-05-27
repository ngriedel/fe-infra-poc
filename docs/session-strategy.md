# Sessions: do the BFFs need Redis?

Short answer: **not today, and maybe never for the client BFF — but the agent BFF should move to a server-side store before production.** No part of the current POC uses Redis.

## What the POC does right now

Both BFFs use [`@fastify/secure-session`](../libs/bff/core/src/lib/plugins/secure-session.plugin.ts), which is a **stateless, encrypted-cookie session**. The whole session payload (the `SessionUser`) is encrypted with `SESSION_SECRET` and stored *in the cookie itself*. The server keeps zero session state.

The cookie *is* the store. No Redis, no database, no infra.

> Don't confuse this with `@fastify/session` (no "secure"), where the cookie holds only an opaque ID and the data lives server-side. *That* is the library that needs Redis. We are not using it.

## The two models

| | Stateless cookie (current) | Stateful store (cookie = ID) |
|---|---|---|
| Infra required | None | Redis / Postgres / etc. |
| Horizontal scaling | Free — any instance reads any cookie | Needs a shared store (or sticky sessions) |
| Server-side revoke / force-logout | ✗ can't — a stolen cookie is valid until it expires | ✓ delete the key, session dies instantly |
| Cookie size | Whole payload on every request, ~4 KB ceiling | Tiny (just an ID) |
| Holds secrets (e.g. OIDC tokens) server-side | ✗ they'd ride inside the cookie | ✓ never leave the server |
| Encryption-key rotation | Invalidates all live sessions | Sessions survive |
| Operational surface | Just a secret to manage | A store to run, monitor, back up |

## Recommendation — it differs per BFF

This is the important part: the two BFFs have different needs, and that's fine — they're separate processes precisely so they can diverge.

### Client BFF (magic link + OTP) — keep stateless cookies

Probably forever. Consumer sessions are low-sensitivity, there are no downstream tokens to conceal, and "logout clears your own cookie" is acceptable for a consumer app. The stateless model gives free horizontal scaling and nothing to operate. Don't add infra you don't need.

**One caveat:** the magic-link [`ChallengeStore`](../apps/client-bff/src/auth/challenge-store.ts) is an in-memory `Map`. That's *challenge* state (pending OTPs), not *session* state — but it has the same scaling limit: with more than one client-BFF instance, each holds its own map, so a code issued by instance A can't be verified by instance B. Options when you scale out:

- Move challenges to a shared store (Redis/Valkey) — natural if you adopt one anyway.
- Use sticky sessions at the load balancer for the ~10-minute challenge window.
- Make challenges stateless too: sign the `{email, expiry}` into the challenge ID itself (HMAC), so any instance can verify without shared state. Cheapest, no infra.

### Agent BFF (Azure AD OIDC) — move to a server-side store before prod

Two reasons the cookie model genuinely can't satisfy:

1. **Server-side token custody.** The BFF pattern's payoff is that the browser never sees the Azure access/refresh tokens — the BFF holds them and calls downstream APIs on the user's behalf. In a stateless cookie, those tokens would have to live *in the cookie* (encrypted, but still shipped to the browser on every request and eating the 4 KB budget). A server-side session is the whole point of holding tokens at all.
2. **Instant revocation for staff.** When IT disables an agent in Entra ID, you want their existing session dead *now*, not whenever the cookie happens to expire. Only a server-side store lets you `DELETE` the session on demand.

So: agent BFF → cookie carries a session ID, real session (including tokens) lives in a store.

## What that store could be (Redis is not the only answer)

- **Redis / Valkey** — the default choice. (Valkey is the BSD-licensed fork most clouds adopted after Redis's 2024 relicense; API-compatible.) On Azure, **Azure Cache for Redis** is a managed, near-zero-ops option that co-locates with the BFF.
- **PostgreSQL** — if the platform already runs Postgres, a `sessions` table is one *fewer* piece of infrastructure to operate than standing up Redis. Marginally slower, completely fine at agent-portal scale (hundreds–low-thousands of staff).
- **DynamoDB / Cloudflare KV / Durable Objects** — if the agent BFF goes serverless, use the platform-native KV store with a TTL.
- **In-memory** — only valid for a single instance; sessions vanish on restart/redeploy. Acceptable for the POC, not for production.

## Why this is a cheap decision to defer

Everything funnels through the [`createBffServer`](../libs/bff/core/src/lib/server.ts) factory and the [`requireSession`](../libs/bff/core/src/lib/guards/require-session.ts) guard. Swapping the session backend is a **localized change inside `libs/bff/core`** — no route handler and no frontend code moves. We can run the POC on encrypted cookies now and introduce a store for the agent BFF exactly when the OIDC token-custody requirement lands, without rework.

## Bottom line

The POC needs no Redis. The client BFF likely never will. The agent BFF should adopt a server-side store (Redis/Valkey on Azure, or Postgres if you already run it) at the same time you wire the real Azure AD provider — because that's the moment you start holding tokens that must not reach the browser and staff sessions that must be revocable. Until then, encrypted cookies are the right, infra-free default.

See also: [architecture-decisions.md](architecture-decisions.md) · [bff-latency.md](bff-latency.md)
