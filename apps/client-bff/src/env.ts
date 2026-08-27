import { loadEnv } from '@aic/bff/core';
import * as z from 'zod';

const rawEnv = loadEnv({
  /** SMTP host for OTP mail. Dev default is the Mailpit docker-compose service. */
  SMTP_HOST: z.string().default('localhost'),
  SMTP_PORT: z.coerce.number().int().positive().default(1025),
  /** From-address on OTP mail. */
  MAIL_FROM: z.string().default('AIC <no-reply@aic.local>'),
  /**
   * Echo the OTP back in the API response so the dev UI can auto-fill it.
   * Off by default so the normal path exercises the real mail send — read the
   * code at http://localhost:8025 instead. Refused outright in production.
   */
  EXPOSE_DEV_OTP: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
});

if (rawEnv.EXPOSE_DEV_OTP && rawEnv.NODE_ENV === 'production') {
  throw new Error('EXPOSE_DEV_OTP=true is not allowed in production — it leaks the OTP');
}

export const env = rawEnv;
export type Env = typeof env;
