// Genuinely cross-cutting contracts only: the session/user shape, the error
// envelope, and health. Every BFF and every frontend really does share these.
//
// Domain contracts (policies etc.) deliberately do NOT live here — they are
// per-audience and owned by one (BFF, frontend) pair. See
// `libs/{agent,dealer,broker}/contracts`.
export * from './lib/auth';
export * from './lib/errors';
export * from './lib/health';
