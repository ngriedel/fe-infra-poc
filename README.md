# AIC POC

Nx monorepo with two Angular frontends and a Fastify BFF per frontend, demonstrating different auth mechanisms for different audiences sharing one type-safe contract layer.

See [docs/architecture-decisions.md](docs/architecture-decisions.md) for the why behind every structural choice, and [docs/bff-latency.md](docs/bff-latency.md) for the latency reasoning.

## Stack

| Layer | Choice |
|---|---|
| Monorepo | Nx 22 + pnpm workspaces |
| Frontends | Angular 21 (standalone, signals, esbuild) |
| Backends | Fastify 5 (per-frontend BFF) |
| UI | Spartan-style HlmButton + Tailwind 3 + Angular CDK |
| Validation | Zod 4 (schemas shared via `@aic/bff/contracts`) |
| Sessions | `@fastify/secure-session` (HttpOnly, SameSite=Lax, signed) |
| Client auth | Magic link + 6-digit OTP (passwordless) |
| Agent auth | OIDC against Azure AD (stubbed for local dev) |

## Prerequisites

- **Node 24 LTS** (`.nvmrc` is `24`; install via `nvm-windows` or the official MSI)
- **pnpm 10+** (auto-managed via corepack — `corepack enable pnpm` once)

## First-time setup

```bash
pnpm install
# Both BFFs need a .env file. The defaults in .env.example work for dev:
cp apps/client-bff/.env.example apps/client-bff/.env
cp apps/agent-bff/.env.example apps/agent-bff/.env
```

> The committed `.env.example` files contain dev-only `SESSION_SECRET`s. For staging/prod, generate real ones with `openssl rand -hex 32` (or any 64-char hex string).

## Run everything in dev

```bash
pnpm dev
```

That runs all four projects in parallel via `nx run-many -t serve`:

| App | URL |
|---|---|
| Client frontend | <http://localhost:4200> |
| Client BFF | <http://localhost:3001> |
| Agent frontend | <http://localhost:4201> |
| Agent BFF | <http://localhost:3002> |

Each Angular dev server proxies `/api/*` to its matching BFF (see `proxy.conf.json`), so the browser sees a single origin and HttpOnly session cookies just work.

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
pnpm typecheck     # type-check all projects
pnpm graph         # open the Nx project graph in your browser
pnpm format        # write prettier formatting
pnpm format:check  # CI-friendly format check

# Run one project's target:
nx serve client
nx build agent-bff
nx test ui
nx e2e client-e2e

# Affected-only (relative to main):
nx affected -t build
nx affected -t test
```

## Repo layout

```
apps/
  client/              # consumer-facing Angular app  (port 4200, proxy → 3001)
  client-bff/          # Fastify BFF — magic-link + OTP (port 3001)
  agent/               # agent-facing Angular app     (port 4201, proxy → 3002)
  agent-bff/           # Fastify BFF — OIDC (stubbed) (port 3002)
  client-e2e/          # Playwright e2e for client
  agent-e2e/           # Playwright e2e for agent
libs/
  shared/
    ui/                  # Spartan-style component lib (HlmButton + cn helper)
    ui-tailwind-preset/  # shared Tailwind preset (HSL CSS-var design tokens)
  bff/
    contracts/           # zod schemas + inferred TS types (shared FE+BE)
    core/                # Fastify factory + plugins + AppError + env loader
docs/
  architecture-decisions.md   # the pitch / decision log
  bff-latency.md              # latency reasoning for the BFF pattern
```

## Path aliases

| Import path | Resolves to |
|---|---|
| `@aic/shared/ui` | UI components / directives |
| `@aic/shared/ui-tailwind-preset` | Shared Tailwind config preset |
| `@aic/bff/contracts` | Zod schemas + inferred types |
| `@aic/bff/core` | Fastify factory, plugins, guards, env loader |

## How the BFFs serve workspace deps

Both BFFs build with `@nx/esbuild` (`bundle: false`). Nx injects a tiny runtime resolver into `main.js` that maps `@aic/*` imports to source files copied alongside the output. So even without bundling, the dist is self-contained and `node dist/apps/<bff>/main.js` works after a build.

## Status

POC scaffold complete. Next priorities (not done):

- [ ] Real Azure AD OIDC provider (`apps/agent-bff/src/auth/azure-provider.ts` using `openid-client`)
- [ ] Storybook for `libs/shared/ui`
- [ ] More Spartan components (input, card, dialog) via `@spartan-ng/cli`
- [ ] Real downstream insurance API client in `libs/bff/core` (or per-BFF data lib)
- [ ] CI pipeline (`nx affected` against `main`)
- [ ] Production Dockerfiles + compose for prod-shaped local run
