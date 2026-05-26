# When using BFFs, is the extra latency a problem?

Short answer: usually no, and often the opposite — a well-placed BFF makes the user-perceived experience *faster*, not slower.

## Where the extra hop costs you

- One more network leg: browser → BFF → upstream API instead of browser → API. If the BFF sits in the same region/VNet as the upstream, that hop is typically 1–5 ms. Noticeable only for very chatty UIs that fire dozens of independent calls.
- Cold starts if you deploy the BFF as serverless (Azure Functions, Lambda). Keep it as a long-running Fastify process (Container Apps, App Service, AKS) and this disappears.
- An extra TLS handshake — mitigated by HTTP keep-alive between BFF and upstream (Fastify + `undici` does this by default).

## Where the BFF actually *wins* on latency

- **Request aggregation**: one browser round-trip instead of 3–5. On a mobile connection with 100 ms RTT, collapsing 4 calls into 1 saves ~300 ms — far more than the 2 ms you added.
- **Server-to-server calls** between BFF and upstream are on a fat, low-latency link; the slow leg is browser → edge.
- **Payload shaping**: strip fields the UI doesn't need → smaller responses → faster parse + render.
- **Caching** (in-memory, Redis) sits closer to the client than the upstream's cache would.
- **Auth/session work** (magic-link, Azure AD token exchange) happens once at the BFF instead of the browser juggling tokens.

## Rules of thumb for this stack (Angular + Fastify BFF + Azure AD)

- Co-locate each Fastify BFF with the API it fronts (same region, ideally same VNet). Don't put the BFF in `westeurope` calling an API in `eastus`.
- Turn on HTTP keep-alive + connection pooling to upstreams (Fastify defaults are fine; verify `undici` agent reuse).
- Stream/pipe large responses through the BFF rather than buffering.
- Measure end-to-end with real numbers (browser timing API) before optimizing — the BFF hop is almost never your p95 bottleneck.

## Bottom line

The latency tax is real but small and predictable; the auth, aggregation, and shaping wins almost always dominate. For this POC, keep the BFF.
