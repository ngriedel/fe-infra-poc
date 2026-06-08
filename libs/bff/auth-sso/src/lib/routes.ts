import { z } from 'zod';
import { badRequest, type BffServer } from '@aic/bff/core';
import type { OidcProvider } from './oidc-provider';

const STATE_COOKIE = 'oidc_state';

const loginQuerySchema = z.object({
  returnTo: z.string().default('/'),
});

const callbackQuerySchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
});

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
    schema: { querystring: loginQuerySchema },
    handler: async (req, reply) => {
      const { returnTo } = req.query;
      const { redirectUrl, state } = await opts.provider.authorize(returnTo);
      reply.setCookie(STATE_COOKIE, JSON.stringify({ state, returnTo }), {
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
    schema: { querystring: callbackQuerySchema },
    handler: async (req, reply) => {
      const cookieRaw = req.cookies[STATE_COOKIE];
      if (!cookieRaw) throw badRequest('OIDC_STATE_MISMATCH', 'Missing OIDC state cookie');
      const unsigned = req.unsignCookie(cookieRaw);
      if (!unsigned.valid || !unsigned.value) {
        throw badRequest('OIDC_STATE_MISMATCH', 'OIDC state cookie tampered with');
      }
      const { state: expectedState, returnTo } = JSON.parse(unsigned.value) as {
        state: string;
        returnTo: string;
      };

      const user = await opts.provider.callback({
        code: req.query.code,
        state: req.query.state,
        expectedState,
      });

      req.session.set('user', user);
      reply.clearCookie(STATE_COOKIE, { path: '/' });

      return reply.redirect(returnTo || opts.postLoginDefault);
    },
  });
}
