import type { SessionUser } from '@aic/bff/contracts';

export interface OidcAuthorizeResult {
  /** Where to redirect the browser (IdP login page, or the callback in stub). */
  redirectUrl: string;
  /** Opaque state to round-trip through the IdP. */
  state: string;
}

export interface OidcProvider {
  /** Begin a login. Caller is responsible for persisting `state` in a cookie. */
  authorize(returnTo: string): Promise<OidcAuthorizeResult>;
  /** Exchange the callback code+state for a session user. */
  callback(params: { code: string; state: string; expectedState: string }): Promise<SessionUser>;
}
