import { randomUUID } from 'node:crypto';
import type { SessionUser } from '@aic/bff/contracts';
import { badRequest } from '@aic/bff/core';
import type { OidcProvider } from './oidc-provider';

/**
 * Stub OIDC provider — bypasses any real IdP. The "authorize" step
 * redirects the browser straight back to the BFF's callback with a
 * canned code, and the "callback" step returns a fixed agent user.
 *
 * Swap for `AzureOidcProvider` (real `openid-client` flow) when an Entra
 * tenant + app registration is available.
 */
export class StubOidcProvider implements OidcProvider {
  constructor(private readonly bffOrigin: string) {}

  async authorize(_returnTo: string) {
    const state = randomUUID();
    const callback = new URL('/api/auth/callback', this.bffOrigin);
    callback.searchParams.set('code', 'stub-code');
    callback.searchParams.set('state', state);
    return { redirectUrl: callback.toString(), state };
  }

  async callback({
    state,
    expectedState,
  }: {
    code: string;
    state: string;
    expectedState: string;
  }): Promise<SessionUser> {
    if (state !== expectedState) {
      throw badRequest('OIDC_STATE_MISMATCH', 'OIDC state did not match');
    }
    return {
      id: 'stub-agent-1',
      email: 'agent.stub@aic.local',
      displayName: 'Stub Agent',
      audience: 'agent',
      roles: ['agent', 'claims:read', 'claims:write'],
    };
  }
}
