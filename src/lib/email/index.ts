import 'server-only';

import nodemailer from 'nodemailer';
import { Resend } from 'resend';

export interface OutgoingEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
}

type Provider = 'resend' | 'smtp';

const isPlaceholder = (value: string | undefined): boolean =>
  !value ||
  /x{6,}/i.test(value) ||
  /your-app-password|you@example\.com|yourdomain\.com/i.test(value);

/**
 * Pick the configured provider. A key that still holds the `.env.example` placeholder counts as
 * "not configured" so local development silently skips email instead of failing every payment.
 */
function resolveProvider(): Provider | null {
  const preferred = (process.env.EMAIL_PROVIDER ?? 'resend').toLowerCase();
  const resendReady =
    !isPlaceholder(process.env.RESEND_API_KEY) &&
    /^re_[A-Za-z0-9_]{8,}$/.test(process.env.RESEND_API_KEY ?? '');
  const smtpReady =
    !isPlaceholder(process.env.SMTP_HOST) &&
    !isPlaceholder(process.env.SMTP_USER) &&
    !isPlaceholder(process.env.SMTP_PASS);

  if (preferred === 'smtp') return smtpReady ? 'smtp' : resendReady ? 'resend' : null;
  return resendReady ? 'resend' : smtpReady ? 'smtp' : null;
}

export function isEmailConfigured(): boolean {
  return resolveProvider() !== null;
}

const FROM = (): string =>
  process.env.EMAIL_FROM && !isPlaceholder(process.env.EMAIL_FROM)
    ? process.env.EMAIL_FROM
    : 'CabGo <onboarding@resend.dev>';

let resend: Resend | null = null;
let smtp: nodemailer.Transporter | null = null;

async function sendViaResend(email: OutgoingEmail): Promise<void> {
  resend ??= new Resend(process.env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: FROM(),
    to: email.to,
    subject: email.subject,
    html: email.html,
    text: email.text,
  });
  if (error) throw new Error(`Resend rejected the email: ${error.message}`);
}

async function sendViaSmtp(email: OutgoingEmail): Promise<void> {
  const port = Number(process.env.SMTP_PORT ?? 587);
  smtp ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    // Port 465 is implicit TLS; 587/25 upgrade with STARTTLS.
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  await smtp.sendMail({
    from: FROM(),
    to: email.to,
    subject: email.subject,
    html: email.html,
    text: email.text,
  });
}

/**
 * Send one email. NEVER throws — an email problem must not undo a successful payment.
 * Resolves to `true` only when the provider accepted the message.
 */
export async function sendEmail(email: OutgoingEmail): Promise<boolean> {
  const provider = resolveProvider();
  if (!provider) {
    console.info(`[email] no provider configured — skipped "${email.subject}"`);
    return false;
  }
  try {
    if (provider === 'resend') await sendViaResend(email);
    else await sendViaSmtp(email);
    return true;
  } catch (error) {
    console.error(`[email] ${provider} failed for "${email.subject}":`, error);
    return false;
  }
}
