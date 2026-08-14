import {
  oidcCallbackQuerySchema,
  oidcLoginQuerySchema,
  safeReturnToSchema,
} from '@aic/bff/contracts';
import { badRequest, type BffServer } from '@aic/bff/core';
import type { OidcProvider } from './oidc-provider';

const STATE_COOKIE = 'oidc_state';

export interface SsoAuthRoutesOptions {
  provider: OidcProvider;
  /** Where to send the user after login when no `returnTo` was supplied. */
  postLoginDefault: string;
}

/**
 * Register the SSO login flow (`/api/auth/login` + `/api/auth/callback`).
 *
 * Session read + logout are NOT here — compose `registerSessionRoutes`
 * from `@aic/bff/core` alongside this.
 */
export async function registerSsoAuthRoutes(
  app: BffServer,
  opts: SsoAuthRoutesOptions,
): Promise<void> {
  /**
   * Begin login. Saves state + returnTo in a short-lived signed cookie,
   * then redirects to the IdP authorize URL.
   */
  app.get('/api/auth/login', {
    schema: { querystring: oidcLoginQuerySchema },
    handler: async (req, reply) => {
      const { returnTo } = req.query; // sanitized to a safe same-origin path by the schema
      const { redirectUrl, state, nonce, codeVerifier } = await opts.provider.authorize(returnTo);
      reply.setCookie(STATE_COOKIE, JSON.stringify({ state, nonce, codeVerifier, returnTo }), {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 5 * 60,
        signed: true,
      });
      return reply.redirect(redirectUrl);
    },
  });

  /**
   * IdP redirects back here with code+state. We verify state, exchange
   * via the provider, set the session cookie, then redirect to returnTo.
   */
  app.get('/api/auth/callback', {
    schema: { querystring: oidcCallbackQuerySchema },
    handler: async (req, reply) => {
      const cookieRaw = req.cookies[STATE_COOKIE];
      if (!cookieRaw) throw badRequest('OIDC_STATE_MISMATCH', 'Missing OIDC state cookie');
      const unsigned = req.unsignCookie(cookieRaw);
      if (!unsigned.valid || !unsigned.value) {
        throw badRequest('OIDC_STATE_MISMATCH', 'OIDC state cookie tampered with');
      }
      const { state: expectedState, nonce, codeVerifier, returnTo } = JSON.parse(unsigned.value) as {
        state: string;
        nonce: string;
        codeVerifier: string;
        returnTo: string;
      };

      // Defense in depth: enforce state centrally, not only inside the provider.
      if (req.query.state !== expectedState) {
        throw badRequest('OIDC_STATE_MISMATCH', 'OIDC state did not match');
      }

      const user = await opts.provider.callback({
        code: req.query.code,
        state: req.query.state,
        expectedState,
        nonce,
        codeVerifier,
      });

      req.session.set('user', user);
      reply.clearCookie(STATE_COOKIE, { path: '/' });

      // Defense in depth: returnTo was sanitized at login, but re-validate here
      // so we never redirect to a non-same-origin target (safeReturnToSchema
      // coerces anything unsafe back to '/').
      const safeReturnTo = safeReturnToSchema.parse(returnTo);
      return reply.redirect(safeReturnTo || opts.postLoginDefault);
    },
  });
}
