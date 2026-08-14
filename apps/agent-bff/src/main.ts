import { createBffServer, registerSessionRoutes } from '@aic/bff/core';
import {
  registerSsoAuthRoutes,
  StubOidcProvider,
  EntraOidcProvider,
  type OidcProvider,
} from '@aic/bff/auth-sso';
import { env } from './env';
import { registerHealthRoutes } from './routes/health';

function buildProvider(bffOrigin: string): OidcProvider {
  switch (env.OIDC_MODE) {
    case 'stub':
      if (env.NODE_ENV === 'production') {
        throw new Error('OIDC_MODE=stub is not allowed in production — set OIDC_MODE=azure');
      }
      return new StubOidcProvider(bffOrigin);
    case 'azure': {
      const { AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_REDIRECT_URI } = env;
      if (!AZURE_TENANT_ID || !AZURE_CLIENT_ID || !AZURE_CLIENT_SECRET || !AZURE_REDIRECT_URI) {
        throw new Error(
          'OIDC_MODE=azure requires AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_REDIRECT_URI',
        );
      }
      return new EntraOidcProvider({
        authority:
          env.AZURE_AUTHORITY ?? `https://login.microsoftonline.com/${AZURE_TENANT_ID}/v2.0`,
        clientId: AZURE_CLIENT_ID,
        clientSecret: AZURE_CLIENT_SECRET,
        redirectUri: AZURE_REDIRECT_URI,
        audience: 'agent',
      });
    }
  }
}

async function start(): Promise<void> {
  const app = await createBffServer({
    nodeEnv: env.NODE_ENV,
    sessionSecret: env.SESSION_SECRET,
    frontendOrigin: env.FRONTEND_ORIGIN,
    logPretty: env.LOG_PRETTY,
    audience: 'agent',
  });

  const bffOrigin = `http://${env.HOST === '0.0.0.0' ? 'localhost' : env.HOST}:${env.PORT}`;
  const provider = buildProvider(bffOrigin);

  await registerHealthRoutes(app);
  await registerSessionRoutes(app);
  await registerSsoAuthRoutes(app, { provider, postLoginDefault: env.POST_LOGIN_DEFAULT });

  try {
    await app.listen({ host: env.HOST, port: env.PORT });
    app.log.info({ mode: env.OIDC_MODE }, 'agent-bff ready');
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
