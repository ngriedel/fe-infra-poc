import Fastify, { type FastifyServerOptions } from 'fastify';
import {
  type ZodTypeProvider,
  serializerCompiler,
  validatorCompiler,
} from 'fastify-type-provider-zod';
import { securityPlugin } from './plugins/security.plugin';
import { secureSessionPlugin } from './plugins/secure-session.plugin';
import { errorHandlerPlugin } from './plugins/error-handler.plugin';

export interface CreateBffServerOptions {
  nodeEnv: 'development' | 'test' | 'production';
  sessionSecret: string;
  frontendOrigin: string;
  logPretty: boolean;
}

/**
 * Build a Fastify instance with the AIC BFF baseline:
 *   - Pino logger (pretty in dev)
 *   - Zod request/response validation + serialization
 *   - Helmet + CORS locked to the matching frontend origin
 *   - Secure cookie session
 *   - Centralised error → JSON-envelope mapping
 *
 * Caller adds routes + per-app plugins.
 */
export async function createBffServer(opts: CreateBffServerOptions) {
  const fastifyOpts: FastifyServerOptions = {
    logger: opts.logPretty
      ? {
          level: 'info',
          transport: { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss.l' } },
        }
      : { level: 'info' },
  };

  const app = Fastify(fastifyOpts).withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(securityPlugin, { corsOrigin: opts.frontendOrigin });
  await app.register(secureSessionPlugin, {
    secret: opts.sessionSecret,
    secure: opts.nodeEnv === 'production',
  });
  await app.register(errorHandlerPlugin);

  return app;
}

export type BffServer = Awaited<ReturnType<typeof createBffServer>>;
