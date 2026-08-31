import type { FastifyReply, FastifyRequest } from 'fastify';
import type { SessionUser } from '@aic-shared/contracts';
import { requireSession } from './require-session';
import { AppError } from '../errors';

const dealer: SessionUser = {
  id: 'u1',
  email: 'someone@example.com',
  displayName: 'Someone',
  audience: 'dealer',
  roles: ['dealer'],
};

/**
 * Minimal stand-in for a request carrying (or not carrying) a session. Avoids
 * booting a server + Redis just to exercise a two-line guard.
 */
function makeReq(user: SessionUser | undefined, expectedAudience: string): FastifyRequest {
  return {
    session: { get: (key: string) => (key === 'user' ? user : undefined) },
    server: { expectedAudience },
  } as unknown as FastifyRequest;
}

const reply = {} as FastifyReply;

describe('requireSession', () => {
  it('accepts a session whose audience matches this BFF', async () => {
    const req = makeReq(dealer, 'dealer');
    await expect(requireSession(req, reply)).resolves.toBeUndefined();
    expect(req.user).toEqual(dealer);
  });

  it('rejects when there is no session at all', async () => {
    await expect(requireSession(makeReq(undefined, 'dealer'), reply)).rejects.toThrow(AppError);
  });

  /**
   * The isolation property. Ports don't scope cookies, so a browser really does
   * hold `sid.dealer` and `sid.broker` at once — this guard is the layer that
   * stops a dealer session being honoured as a broker one.
   */
  it('rejects a session minted for a different audience', async () => {
    const req = makeReq(dealer, 'broker');
    await expect(requireSession(req, reply)).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
      status: 401,
    });
    expect(req.user).toBeUndefined();
  });

  it.each(['client', 'agent', 'broker'] as const)(
    'a dealer session is refused by the %s BFF',
    async (audience) => {
      await expect(requireSession(makeReq(dealer, audience), reply)).rejects.toThrow(AppError);
    },
  );
});
