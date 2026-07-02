import { loadEnv } from '@aic/bff/core';

/** client-bff needs no env beyond the shared base (NODE_ENV/HOST/PORT/SESSION_SECRET/FRONTEND_ORIGIN/LOG_PRETTY). */
export const env = loadEnv({});

export type Env = typeof env;
