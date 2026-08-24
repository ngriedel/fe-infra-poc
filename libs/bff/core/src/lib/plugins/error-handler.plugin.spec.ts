import Fastify, { type FastifyInstance } from 'fastify';
import { errorHandlerPlugin } from './error-handler.plugin';
import { badRequest, forbidden, unauthenticated } from '../errors';

/** A Fastify-style error: carries its own statusCode and code, like plugins throw. */
function httpError(statusCode: number, code?: string): Error {
  return Object.assign(new Error('boom'), { statusCode, code });
}

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify();
  await app.register(errorHandlerPlugin);
  app.get('/app-error', async () => {
    throw badRequest('INVALID_OTP', 'That code is not correct.');
  });
  app.get('/unauthenticated', async () => {
    throw unauthenticated();
  });
  app.get('/forbidden', async () => {
    throw forbidden('CROSS_ORIGIN_BLOCKED', 'nope');
  });
  app.get('/rate-limited', async () => {
    throw httpError(429, 'FST_ERR_RATE_LIMIT');
  });
  app.get('/too-large', async () => {
    throw httpError(413, 'FST_ERR_CTP_BODY_TOO_LARGE');
  });
  app.get('/plugin-500', async () => {
    throw httpError(503, 'FST_ERR_SOMETHING');
  });
  app.get('/unknown', async () => {
    throw new Error('kaboom: leaky internal detail');
  });
  await app.ready();
  return app;
}

describe('errorHandlerPlugin', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
  });
  afterAll(async () => {
    await app.close();
  });

  it('maps an AppError to its own status and code', async () => {
    const res = await app.inject({ method: 'GET', url: '/app-error' });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ code: 'INVALID_OTP' });
  });

  it.each([
    ['/unauthenticated', 401, 'UNAUTHENTICATED'],
    ['/forbidden', 403, 'CROSS_ORIGIN_BLOCKED'],
  ])('maps %s to %i', async (url, status, code) => {
    const res = await app.inject({ method: 'GET', url });
    expect(res.statusCode).toBe(status);
    expect(res.json()).toMatchObject({ code });
  });

  // Regression: every unrecognised throwable used to be flattened to a 500, so
  // the rate limiter's 429 surfaced as INTERNAL_ERROR and the client had no way
  // to tell "slow down" from "the server broke".
  it('preserves a plugin 429 and gives it a client-facing code', async () => {
    const res = await app.inject({ method: 'GET', url: '/rate-limited' });
    expect(res.statusCode).toBe(429);
    expect(res.json()).toMatchObject({ code: 'RATE_LIMITED' });
  });

  // Same regression, different symptom: an oversized body is a client mistake,
  // not a server fault.
  it('preserves a plugin 413', async () => {
    const res = await app.inject({ method: 'GET', url: '/too-large' });
    expect(res.statusCode).toBe(413);
    expect(res.json()).toMatchObject({ code: 'FST_ERR_CTP_BODY_TOO_LARGE' });
  });

  it('does NOT pass a plugin 5xx through — that stays opaque', async () => {
    const res = await app.inject({ method: 'GET', url: '/plugin-500' });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toMatchObject({ code: 'INTERNAL_ERROR' });
  });

  it('never leaks an unknown error message to the client', async () => {
    const res = await app.inject({ method: 'GET', url: '/unknown' });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toMatchObject({ code: 'INTERNAL_ERROR' });
    expect(res.body).not.toContain('leaky internal detail');
  });
});
