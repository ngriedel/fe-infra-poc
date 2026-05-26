# AIC POC

Nx monorepo with two Angular frontends (client + agent insurance) and a Fastify BFF per frontend.

See [docs/architecture-decisions.md](docs/architecture-decisions.md) for the why behind every structural choice.

## Stack

- **Monorepo**: Nx + pnpm workspaces
- **Frontends**: Angular (standalone, signals, esbuild) — `apps/client`, `apps/agent`
- **Backends**: Fastify (per-frontend BFF) — `apps/client-bff`, `apps/agent-bff`
- **UI**: Spartan NG + Tailwind, Angular CDK underneath
- **Validation**: Zod schemas shared via `libs/bff/contracts`
- **Auth**: Magic link + OTP (client) · Azure AD OIDC (agent — stubbed in dev)

## Prerequisites

- Node **24 LTS** (see `.nvmrc`)
- pnpm **10+**

## Setup

```bash
pnpm install
```

## Run everything in dev

```bash
pnpm dev
```

Runs all four apps in parallel via `nx run-many`. Individual targets:

```bash
nx serve client
nx serve agent
nx serve client-bff
nx serve agent-bff
```

## Common tasks

```bash
pnpm build       # build all projects
pnpm test        # run all unit tests
pnpm lint        # lint all projects
pnpm typecheck   # type-check all projects
pnpm graph       # open the Nx project graph
```

## Repo layout

```
apps/
  client/          # consumer-facing Angular app
  client-bff/      # Fastify BFF for the client app
  agent/           # agent-facing Angular app
  agent-bff/       # Fastify BFF for the agent app
libs/
  shared/
    ui/                  # Spartan NG wrappers + Tailwind preset
    ui-tailwind-preset/  # shared tailwind.preset.ts
    data-access/         # typed HTTP clients + zod-inferred types
    util/                # pure helpers
    auth/                # frontend auth primitives
  bff/
    core/                # shared Fastify plugins
    contracts/           # zod schemas (shared with frontend)
    auth-magic-link/     # client BFF auth strategy
    auth-oidc-azure/     # agent BFF auth strategy (stubbed in dev)
  domain/
    insurance/           # pure domain models
docs/
  architecture-decisions.md
  bff-latency.md
```

## Status

POC scaffold in progress — see commit history for what's been wired up.
