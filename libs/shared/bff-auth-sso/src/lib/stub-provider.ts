import { randomUUID } from 'node:crypto';
import type { SessionUser } from '@aic-shared/contracts';
import { badRequest } from '@aic-shared/bff-core';
import type { OidcAuthorizeResult, OidcCallbackParams, OidcProvider } from './oidc-provider';

/** The canned identity returned when no overrides are supplied (agent BFF). */
const DEFAULT_STUB_USER: SessionUser = {
  id: 'stub-agent-1',
  email: 'agent.stub@aic.local',
  displayName: 'Stub Agent',
  audience: 'agent',
  roles: ['agent', 'claims:read', 'claims:write'],
};

/**
 * Stub OIDC provider — bypasses any real IdP. The "authorize" step
 * redirects the browser straight back to the BFF's callback with a
 * canned code, and the "callback" step returns a fixed user.
 *
 * Pass `overrides` to mint a per-app stub identity (e.g. a dealer/broker
 * audience). Swap the whole thing for `EntraOidcProvider` (real
 * `openid-client` flow) when an Entra tenant + app registration is available.
 */
export class StubOidcProvider implements OidcProvider {
  private readonly user: SessionUser;

  constructor(
    private readonly bffOrigin: string,
    overrides: Partial<SessionUser> = {},
  ) {
    this.user = { ...DEFAULT_STUB_USER, ...overrides };
  }

  async authorize(_returnTo: string): Promise<OidcAuthorizeResult> {
    const state = randomUUID();
    const callback = new URL('/api/auth/callback', this.bffOrigin);
    callback.searchParams.set('code', 'stub-code');
    callback.searchParams.set('state', state);
    return { redirectUrl: callback.toString(), state, nonce: randomUUID(), codeVerifier: 'stub' };
  }

  async callback({ state, expectedState }: OidcCallbackParams): Promise<SessionUser> {
    if (state !== expectedState) {
      throw badRequest('OIDC_STATE_MISMATCH', 'OIDC state did not match');
    }
    return this.user;
  }
}
