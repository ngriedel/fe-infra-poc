import fp from 'fastify-plugin';
import { ZodError } from 'zod';
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
    if (err instanceof ZodError) {
      req.log.warn({ issues: err.issues }, 'Validation error');
      return reply.status(400).send({
        code: 'VALIDATION_ERROR',
        message: 'Invalid request payload',
        details: { issues: err.issues },
      });
    }
    req.log.error({ err }, 'Unhandled error');
    return reply.status(500).send({
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong',
    });
  });
});
