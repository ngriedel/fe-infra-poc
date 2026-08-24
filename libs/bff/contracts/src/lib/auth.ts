import { z } from 'zod';

export const sessionUserSchema = z.object({
  id: z.string().min(1),
  email: z.email(),
  displayName: z.string().min(1),
  audience: z.enum(['client', 'agent', 'dealer', 'broker']),
  roles: z.array(z.string()).default([]),
});
export type SessionUser = z.infer<typeof sessionUserSchema>;

export const sessionResponseSchema = z.object({
  user: sessionUserSchema.nullable(),
});
export type SessionResponse = z.infer<typeof sessionResponseSchema>;

/* ── Client (magic link + OTP) ─────────────────────────────────────── */

export const requestMagicLinkRequestSchema = z.strictObject({
  email: z.email(),
});
export type RequestMagicLinkRequest = z.infer<typeof requestMagicLinkRequestSchema>;

export const requestMagicLinkResponseSchema = z.object({
  challengeId: z.string().min(1),
  expiresAt: z.iso.datetime(),
  /** Dev-only: the OTP so the UI can auto-fill. Never populated in production. */
  devOtp: z.string().optional(),
});
export type RequestMagicLinkResponse = z.infer<typeof requestMagicLinkResponseSchema>;

export const verifyOtpRequestSchema = z.strictObject({
  challengeId: z.string().min(1),
  code: z.string().regex(/^\d{6}$/, 'OTP must be a 6-digit code'),
});
export type VerifyOtpRequest = z.infer<typeof verifyOtpRequestSchema>;

/* ── Agent (OIDC) ──────────────────────────────────────────────────── */

/** A safe, same-origin relative redirect path — no scheme/host, `//`, or `\`. */
export const safeReturnToSchema = z
  .string()
  .refine((v) => v.startsWith('/') && !v.startsWith('//') && !v.includes('\\'), {
    message: 'returnTo must be a same-origin relative path',
  })
  .default('/')
  .catch('/');

export const oidcLoginQuerySchema = z.object({
  returnTo: safeReturnToSchema,
});
export type OidcLoginQuery = z.infer<typeof oidcLoginQuerySchema>;

export const oidcCallbackQuerySchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
});
export type OidcCallbackQuery = z.infer<typeof oidcCallbackQuerySchema>;

/* ── Errors ────────────────────────────────────────────────────────── */

export const authErrorCodeSchema = z.enum([
  'INVALID_EMAIL',
  'INVALID_OTP',
  'EXPIRED_CHALLENGE',
  'UNAUTHENTICATED',
  'OIDC_STATE_MISMATCH',
  'OIDC_EXCHANGE_FAILED',
  /** Too many requests — the caller should back off and retry later. */
  'RATE_LIMITED',
]);
export type AuthErrorCode = z.infer<typeof authErrorCodeSchema>;
