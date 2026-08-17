# ESL stub (throwaway POC upstream)

A **temporary, throwaway** stand-in for the downstream insurance API ("ESL").

**It is deliberately NOT an Nx project** — no `project.json`, it lives outside
`apps/`/`libs/`, and it's listed in `.nxignore` and `.prettierignore`. Do not
wire it into the Nx graph, CI, lint, or the workspace tooling. Treat it as
disposable scaffolding for the end-to-end slice.

## Why it exists

The BFFs need a real OpenAPI source to generate the upstream **Zod contract**
against, and a real service that returns **user-scoped** data off the plain
identity headers the BFF forwards (`X-User-Id`, `X-User-Email`, `X-User-Roles`).
HMAC-wrapping those headers is a production concern and is intentionally skipped
in the POC.

## Run (via docker-compose at the repo root)

```bash
docker compose up -d esl        # build + start (first build downloads Maven deps)
```

Then:

- OpenAPI doc → http://localhost:8081/v3/api-docs
- Swagger UI  → http://localhost:8081/swagger-ui
- Data        → `curl -H 'X-User-Id: agent-1' http://localhost:8081/api/policies`

Stop with `docker compose down`.
