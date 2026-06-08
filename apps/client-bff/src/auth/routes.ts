import {
  requestMagicLinkRequestSchema,
  requestMagicLinkResponseSchema,
  verifyOtpRequestSchema,
  sessionResponseSchema,
  type SessionUser,
} from '@aic/bff/contracts';
import { badRequest, type BffServer, requireSession, unauthenticated } from '@aic/bff/core';
import { ChallengeStore } from './challenge-store';

export async function registerAuthRoutes(app: BffServer, devFixedOtp: string): Promise<void> {
  const challenges = new ChallengeStore();

  /**
   * Issue a magic-link challenge. In dev, the response includes the OTP
   * so the frontend can auto-fill it. In production, the OTP is sent via
   * email and the response only contains the challengeId + expiry.
   */
  app.post('/api/auth/request', {
    schema: {
      body: requestMagicLinkRequestSchema,
      response: { 200: requestMagicLinkResponseSchema },
    },
    handler: async (req) => {
      const { email } = req.body;
      const challenge = challenges.create(email, devFixedOtp);
      req.log.info({ email, challengeId: challenge.id }, 'Issued magic link');
      return {
        challengeId: challenge.id,
        expiresAt: new Date(challenge.expiresAt).toISOString(),
        devOtp: devFixedOtp,
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
        const code =
          result.error === 'NOT_FOUND' || result.error === 'EXPIRED'
            ? 'EXPIRED_CHALLENGE'
            : 'INVALID_OTP';
        throw badRequest(code, 'Magic-link verification failed');
      }
      const user: SessionUser = {
        id: `client-${result.email}`,
        email: result.email,
        displayName: result.email.split('@')[0] ?? result.email,
        audience: 'client',
        roles: ['customer'],
      };
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
