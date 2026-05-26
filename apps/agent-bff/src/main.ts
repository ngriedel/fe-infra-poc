import { createBffServer } from '@aic/bff/core';
import { env } from './env';
import { registerAuthRoutes } from './auth/routes';
import { registerHealthRoutes } from './routes/health';
import { StubOidcProvider } from './auth/stub-provider';
import type { OidcProvider } from './auth/oidc-provider';

function buildProvider(bffOrigin: string): OidcProvider {
  switch (env.OIDC_MODE) {
    case 'stub':
      return new StubOidcProvider(bffOrigin);
    case 'azure':
      throw new Error(
        'Azure OIDC provider not yet implemented — wire openid-client + AZURE_* env vars',
      );
  }
}

async function start(): Promise<void> {
  const app = await createBffServer({
    nodeEnv: env.NODE_ENV,
    sessionSecret: env.SESSION_SECRET,
    frontendOrigin: env.FRONTEND_ORIGIN,
    logPretty: env.LOG_PRETTY,
  });

  const bffOrigin = `http://${env.HOST === '0.0.0.0' ? 'localhost' : env.HOST}:${env.PORT}`;
  const provider = buildProvider(bffOrigin);

  await registerHealthRoutes(app);
  await registerAuthRoutes(app, { provider, postLoginDefault: env.POST_LOGIN_DEFAULT });

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
