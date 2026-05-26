import fp from 'fastify-plugin';
import secureSession from '@fastify/secure-session';
import cookie from '@fastify/cookie';
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
  await app.register(cookie);
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
