import fp from 'fastify-plugin';
import secureSession from '@fastify/secure-session';
import '../session';

export interface SecureSessionPluginOptions {
  /** 32-byte hex secret (typically from env). */
  secret: string;
  /** Cookie name. Defaults to `sid`. */
  cookieName?: string;
  /** True in production (HTTPS only). */
  secure: boolean;
}

export const secureSessionPlugin = fp(async (app, opts: SecureSessionPluginOptions) => {
  // Do NOT register @fastify/cookie here. @fastify/secure-session registers it
  // internally WITH a signing secret (derived from the session key). Registering
  // it ourselves first — without a secret — suppresses that, which throws for
  // `reply.setCookie({ signed: true })` / `req.unsignCookie` and leaves the SSO
  // state cookie unsigned (defeating its CSRF role).
  await app.register(secureSession, {
    sessionName: 'session',
    cookieName: opts.cookieName ?? 'sid',
    key: Buffer.from(opts.secret, 'hex'),
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: opts.secure,
      path: '/',
      maxAge: 60 * 60 * 8, // 8 hours
    },
  });
});
