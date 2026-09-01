# AIC POC

Nx monorepo with two Angular frontends and a Fastify BFF per frontend, demonstrating different auth mechanisms for different audiences sharing one type-safe contract layer.

See [docs/architecture-decisions.md](docs/architecture-decisions.md) for the why behind every structural choice, [docs/bff-latency.md](docs/bff-latency.md) for the latency reasoning, and [docs/spartan-ui-architecture.md](docs/spartan-ui-architecture.md) for the UI component architecture (Spartan brain/helm, Tailwind v4, design tokens).

## Stack

| Layer       | Choice                                                             |
| ----------- | ------------------------------------------------------------------ |
| Monorepo    | Nx 22 + pnpm workspaces                                            |
| Frontends   | Angular 21 (standalone, signals, esbuild)                          |
| Backends    | Fastify 5 (per-frontend BFF)                                       |
| UI          | Spartan NG (brain + CLI-generated helm) + Tailwind 4 + Angular CDK |
| Validation  | Zod 4 (schemas shared via `@aic-shared/contracts`)                 |
| Sessions    | `@fastify/secure-session` (HttpOnly, SameSite=Lax, signed)         |
| Client auth | Magic link + 6-digit OTP (passwordless)                            |
| Agent auth  | OIDC against Azure AD (stubbed for local dev)                      |

## Prerequisites

- **Node 24.15+** (`.nvmrc` is `24`). Angular 22 requires `^22.22.3 || ^24.15.0 || >=26.0.0`;
  `engines.node` enforces `>=24.15.0`.
- **pnpm 10** — managed by corepack, which reads `packageManager` from `package.json`
  so you get the pinned 10.33.2:
  ```bash
  corepack enable
  ```
- **Docker** — three local services are required, not optional. Nothing works without them.

## First-time setup

```bash
pnpm install

# Local infra: the upstream stub (ESL), Redis, and a mail catcher for the OTP codes.
# Nothing runs without these — the BFFs call the stub on :8081 and post mail to :1025.
docker compose up -d

# All FOUR BFFs need a .env. The committed defaults work for dev as-is:
cp apps/client-bff/.env.example apps/client-bff/.env
cp apps/agent-bff/.env.example  apps/agent-bff/.env
cp apps/dealer-bff/.env.example apps/dealer-bff/.env
cp apps/broker-bff/.env.example apps/broker-bff/.env
```

> The committed `.env.example` files contain dev-only `SESSION_SECRET`s. For staging/prod,
> generate real ones with `openssl rand -hex 32` (or any 64-char hex string).

| Container     | Port        | What it is                                                         |
| ------------- | ----------- | ------------------------------------------------------------------ |
| `aic-esl`     | 8081        | Stand-in upstream API. Source in `./esl-stub` — not an Nx project. |
| `aic-redis`   | 6379        | Present for session work; the POC's sessions are cookie-based.     |
| `aic-mailpit` | 1025 / 8025 | Catches OTP mail. **Read the codes at <http://localhost:8025>.**   |

## Run everything in dev

```bash
pnpm dev
```

That runs all **eight** projects in parallel via `nx run-many -t serve` — four Angular
apps and four BFFs:

| Portal | Frontend                | BFF                     | Auth                            |
| ------ | ----------------------- | ----------------------- | ------------------------------- |
| client | <http://localhost:4200> | <http://localhost:3001> | magic link + OTP (self-owned)   |
| agent  | <http://localhost:4201> | <http://localhost:3002> | Azure AD OIDC (stubbed locally) |
| dealer | <http://localhost:4202> | <http://localhost:3003> | Entra External ID (stubbed)     |
| broker | <http://localhost:4203> | <http://localhost:3004> | Entra External ID (stubbed)     |

To run one portal instead of all eight — much lighter:

```bash
nx serve dealer-bff   # then, in another shell:
nx serve dealer
```

Each Angular dev server proxies `/api/*` to its matching BFF (see `proxy.conf.json`), so
the browser sees a single origin and HttpOnly session cookies just work.

## Checking it actually works

Verified end to end on 2026-09-01, after the Angular 22 upgrade:

```bash
curl http://localhost:3003/api/health            # {"status":"ok","name":"dealer-bff"}
curl http://localhost:3003/api/policies          # 401 UNAUTHENTICATED — the guard works
curl http://localhost:4202/api/health            # same payload through the dev proxy
```

For the client OTP flow, the code is **emailed, not returned in the response** — open
<http://localhost:8025> to read it. `devOtp` appears in the response only when the BFF's
env enables it.

## Trying the auth flows

**Client (magic link + OTP)** — <http://localhost:4200>

1. Type any email → click **Send code**
2. Dev mode returns the OTP in the response — it's shown right on the page as `Dev OTP: 123456`
3. Enter it → click **Verify** → you're on `/` with `Signed in as <localpart>`
4. Click **Sign out** to clear the session cookie

**Agent (stub OIDC)** — <http://localhost:4201>

1. Click **Continue with Microsoft**
2. The BFF stub provider auto-redirects through `/api/auth/login` → `/api/auth/callback` and back to `/`
3. You land on `/` as `Stub Agent` with roles `agent, claims:read, claims:write`
4. Flip `OIDC_MODE=azure` in `apps/agent-bff/.env` and provide `AZURE_*` env vars to swap in a real Azure AD tenant (provider implementation TBD)

## Common tasks

```bash
pnpm build         # build all projects
pnpm test          # run all unit tests (Jest)
pnpm lint          # lint all projects
pnpm typecheck     # type-check the BFF + shared libs (Angular apps are type-checked by `build`)
pnpm graph         # open the Nx project graph in your browser
pnpm format        # write prettier formatting
pnpm format:check  # CI-friendly format check

# Run one project's target:
nx serve client
nx build agent-bff
nx typecheck client-bff
nx test ui
nx e2e client-e2e

# Affected-only (relative to main):
nx affected -t build
nx affected -t test

# Suggested CI gate — Angular type safety comes from `build` (ngtsc, incl.
# templates); the esbuild-built BFFs are covered by `typecheck`:
nx affected -t lint test build typecheck
```

## Repo layout

```
apps/
  client/  client-bff/     consumer portal — magic link + OTP   (4200 → 3001)
  agent/   agent-bff/      agent portal — Azure AD OIDC         (4201 → 3002)
  dealer/  dealer-bff/     dealer portal — Entra External ID    (4202 → 3003)
  broker/  broker-bff/     broker portal — Entra External ID    (4203 → 3004)
  client-e2e/  agent-e2e/  Playwright

libs/                      one grouping folder per SCOPE, never by technical type
  shared/                  scope:shared — anything more than one portal may use
    ui/                    helm primitives + theme tokens + cn/classes
    auth/                  frontend session wrapper
    contracts/             Zod schemas shared by every BFF and frontend
    bff-core/              Fastify factory, plugins, guards, env loader
    bff-auth-sso/          the OIDC/SSO login flow
    esl-client/            generated client for the upstream stub
  agent/contracts/         scope:agent  — the agent BFF↔frontend contract, and nobody else's
  broker/contracts/        scope:broker
  dealer/contracts/        scope:dealer

esl-stub/                  stand-in upstream API (Docker, port 8081). Deliberately NOT an Nx project.
tools/spartan-add.js       generates a Spartan primitive — see docs/spartan-ui-architecture.md §2
docs/                      decisions, reviews and guides — start with handover.md
```

Each portal gets its **own** contracts lib on purpose: the same upstream record projects to
a different shape per audience, which is the whole point of a BFF. Nx tags enforce it — an
agent lib cannot import `@aic-dealer/contracts` even by accident.

## Path aliases

Project name is `<scope>-<leaf>`; the alias is `@aic-<scope>/<leaf>`, so the first dash
becomes the slash. One slash only — an alias is a package name, and npm allows exactly one.
`workspace-conventions.spec.ts` fails the build if either drifts.

| Import path                            | Resolves to                                  |
| -------------------------------------- | -------------------------------------------- |
| `@aic-shared/ui`                       | helm primitives, theme tokens, cn/classes    |
| `@aic-shared/auth`                     | frontend session service                     |
| `@aic-shared/contracts`                | Zod schemas shared across all portals        |
| `@aic-shared/bff-core`                 | Fastify factory, plugins, guards, env loader |
| `@aic-shared/bff-auth-sso`             | OIDC/SSO login routes                        |
| `@aic-shared/esl-client`               | generated upstream client                    |
| `@aic-{agent,broker,dealer}/contracts` | that portal's own BFF↔frontend contract      |

## How the BFFs serve workspace deps

All four BFFs build with `@nx/esbuild` (`bundle: false`). Nx injects a tiny runtime resolver into `main.js` that maps `@aic-*/*` imports to source files copied alongside the output. So even without bundling, the dist is self-contained and `node dist/apps/<bff>/main.js` works after a build.

## Status

POC scaffold complete. Next priorities (not done):

- [ ] Real Azure AD OIDC provider (`apps/agent-bff/src/auth/azure-provider.ts` using `openid-client`)
- [ ] Storybook for `libs/shared/ui`
- [ ] More Spartan components (input, card, dialog) via `@spartan-ng/cli`
- [ ] Real downstream insurance API client in `libs/bff/core` (or per-BFF data lib)
- [ ] CI pipeline (`nx affected` against `main`)
- [ ] Production Dockerfiles + compose for prod-shaped local run
