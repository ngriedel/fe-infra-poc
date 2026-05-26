import { loadEnv } from '@aic/bff/core';
import { z } from 'zod';

export const env = loadEnv({
  /** Default OTP returned in the magic-link response (dev mode only). */
  DEV_FIXED_OTP: z.string().regex(/^\d{6}$/).default('123456'),
});

export type Env = typeof env;
