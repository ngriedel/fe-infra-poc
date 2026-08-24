import fp from 'fastify-plugin';
import { ZodError } from 'zod';
import {
  hasZodFastifySchemaValidationErrors,
  isResponseSerializationError,
} from 'fastify-type-provider-zod';
import { AppError } from '../errors';

/**
 * Narrow an unknown throwable to the shape Fastify and its plugins use for
 * HTTP errors. `err` is `unknown` by the time we reach the fallback branches,
 * so this is the type-safe way to read a status off it.
 */
function asHttpError(err: unknown): { statusCode: number; code?: string; message: string } | null {
  if (typeof err !== 'object' || err === null) return null;
  const e = err as { statusCode?: unknown; code?: unknown; message?: unknown };
  if (typeof e.statusCode !== 'number') return null;
  return {
    statusCode: e.statusCode,
    code: typeof e.code === 'string' ? e.code : undefined,
    message: typeof e.message === 'string' ? e.message : 'Request failed',
  };
}

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

    // Errors raised by Fastify itself or its plugins already carry a status and
    // a code — @fastify/rate-limit's 429, a malformed JSON body's 400, and so
    // on. Without this branch every one of them was flattened to a 500, which
    // both misreports the problem and hides it from the client.
    // 4xx only: a plugin's 5xx should still surface as an opaque INTERNAL_ERROR.
    const http = asHttpError(err);
    if (http && http.statusCode >= 400 && http.statusCode < 500) {
      // Key off the status, not the plugin's internal error code — that code is
      // an implementation detail that changes between plugin majors.
      const code = http.statusCode === 429 ? 'RATE_LIMITED' : (http.code ?? 'BAD_REQUEST');
      req.log.warn({ code, statusCode: http.statusCode }, http.message);
      return reply.status(http.statusCode).send({ code, message: http.message });
    }

    req.log.error({ err }, 'Unhandled error');
    return reply.status(500).send({
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong',
    });
  });
});
