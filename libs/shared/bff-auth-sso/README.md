# bff/shared-bff-auth-sso

Shared OIDC / SSO login flow for AIC BFFs.

Any BFF whose frontend authenticates via an identity provider (Azure Entra,
etc.) composes this on top of `@aic-shared/bff-core`:

```ts
import { createBffServer, registerSessionRoutes } from '@aic-shared/bff-core';
import { registerSsoAuthRoutes, StubOidcProvider } from '@aic-shared/bff-auth-sso';

const app = await createBffServer({ ...env });
await registerSessionRoutes(app);
await registerSsoAuthRoutes(app, {
  provider: new StubOidcProvider(bffOrigin), // or AzureOidcProvider
  postLoginDefault: '/',
});
```

The lib owns the route wiring (state cookie, authorize redirect, callback
exchange). The per-app concerns — which IdP, and how its claims map to a
`SessionUser` — are injected via the `OidcProvider`.
