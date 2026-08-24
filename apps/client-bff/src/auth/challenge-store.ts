import { createHmac, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import type { Redis } from 'ioredis';

export interface Challenge {
  id: string;
  email: string;
  /** The plaintext OTP. Returned ONLY at creation, to be mailed — never stored. */
  otp: string;
  expiresAt: number;
}

export type VerifyResult = { email: string } | { error: 'NOT_FOUND' | 'BAD_CODE' };

const TTL_SECONDS = 10 * 60;
const MAX_ATTEMPTS = 5;
const KEY_PREFIX = 'otp:';

/**
 * Redis-backed one-time-code store for the public (client) tier.
 *
 * Two deliberate properties:
 *
 * 1. **The code is never stored.** Only an HMAC of it is, keyed by the server
 *    secret and salted with the challenge id. Someone who dumps Redis still
 *    can't read or precompute live codes without the secret.
 * 2. **Expiry is Redis's job.** The key carries a TTL, so an expired challenge
 *    is simply absent — there's no separate sweep, and no window where an
 *    expired record is still readable.
 *
 * Attempts are counted server-side with `HINCRBY` (atomic) and the challenge is
 * destroyed after `MAX_ATTEMPTS` wrong guesses, so the 6-digit space can't be
 * walked.
 */
export class ChallengeStore {
  constructor(
    private readonly redis: Redis,
    /** Server-side pepper. The stored hash is useless without it. */
    private readonly secret: string,
  ) {}

  /** Create a challenge with a fresh CSPRNG 6-digit code. */
  async create(email: string): Promise<Challenge> {
    const id = randomUUID();
    // randomInt is CSPRNG-backed and unbiased — not Math.random().
    const otp = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const expiresAt = Date.now() + TTL_SECONDS * 1000;

    const key = KEY_PREFIX + id;
    await this.redis
      .multi()
      .hset(key, {
        email: email.toLowerCase(),
        otpHash: this.hash(id, otp),
        expiresAt: String(expiresAt),
        attempts: '0',
      })
      .expire(key, TTL_SECONDS)
      .exec();

    return { id, email: email.toLowerCase(), otp, expiresAt };
  }

  /**
   * Check a submitted code. Consumes the challenge on success, and destroys it
   * once too many wrong guesses have been made.
   */
  async verify(challengeId: string, code: string): Promise<VerifyResult> {
    const key = KEY_PREFIX + challengeId;
    const record = await this.redis.hgetall(key);
    // Absent covers both "never existed" and "TTL expired" — the caller maps
    // both to the same client-facing error so neither leaks more than the other.
    if (!record || !record['otpHash']) return { error: 'NOT_FOUND' };

    if (!this.matches(record['otpHash'], this.hash(challengeId, code))) {
      const attempts = await this.redis.hincrby(key, 'attempts', 1);
      if (attempts >= MAX_ATTEMPTS) await this.redis.del(key);
      return { error: 'BAD_CODE' };
    }

    await this.redis.del(key);
    return { email: record['email'] ?? '' };
  }

  /**
   * HMAC-SHA256 of the code, keyed by the server secret and salted with the
   * challenge id so the same code in two challenges hashes differently.
   */
  private hash(challengeId: string, code: string): string {
    return createHmac('sha256', this.secret).update(`otp:${challengeId}:${code}`).digest('hex');
  }

  /** Constant-time compare, so a wrong code can't be narrowed by timing. */
  private matches(a: string, b: string): boolean {
    const bufA = Buffer.from(a, 'hex');
    const bufB = Buffer.from(b, 'hex');
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
  }
}
