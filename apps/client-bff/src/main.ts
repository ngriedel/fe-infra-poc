import { createBffServer, registerSessionRoutes } from '@aic/bff/core';
import { env } from './env';
import { registerAuthRoutes } from './auth/routes';
import { registerHealthRoutes } from './routes/health';

async function start(): Promise<void> {
  const app = await createBffServer({
    nodeEnv: env.NODE_ENV,
    sessionSecret: env.SESSION_SECRET,
    frontendOrigin: env.FRONTEND_ORIGIN,
    logPretty: env.LOG_PRETTY,
  });

  await registerHealthRoutes(app);
  await registerSessionRoutes(app);
  await registerAuthRoutes(app, { exposeDevOtp: env.NODE_ENV !== 'production' });

  try {
    await app.listen({ host: env.HOST, port: env.PORT });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
