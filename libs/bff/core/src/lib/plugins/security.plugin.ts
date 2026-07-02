import fp from 'fastify-plugin';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';

export interface SecurityPluginOptions {
  /** Allowed CORS origin (the matching frontend). Must be exact. */
  corsOrigin: string;
  /** Gates the CSP: relaxed outside production, strict in production. */
  nodeEnv: 'development' | 'test' | 'production';
}

export const securityPlugin = fp(async (app, opts: SecurityPluginOptions) => {
  await app.register(helmet, {
    // These BFFs serve only JSON, so a strict CSP costs nothing in prod and is
    // the correct default; it's relaxed only outside production for dev tooling.
    contentSecurityPolicy:
      opts.nodeEnv === 'production' ? { directives: { defaultSrc: ["'none'"] } } : false,
  });
  await app.register(cors, {
    origin: opts.corsOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  });
});
