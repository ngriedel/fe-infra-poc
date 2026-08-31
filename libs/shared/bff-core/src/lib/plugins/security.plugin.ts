import fp from 'fastify-plugin';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import { forbidden } from '../errors';

export interface SecurityPluginOptions {
  /** Allowed CORS origin (the matching frontend). Must be exact. */
  corsOrigin: string;
  /** Gates the CSP: relaxed outside production, strict in production. */
  nodeEnv: 'development' | 'test' | 'production';
}

/** Methods that can change state, and so need CSRF cover. */
const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

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

  /**
   * CSRF defence-in-depth on cookie-authed state changes.
   *
   * Note CORS does NOT cover this. A cross-site form POST is a "simple request"
   * — no preflight — so the server still executes it; CORS only stops the
   * attacker reading the *response*. For CSRF the damage is done on write.
   *
   * `SameSite=lax` on the session cookie is the primary control. This adds the
   * case lax gets wrong: lax treats **same-site** as trusted, so a hostile
   * subdomain (`evil.aic.co.za` → `dealer.aic.co.za`) still gets the cookie
   * attached. `Sec-Fetch-Site` distinguishes `same-site` from `same-origin`, so
   * we can reject it.
   *
   * Both headers are browser-controlled "forbidden header names" — page script
   * can neither forge nor strip them — which is what makes them worth trusting.
   *
   * If NEITHER header is present we allow the request. That is deliberate: every
   * browser has sent `Origin` on cross-origin POSTs since CORS existed, so a
   * browser-driven attack always carries at least one. What's left is non-browser
   * callers (curl, health probes, service-to-service), which cannot mount CSRF
   * at all — they have no ambient cookie to borrow. An attacker crafting raw HTTP
   * would need the session cookie already, and CSRF defences were never a control
   * against stolen credentials.
   */
  app.addHook('onRequest', async (req) => {
    if (!UNSAFE_METHODS.has(req.method)) return;

    const site = req.headers['sec-fetch-site'];
    const origin = req.headers['origin'];

    if (typeof site === 'string' && site !== 'same-origin') {
      req.log.warn({ site, url: req.url }, 'Blocked cross-origin state change (Sec-Fetch-Site)');
      throw forbidden('CROSS_ORIGIN_BLOCKED', 'Cross-origin requests are not allowed');
    }
    if (typeof origin === 'string' && origin !== opts.corsOrigin) {
      req.log.warn({ origin, url: req.url }, 'Blocked cross-origin state change (Origin)');
      throw forbidden('CROSS_ORIGIN_BLOCKED', 'Cross-origin requests are not allowed');
    }
    if (site === undefined && origin === undefined) {
      // Not reachable from a browser — logged so it stays visible rather than silent.
      req.log.debug({ url: req.url }, 'State change with no Origin/Sec-Fetch-Site (non-browser)');
    }
  });
});
