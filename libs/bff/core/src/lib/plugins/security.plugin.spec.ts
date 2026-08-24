import Fastify, { type FastifyInstance } from 'fastify';
import { securityPlugin } from './security.plugin';
import { errorHandlerPlugin } from './error-handler.plugin';

const FRONTEND = 'http://localhost:4200';

/**
 * Bare server with just the security + error plugins — no session, no Redis.
 * Enough to exercise the CSRF hook in isolation.
 */
async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify();
  await app.register(securityPlugin, { corsOrigin: FRONTEND, nodeEnv: 'test' });
  await app.register(errorHandlerPlugin);
  app.post('/api/thing', async () => ({ ok: true }));
  app.get('/api/thing', async () => ({ ok: true }));
  await app.ready();
  return app;
}

describe('securityPlugin CSRF hook', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
  });
  afterAll(async () => {
    await app.close();
  });

  it('blocks a cross-site state change', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/thing',
      headers: { 'sec-fetch-site': 'cross-site' },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toMatchObject({ code: 'CROSS_ORIGIN_BLOCKED' });
  });

  // The reason this hook exists: SameSite=lax treats same-site as trusted, so a
  // hostile SUBDOMAIN still gets the session cookie attached. Sec-Fetch-Site is
  // what lets us tell same-site apart from same-origin and refuse it.
  it('blocks a same-site (hostile subdomain) state change', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/thing',
      headers: { 'sec-fetch-site': 'same-site' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('blocks a state change carrying a foreign Origin', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/thing',
      headers: { origin: 'http://evil.example.com' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('allows a genuine same-origin browser POST', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/thing',
      headers: { 'sec-fetch-site': 'same-origin', origin: FRONTEND },
    });
    expect(res.statusCode).toBe(200);
  });

  // Deliberate fail-open: no browser can be made to omit both headers, so what
  // reaches here is a non-browser caller, which has no ambient cookie to borrow
  // and therefore cannot mount CSRF at all.
  it('allows a request with neither header (non-browser caller)', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/thing' });
    expect(res.statusCode).toBe(200);
  });

  it('leaves safe methods alone', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/thing',
      headers: { 'sec-fetch-site': 'cross-site' },
    });
    expect(res.statusCode).toBe(200);
  });
});
