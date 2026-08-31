import {
  createBffServer,
  registerSessionRoutes,
  registerGracefulShutdown,
} from '@aic-shared/bff-core';
import { env } from './env';
import { registerAuthRoutes } from './auth/routes';
import { createMailer } from './auth/mailer';
import { registerHealthRoutes } from './routes/health';

async function start(): Promise<void> {
  const app = await createBffServer({
    nodeEnv: env.NODE_ENV,
    sessionSecret: env.SESSION_SECRET,
    frontendOrigin: env.FRONTEND_ORIGIN,
    logPretty: env.LOG_PRETTY,
    redisUrl: env.REDIS_URL,
    audience: 'client',
    trustProxy: env.TRUST_PROXY,
  });

  const mailer = createMailer({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    from: env.MAIL_FROM,
  });

  await registerHealthRoutes(app);
  await registerSessionRoutes(app);
  await registerAuthRoutes(app, {
    exposeDevOtp: env.EXPOSE_DEV_OTP,
    mailer,
    // The session secret doubles as the OTP pepper — one secret per BFF to
    // rotate, and it never leaves the server.
    otpSecret: env.SESSION_SECRET,
  });

  registerGracefulShutdown(app);

  try {
    await app.listen({ host: env.HOST, port: env.PORT });
    app.log.info({ smtp: `${env.SMTP_HOST}:${env.SMTP_PORT}` }, 'client-bff ready');
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
