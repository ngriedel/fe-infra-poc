import { createBffServer } from '@aic/bff/core';
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
  await registerAuthRoutes(app, env.DEV_FIXED_OTP);

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
