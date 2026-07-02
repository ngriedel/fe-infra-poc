import fp from 'fastify-plugin';
import { ZodError } from 'zod';
import {
  hasZodFastifySchemaValidationErrors,
  isResponseSerializationError,
} from 'fastify-type-provider-zod';
import { AppError } from '../errors';

export const errorHandlerPlugin = fp(async (app) => {
  app.setErrorHandler((err, req, reply) => {
    if (err instanceof AppError) {
      req.log.warn({ code: err.code, status: err.status }, err.message);
      return reply.status(err.status).send({
        code: err.code,
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
      });
    }

    // Request validation from fastify-type-provider-zod (v6) is surfaced as a
    // Fastify schema-validation error — NOT a raw ZodError — so it must be
    // detected with this guard, or every bad request would fall through to 500.
    if (hasZodFastifySchemaValidationErrors(err)) {
      const issues = err.validation.map((v) => ({ path: v.instancePath, message: v.message }));
      req.log.warn({ issues }, 'Request validation failed');
      return reply.status(400).send({
        code: 'VALIDATION_ERROR',
        message: 'Invalid request payload',
        details: { issues },
      });
    }

    // A response that doesn't match its declared schema is a server bug: log the
    // detail server-side, but never leak the internal response shape to clients.
    if (isResponseSerializationError(err)) {
      req.log.error({ issues: err.cause.issues }, 'Response serialization failed');
      return reply.status(500).send({ code: 'INTERNAL_ERROR', message: 'Something went wrong' });
    }

    // Fallback for hand-rolled `.parse()` calls that throw a raw ZodError.
    if (err instanceof ZodError) {
      const issues = err.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
      req.log.warn({ issues }, 'Validation error');
      return reply.status(400).send({
        code: 'VALIDATION_ERROR',
        message: 'Invalid request payload',
        details: { issues },
      });
    }

    req.log.error({ err }, 'Unhandled error');
    return reply.status(500).send({
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong',
    });
  });
});
