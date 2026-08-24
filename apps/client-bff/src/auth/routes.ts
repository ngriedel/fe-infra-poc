import {
  requestMagicLinkRequestSchema,
  requestMagicLinkResponseSchema,
  verifyOtpRequestSchema,
  sessionResponseSchema,
  type SessionUser,
} from '@aic/bff/contracts';
import { badRequest, type BffServer, requireSession, unauthenticated } from '@aic/bff/core';
import { ChallengeStore } from './challenge-store';
import type { Mailer } from './mailer';

export interface AuthRoutesOptions {
  /**
   * Return the generated OTP in the response so the dev UI can auto-fill it.
   * Defaults OFF even in dev, so the normal path exercises the real mail send
   * (read it at http://localhost:8025). Must never be true in production.
   */
  exposeDevOtp: boolean;
  mailer: Mailer;
  /**
   * Pepper for hashing OTPs at rest. Passed in rather than decorated onto the
   * app so the secret doesn't become ambiently readable by every plugin.
   */
  otpSecret: string;
}

export async function registerAuthRoutes(app: BffServer, opts: AuthRoutesOptions): Promise<void> {
  // Peppered, so the stored HMAC is useless to anyone who only has Redis.
  const challenges = new ChallengeStore(app.redis, opts.otpSecret);

  /**
   * Issue an OTP challenge and mail the code.
   *
   * Always returns a challenge, whatever the address — this tier has no
   * accounts, so there is nothing to enumerate, and the shape stays uniform.
   */
  app.post('/api/auth/request', {
    // Tight limit: this endpoint sends mail, so it's the expensive one to abuse.
    config: { rateLimit: { max: 5, timeWindow: '10 minutes' } },
    schema: {
      body: requestMagicLinkRequestSchema,
      response: { 200: requestMagicLinkResponseSchema },
    },
    handler: async (req) => {
      const { email } = req.body;
      const challenge = await challenges.create(email);

      try {
        await opts.mailer.sendOtp(challenge.email, challenge.otp);
      } catch (err) {
        // Never log the code itself.
        req.log.error({ err, challengeId: challenge.id }, 'Failed to send OTP email');
        throw badRequest('INVALID_EMAIL', 'Could not send the verification code. Try again.');
      }

      req.log.info({ challengeId: challenge.id }, 'Issued OTP challenge');
      return {
        challengeId: challenge.id,
        expiresAt: new Date(challenge.expiresAt).toISOString(),
        ...(opts.exposeDevOtp ? { devOtp: challenge.otp } : {}),
      };
    },
  });

  /** Verify the OTP and create a session. */
  app.post('/api/auth/verify', {
    // Server-side attempts are already capped per challenge; this stops an
    // attacker cycling through fresh challenges to widen the guess budget.
    config: { rateLimit: { max: 10, timeWindow: '10 minutes' } },
    schema: {
      body: verifyOtpRequestSchema,
      response: { 200: sessionResponseSchema },
    },
    handler: async (req) => {
      const { challengeId, code } = req.body;
      const result = await challenges.verify(challengeId, code);
      if ('error' in result) {
        throw result.error === 'NOT_FOUND'
          ? badRequest('EXPIRED_CHALLENGE', 'That code has expired. Request a new one.')
          : badRequest('INVALID_OTP', 'That code is not correct.');
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
