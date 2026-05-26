import { z } from 'zod';

export const sessionUserSchema = z.object({
  id: z.string().min(1),
  email: z.string().email(),
  displayName: z.string().min(1),
  audience: z.enum(['client', 'agent']),
  roles: z.array(z.string()).default([]),
});
export type SessionUser = z.infer<typeof sessionUserSchema>;

export const sessionResponseSchema = z.object({
  user: sessionUserSchema.nullable(),
});
export type SessionResponse = z.infer<typeof sessionResponseSchema>;

/* ── Client (magic link + OTP) ─────────────────────────────────────── */

export const requestMagicLinkRequestSchema = z.object({
  email: z.string().email(),
});
export type RequestMagicLinkRequest = z.infer<typeof requestMagicLinkRequestSchema>;

export const requestMagicLinkResponseSchema = z.object({
  challengeId: z.string().min(1),
  expiresAt: z.string().datetime(),
  devOtp: z.string().optional(),
});
export type RequestMagicLinkResponse = z.infer<typeof requestMagicLinkResponseSchema>;

export const verifyOtpRequestSchema = z.object({
  challengeId: z.string().min(1),
  code: z.string().regex(/^\d{6}$/, 'OTP must be a 6-digit code'),
});
export type VerifyOtpRequest = z.infer<typeof verifyOtpRequestSchema>;

/* ── Agent (OIDC) ──────────────────────────────────────────────────── */

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
]);
export type AuthErrorCode = z.infer<typeof authErrorCodeSchema>;
