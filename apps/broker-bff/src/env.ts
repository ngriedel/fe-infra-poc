import { loadEnv } from '@aic/bff/core';
import * as z from 'zod';

const rawEnv = loadEnv({
  OIDC_MODE: z.enum(['stub', 'azure']).default('stub'),
  /** Required when OIDC_MODE=azure. Ignored otherwise. */
  AZURE_TENANT_ID: z.string().optional(),
  AZURE_CLIENT_ID: z.string().optional(),
  AZURE_CLIENT_SECRET: z.string().optional(),
  AZURE_REDIRECT_URI: z.string().url().optional(),
  /**
   * Optional explicit OIDC issuer/authority. Set this to the External ID (CIAM)
   * authority for broker sign-in; falls back to the workforce authority derived
   * from AZURE_TENANT_ID when unset.
   */
  AZURE_AUTHORITY: z.string().url().optional(),
  /** Where to send the user after a successful login if no returnTo. */
  POST_LOGIN_DEFAULT: z.string().default('/'),
  /** Base URL of the upstream ESL (the stub runs in docker-compose on :8081). */
  ESL_BASE_URL: z.string().url().default('http://localhost:8081'),
});

if (rawEnv.OIDC_MODE === 'azure') {
  const missing = (
    ['AZURE_TENANT_ID', 'AZURE_CLIENT_ID', 'AZURE_CLIENT_SECRET', 'AZURE_REDIRECT_URI'] as const
  ).filter((k) => !rawEnv[k]);
  if (missing.length) {
    throw new Error(`OIDC_MODE=azure but missing required env vars: ${missing.join(', ')}`);
  }
}

export const env = rawEnv;
export type Env = typeof env;
