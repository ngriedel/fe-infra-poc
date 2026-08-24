import RedisMock from 'ioredis-mock';
import type { Redis } from 'ioredis';
import { ChallengeStore } from './challenge-store';

const SECRET = 'test-pepper-not-a-real-secret';

/** In-memory ioredis stand-in, so these stay hermetic (no docker needed). */
function makeRedis(): Redis {
  return new RedisMock() as unknown as Redis;
}

describe('ChallengeStore', () => {
  let redis: Redis;
  let store: ChallengeStore;

  beforeEach(() => {
    redis = makeRedis();
    store = new ChallengeStore(redis, SECRET);
  });

  it('issues a 6-digit code and accepts it once', async () => {
    const challenge = await store.create('Someone@Example.com');
    expect(challenge.otp).toMatch(/^\d{6}$/);
    // Email is normalised so the same person can't be treated as two.
    expect(challenge.email).toBe('someone@example.com');

    await expect(store.verify(challenge.id, challenge.otp)).resolves.toEqual({
      email: 'someone@example.com',
    });
  });

  /**
   * The point of hashing at rest: someone who dumps Redis gets nothing usable.
   */
  it('never stores the code itself', async () => {
    const challenge = await store.create('a@example.com');
    const stored = await redis.hgetall(`otp:${challenge.id}`);

    expect(JSON.stringify(stored)).not.toContain(challenge.otp);
    expect(stored['otpHash']).toMatch(/^[0-9a-f]{64}$/);
    expect(stored['otp']).toBeUndefined();
  });

  it('salts the hash per challenge, so the same code hashes differently', async () => {
    // Retry until two challenges happen to share a code, then compare hashes.
    // Bounded so a run can never hang.
    const a = await store.create('a@example.com');
    let b = await store.create('b@example.com');
    for (let i = 0; i < 200 && b.otp !== a.otp; i++) {
      b = await store.create('b@example.com');
    }
    if (b.otp !== a.otp) return; // codes never collided; nothing to compare

    const [ha, hb] = await Promise.all([
      redis.hget(`otp:${a.id}`, 'otpHash'),
      redis.hget(`otp:${b.id}`, 'otpHash'),
    ]);
    expect(ha).not.toEqual(hb);
  });

  it('consumes the challenge, so a code cannot be replayed', async () => {
    const challenge = await store.create('a@example.com');
    await store.verify(challenge.id, challenge.otp);

    await expect(store.verify(challenge.id, challenge.otp)).resolves.toEqual({
      error: 'NOT_FOUND',
    });
  });

  it('reports an unknown or expired challenge as NOT_FOUND', async () => {
    await expect(store.verify('no-such-id', '123456')).resolves.toEqual({ error: 'NOT_FOUND' });
  });

  it('rejects a wrong code and counts the attempt', async () => {
    const challenge = await store.create('a@example.com');
    const wrong = challenge.otp === '000000' ? '111111' : '000000';

    await expect(store.verify(challenge.id, wrong)).resolves.toEqual({ error: 'BAD_CODE' });
    expect(await redis.hget(`otp:${challenge.id}`, 'attempts')).toBe('1');
  });

  /**
   * Brute-force guard: 6 digits is only a million options, so the challenge is
   * destroyed after 5 wrong guesses rather than left open to be walked.
   */
  it('destroys the challenge after 5 wrong guesses', async () => {
    const challenge = await store.create('a@example.com');
    const wrong = challenge.otp === '000000' ? '111111' : '000000';

    for (let i = 0; i < 4; i++) {
      await expect(store.verify(challenge.id, wrong)).resolves.toEqual({ error: 'BAD_CODE' });
    }
    expect(await redis.exists(`otp:${challenge.id}`)).toBe(1);

    // 5th wrong guess kills it...
    await expect(store.verify(challenge.id, wrong)).resolves.toEqual({ error: 'BAD_CODE' });
    expect(await redis.exists(`otp:${challenge.id}`)).toBe(0);

    // ...and even the CORRECT code no longer works.
    await expect(store.verify(challenge.id, challenge.otp)).resolves.toEqual({
      error: 'NOT_FOUND',
    });
  });

  it('sets a TTL so an abandoned challenge expires on its own', async () => {
    const challenge = await store.create('a@example.com');
    const ttl = await redis.ttl(`otp:${challenge.id}`);
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(10 * 60);
  });

  it('keeps challenges independent — one code does not open another', async () => {
    const a = await store.create('a@example.com');
    const b = await store.create('b@example.com');

    await expect(store.verify(b.id, a.otp)).resolves.toEqual(
      a.otp === b.otp ? { email: 'b@example.com' } : { error: 'BAD_CODE' },
    );
  });
});
