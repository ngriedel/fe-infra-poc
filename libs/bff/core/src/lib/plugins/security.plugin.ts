import fp from 'fastify-plugin';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';

export interface SecurityPluginOptions {
  /** Allowed CORS origin (the matching frontend). Must be exact. */
  corsOrigin: string;
}

export const securityPlugin = fp(async (app, opts: SecurityPluginOptions) => {
  await app.register(helmet, {
    // Angular dev server uses inline styles; relax for dev only.
    contentSecurityPolicy: false,
  });
  await app.register(cors, {
    origin: opts.corsOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  });
});
