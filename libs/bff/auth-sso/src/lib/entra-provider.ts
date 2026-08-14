import { Issuer, generators, type Client, type IdTokenClaims } from 'openid-client';
import type { SessionUser } from '@aic/bff/contracts';
import { badRequest } from '@aic/bff/core';
import type { OidcAuthorizeResult, OidcCallbackParams, OidcProvider } from './oidc-provider';

export interface EntraOidcProviderConfig {
  /**
   * OIDC issuer/authority. Workforce (Entra ID): `https://login.microsoftonline.com/<tenant>/v2.0`.
   * External ID uses the tenant's CIAM authority.
   */
  authority: string;
  clientId: string;
  clientSecret: string;
  /**
   * Must EXACTLY match a redirect URI registered on the app AND the origin the
   * browser uses. In dev that is the Angular origin (proxied to this BFF), not
   * the BFF's own port — otherwise the state cookie won't travel to the callback.
   */
  redirectUri: string;
  /** The audience this BFF stamps onto the resulting SessionUser. */
  audience: SessionUser['audience'];
  /** Space-delimited scopes. Defaults to `openid profile email`. */
  scopes?: string;
}

/**
 * Real Entra (Azure AD / External ID) OIDC relying party via `openid-client`.
 *
 * Authorization-code flow with PKCE (S256) + nonce. The callback validates the
 * id_token (signature via JWKS, `iss`, `aud`, `exp`, and `nonce`) and maps the
 * claims onto our `SessionUser`. This one class serves SSO and email/password
 * apps alike — they differ only by `authority` + config.
 */
export class EntraOidcProvider implements OidcProvider {
  private clientPromise: Promise<Client> | null = null;

  constructor(private readonly cfg: EntraOidcProviderConfig) {}

  /** Discover the issuer + build the client once, then reuse across requests. */
  private client(): Promise<Client> {
    if (!this.clientPromise) {
      this.clientPromise = Issuer.discover(this.cfg.authority).then(
        (issuer) =>
          new issuer.Client({
            client_id: this.cfg.clientId,
            client_secret: this.cfg.clientSecret,
            redirect_uris: [this.cfg.redirectUri],
            response_types: ['code'],
          }),
      );
    }
    return this.clientPromise;
  }

  async authorize(_returnTo: string): Promise<OidcAuthorizeResult> {
    const client = await this.client();
    const codeVerifier = generators.codeVerifier();
    const codeChallenge = generators.codeChallenge(codeVerifier);
    const state = generators.state();
    const nonce = generators.nonce();
    const redirectUrl = client.authorizationUrl({
      scope: this.cfg.scopes ?? 'openid profile email',
      response_mode: 'query',
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      state,
      nonce,
    });
    return { redirectUrl, state, nonce, codeVerifier };
  }

  async callback(params: OidcCallbackParams): Promise<SessionUser> {
    const client = await this.client();
    let claims: IdTokenClaims;
    try {
      const tokenSet = await client.callback(
        this.cfg.redirectUri,
        { code: params.code, state: params.state },
        { code_verifier: params.codeVerifier, state: params.expectedState, nonce: params.nonce },
      );
      claims = tokenSet.claims();
    } catch {
      throw badRequest('OIDC_EXCHANGE_FAILED', 'Failed to complete the OIDC login');
    }
    return this.toSessionUser(claims);
  }

  private toSessionUser(claims: IdTokenClaims): SessionUser {
    // `oid` is the stable per-tenant user object id; `sub` is app+user specific.
    // `oid`/`roles` come from the id_token's custom-claim index signature → bracket access.
    const id = (claims['oid'] as string | undefined) ?? claims.sub;
    const email =
      (claims.email as string | undefined) ??
      (claims.preferred_username as string | undefined) ??
      `${id}@no-email.local`;
    const displayName = (claims.name as string | undefined) ?? email;
    const rawRoles = claims['roles'];
    const roles = Array.isArray(rawRoles) ? (rawRoles as string[]) : [];
    return { id, email, displayName, audience: this.cfg.audience, roles };
  }
}
