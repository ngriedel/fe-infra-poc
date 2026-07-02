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
   */
  LOG_PRETTY: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
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
  return result.data;
}
