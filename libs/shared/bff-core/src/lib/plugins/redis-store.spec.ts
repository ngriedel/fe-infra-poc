import type { Redis } from 'ioredis';
import type { Session } from 'fastify';
import { RedisSessionStore } from './redis-store';

/** Just enough of ioredis for the store: get/set/del over a Map. */
function fakeRedis(seed: Record<string, string> = {}) {
  const data = new Map(Object.entries(seed));
  return {
    data,
    client: {
      get: (k: string) => Promise.resolve(data.get(k) ?? null),
      set: (k: string, v: string) => {
        data.set(k, v);
        return Promise.resolve('OK');
      },
      del: (k: string) => {
        data.delete(k);
        return Promise.resolve(1);
      },
    } as unknown as Redis,
  };
}

describe('RedisSessionStore', () => {
  it('round-trips a session', (done) => {
    const { client } = fakeRedis();
    const store = new RedisSessionStore(client, 60);
    const session = { user: { id: 'u1' } } as unknown as Session;

    store.set('abc', session, () => {
      store.get('abc', (err, got) => {
        expect(err).toBeNull();
        expect(got).toEqual({ user: { id: 'u1' } });
        done();
      });
    });
  });

  it('reports a missing session as null', (done) => {
    const { client } = fakeRedis();
    new RedisSessionStore(client, 60).get('nope', (err, got) => {
      expect(err).toBeNull();
      expect(got).toBeNull();
      done();
    });
  });

  /**
   * Regression. A corrupt value used to make `JSON.parse` throw inside the
   * promise handler, which escaped as an unhandled rejection and killed the
   * process — repeatably, since the bad key outlived the restart.
   */
  it('treats a corrupt value as no session instead of crashing', (done) => {
    const { client, data } = fakeRedis({ 'sess:bad': 'not json at all {' });
    new RedisSessionStore(client, 60).get('bad', (err, got) => {
      expect(err).toBeNull();
      expect(got).toBeNull();
      // and the poison key is removed so it cannot recur
      setImmediate(() => {
        expect(data.has('sess:bad')).toBe(false);
        done();
      });
    });
  });

  it('propagates a real Redis failure to the callback', (done) => {
    const client = {
      get: () => Promise.reject(new Error('connection lost')),
    } as unknown as Redis;
    new RedisSessionStore(client, 60).get('x', (err) => {
      expect(err).toBeInstanceOf(Error);
      done();
    });
  });
});
