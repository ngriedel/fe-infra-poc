import { z } from 'zod';

const baseEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().positive(),
  /**
   * 32-byte hex string used to encrypt the secure session cookie.
   * Generate with: `openssl rand -hex 32`
   */
  SESSION_SECRET: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, 'SESSION_SECRET must be a 64-char hex string (32 bytes)'),
  /** Origin of the matching frontend, used by CORS. */
  FRONTEND_ORIGIN: z.string().url(),
  /**
   * When true, log pretty (dev). When false, log NDJSON (prod).
   * Parsed as an explicit string enum — `z.coerce.boolean()` would turn the
   * string "false" into `true` (JS Boolean semantics), shipping pretty logs to prod.
   *
   * Left OPTIONAL here: the default is derived from NODE_ENV after parsing (see
   * `loadEnv`), because `pino-pretty` is a devDependency and is simply absent in
   * a production install — a hardcoded `true` default would crash on boot there.
   */
  LOG_PRETTY: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  /** Redis connection URL for the server-side session store (ioredis). */
  REDIS_URL: z.string().default('redis://localhost:6379'),
  /**
   * Whether to trust `X-Forwarded-*` when deriving `req.ip`.
   *
   * Matters because rate limiting keys on `req.ip`: behind a load balancer with
   * this off, every user shares the balancer's IP and one bucket, so a handful
   * of requests locks out everyone. Turned on when the app is directly
   * reachable, an attacker can instead spoof `X-Forwarded-For` for a fresh
   * bucket per request and poison the logs — so it defaults to OFF and should
   * be set to a hop count or CIDR list rather than `true` wherever possible.
   *
   * Accepts: `false` | `true` | a hop count (`1`) | a CSV of IPs/CIDRs.
   */
  TRUST_PROXY: z
    .string()
    .default('false')
    .transform((v): boolean | number | string => {
      if (v === 'false') return false;
      if (v === 'true') return true;
      const hops = Number(v);
      return Number.isInteger(hops) && hops >= 0 ? hops : v;
    }),
});

export type BaseEnv = z.infer<typeof baseEnvSchema>;

/**
 * Parse `process.env` against `baseEnvSchema` extended with the caller's
 * additional schema. Throws on validation failure so the process never
 * starts in a misconfigured state.
 */
export function loadEnv<E extends z.ZodRawShape>(extension: E) {
  const merged = baseEnvSchema.extend(extension);
  const result = merged.safeParse(process.env);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  // Derive LOG_PRETTY from NODE_ENV when it wasn't set explicitly: pretty in
  // dev, NDJSON in prod. Doing it here rather than as a schema default is what
  // lets `pino-pretty` live in devDependencies — a prod install doesn't have it,
  // so defaulting to pretty there would be a boot-time crash.
  const data = result.data;
  // The generic `extend` leaves TS unable to prove the base keys survived (an
  // extension could in principle redeclare them), so read them through a narrow
  // view. The returned literal still types LOG_PRETTY as a plain boolean.
  const base = data as unknown as Pick<z.infer<typeof baseEnvSchema>, 'LOG_PRETTY' | 'NODE_ENV'>;
  return {
    ...data,
    LOG_PRETTY: base.LOG_PRETTY ?? base.NODE_ENV !== 'production',
  };
}
