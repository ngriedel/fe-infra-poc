import type { SessionUser } from '@aic-shared/contracts';

export interface OidcAuthorizeResult {
  /** Where to redirect the browser (IdP authorize URL, or the callback in the stub). */
  redirectUrl: string;
  /** Opaque CSRF state to round-trip through the IdP. */
  state: string;
  /** Replay-binding nonce; the provider validates it against the id_token on callback. */
  nonce: string;
  /** PKCE code verifier; exchanged with the authorization code on callback. */
  codeVerifier: string;
}

/** Everything the callback route hands back to the provider to complete login. */
export interface OidcCallbackParams {
  /** Authorization code from the IdP redirect. */
  code: string;
  /** State from the IdP redirect. */
  state: string;
  /** State the route persisted at authorize time (compared centrally + by the provider). */
  expectedState: string;
  /** Nonce the route persisted at authorize time (validated against the id_token). */
  nonce: string;
  /** PKCE verifier the route persisted at authorize time. */
  codeVerifier: string;
}

/**
 * The per-app seam for SSO. An implementation owns which IdP is used, the PKCE/
 * nonce handshake, and how its claims map to our `SessionUser`; the shared routes
 * own the state/nonce/verifier cookie and the wiring.
 */
export interface OidcProvider {
  /**
   * Begin a login. Returns the IdP redirect plus the state/nonce/verifier the
   * caller must persist (signed cookie) until the callback.
   */
  authorize(returnTo: string): Promise<OidcAuthorizeResult>;
  /** Exchange the callback code for a session user, validating state/nonce/PKCE. */
  callback(params: OidcCallbackParams): Promise<SessionUser>;
}
