import { createTransport, type Transporter } from 'nodemailer';

export interface MailerConfig {
  host: string;
  port: number;
  from: string;
}

export interface Mailer {
  sendOtp(to: string, code: string): Promise<void>;
}

/**
 * Transactional mail for the client OTP tier.
 *
 * In dev this points at the **Mailpit** container from docker-compose (SMTP on
 * :1025, web inbox on http://localhost:8025), which accepts anything and
 * forwards nothing — so real addresses can be used in testing without mail
 * actually leaving the machine.
 *
 * Swapping in a real provider (SES, SendGrid, Postmark…) is a config change:
 * point SMTP_HOST/SMTP_PORT at it and add credentials here. Nothing above this
 * seam knows the difference.
 */
export function createMailer(cfg: MailerConfig): Mailer {
  const transport: Transporter = createTransport({
    host: cfg.host,
    port: cfg.port,
    // Mailpit speaks plain SMTP with no auth. A real provider needs
    // `secure: true` and an `auth` block.
    secure: false,
  });

  return {
    async sendOtp(to, code) {
      await transport.sendMail({
        from: cfg.from,
        to,
        subject: `${code} is your AIC verification code`,
        text: [
          `Your verification code is ${code}.`,
          '',
          'It expires in 10 minutes and can only be used once.',
          "If you didn't request it, you can ignore this email.",
        ].join('\n'),
        html: [
          '<p>Your verification code is:</p>',
          `<p style="font-size:28px;font-weight:600;letter-spacing:4px;font-family:monospace">${code}</p>`,
          '<p>It expires in 10 minutes and can only be used once.</p>',
          '<p style="color:#666">If you didn\'t request it, you can ignore this email.</p>',
        ].join(''),
      });
    },
  };
}
