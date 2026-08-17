import type { Redis } from 'ioredis';
import type { Session } from 'fastify';

type ErrCallback = (err?: unknown) => void;
type GetCallback = (err: unknown, result?: Session | null) => void;

/**
 * Minimal Redis-backed session store for `@fastify/session`. Each session is a
 * JSON string under `sess:<id>` with a TTL, so sessions are shared across BFF
 * instances and expire server-side.
 *
 * A hand-rolled store (rather than `connect-redis`) keeps the dep tree CJS —
 * connect-redis's current majors are ESM-only and fight the BFFs' esbuild
 * (`bundle: false`, CJS) build, the same reason `openid-client@5` was chosen.
 */
export class RedisSessionStore {
  constructor(
    private readonly redis: Redis,
    private readonly ttlSeconds: number,
    private readonly prefix = 'sess:',
  ) {}

  set(sessionId: string, session: Session, callback: ErrCallback): void {
    this.redis
      .set(this.prefix + sessionId, JSON.stringify(session), 'EX', this.ttlSeconds)
      .then(() => callback(), callback);
  }

  get(sessionId: string, callback: GetCallback): void {
    this.redis.get(this.prefix + sessionId).then(
      (raw) => callback(null, raw ? (JSON.parse(raw) as Session) : null),
      (err) => callback(err),
    );
  }

  destroy(sessionId: string, callback: ErrCallback): void {
    this.redis.del(this.prefix + sessionId).then(() => callback(), callback);
  }
}
