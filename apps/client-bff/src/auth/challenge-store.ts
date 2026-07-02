import { randomInt, randomUUID } from 'node:crypto';

interface Challenge {
  id: string;
  email: string;
  otp: string;
  expiresAt: number;
  attempts: number;
}

const TEN_MINUTES_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

/**
 * In-memory magic-link challenge store. Sufficient for a single-instance
 * POC. Production would back this with Redis or a DB so multiple BFF
 * instances share state (and should store a HASH of the OTP, not the code).
 */
export class ChallengeStore {
  private readonly byId = new Map<string, Challenge>();

  /** Create a challenge with a fresh CSPRNG 6-digit OTP. */
  create(email: string): Challenge {
    this.purgeExpired();
    const challenge: Challenge = {
      id: randomUUID(),
      email: email.toLowerCase(),
      otp: randomInt(0, 1_000_000).toString().padStart(6, '0'),
      expiresAt: Date.now() + TEN_MINUTES_MS,
      attempts: 0,
    };
    this.byId.set(challenge.id, challenge);
    return challenge;
  }

  verify(
    challengeId: string,
    code: string,
  ): Challenge | { error: 'NOT_FOUND' | 'EXPIRED' | 'BAD_CODE' } {
    const c = this.byId.get(challengeId);
    if (!c) return { error: 'NOT_FOUND' };
    if (Date.now() > c.expiresAt) {
      this.byId.delete(challengeId);
      return { error: 'EXPIRED' };
    }
    if (c.otp !== code) {
      // Invalidate the challenge after too many wrong guesses (brute-force guard).
      c.attempts += 1;
      if (c.attempts >= MAX_ATTEMPTS) this.byId.delete(challengeId);
      return { error: 'BAD_CODE' };
    }
    this.byId.delete(challengeId);
    return c;
  }

  private purgeExpired(): void {
    const now = Date.now();
    for (const [id, c] of this.byId) {
      if (now > c.expiresAt) this.byId.delete(id);
    }
  }
}
