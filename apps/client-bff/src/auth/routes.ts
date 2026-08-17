import {
  requestMagicLinkRequestSchema,
  requestMagicLinkResponseSchema,
  verifyOtpRequestSchema,
  sessionResponseSchema,
  type SessionUser,
} from '@aic/bff/contracts';
import { badRequest, type BffServer, requireSession, unauthenticated } from '@aic/bff/core';
import { ChallengeStore } from './challenge-store';

export interface AuthRoutesOptions {
  /** Return the generated OTP in the response so the dev UI can auto-fill it. Must be false in prod. */
  exposeDevOtp: boolean;
}

export async function registerAuthRoutes(app: BffServer, opts: AuthRoutesOptions): Promise<void> {
  const challenges = new ChallengeStore();

  /**
   * Issue a magic-link challenge. In dev the response includes the OTP so the
   * frontend can auto-fill it; in production the OTP is delivered out-of-band
   * (email) and the response carries only the challengeId + expiry.
   */
  app.post('/api/auth/request', {
    schema: {
      body: requestMagicLinkRequestSchema,
      response: { 200: requestMagicLinkResponseSchema },
    },
    handler: async (req) => {
      const { email } = req.body;
      const challenge = challenges.create(email);
      // TODO(prod): deliver `challenge.otp` to `email` via the mailer.
      req.log.info({ challengeId: challenge.id }, 'Issued magic link');
      return {
        challengeId: challenge.id,
        expiresAt: new Date(challenge.expiresAt).toISOString(),
        ...(opts.exposeDevOtp ? { devOtp: challenge.otp } : {}),
      };
    },
  });

  /** Verify the OTP and create a session. */
  app.post('/api/auth/verify', {
    schema: {
      body: verifyOtpRequestSchema,
      response: { 200: sessionResponseSchema },
    },
    handler: async (req) => {
      const { challengeId, code } = req.body;
      const result = challenges.verify(challengeId, code);
      if ('error' in result) {
        const errorCode =
          result.error === 'NOT_FOUND' || result.error === 'EXPIRED'
            ? 'EXPIRED_CHALLENGE'
            : 'INVALID_OTP';
        throw badRequest(errorCode, 'Magic-link verification failed');
      }
      const user: SessionUser = {
        id: `client-${result.email}`,
        email: result.email,
        displayName: result.email.split('@')[0] ?? result.email,
        audience: 'client',
        roles: ['customer'],
      };
      // New server-side session id on auth (prevents session fixation).
      await req.session.regenerate();
      req.session.set('user', user);
      return { user };
    },
  });

  // Helpful error when /api/auth/session is hit unauthenticated and we want
  // a typed 401 envelope rather than the generic one.
  app.setNotFoundHandler({ preHandler: requireSession }, async () => {
    throw unauthenticated();
  });
}
