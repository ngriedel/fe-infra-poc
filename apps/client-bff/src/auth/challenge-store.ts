import { randomUUID } from 'node:crypto';

interface Challenge {
  id: string;
  email: string;
  otp: string;
  expiresAt: number;
}

const TEN_MINUTES_MS = 10 * 60 * 1000;

/**
 * In-memory magic-link challenge store. Sufficient for a single-instance
 * POC. Production would back this with Redis or a DB so multiple BFF
 * instances share state.
 */
export class ChallengeStore {
  private readonly byId = new Map<string, Challenge>();

  create(email: string, otp: string): Challenge {
    this.purgeExpired();
    const challenge: Challenge = {
      id: randomUUID(),
      email: email.toLowerCase(),
      otp,
      expiresAt: Date.now() + TEN_MINUTES_MS,
    };
    this.byId.set(challenge.id, challenge);
    return challenge;
  }

  verify(challengeId: string, code: string): Challenge | { error: 'NOT_FOUND' | 'EXPIRED' | 'BAD_CODE' } {
    const c = this.byId.get(challengeId);
    if (!c) return { error: 'NOT_FOUND' };
    if (Date.now() > c.expiresAt) {
      this.byId.delete(challengeId);
      return { error: 'EXPIRED' };
    }
    if (c.otp !== code) return { error: 'BAD_CODE' };
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
