import nodemailer from 'nodemailer';

export interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: Array<{ filename: string; content: Buffer; contentType?: string }>;
}

let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (transporter) return transporter;
  const host = process.env.SMTP_HOST;
  if (!host) return null;

  transporter = nodemailer.createTransport({
    host,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS || '' }
      : undefined,
  });
  return transporter;
}

export function isEmailConfigured() {
  return !!process.env.SMTP_HOST;
}

export async function sendEmail(opts: EmailOptions): Promise<{ delivered: boolean; mode: 'smtp' | 'stub' }> {
  const tx = getTransporter();
  const from = process.env.SMTP_FROM || 'CredPriv One <noreply@credpriv.hospital>';

  if (tx) {
    await tx.sendMail({
      from,
      to: opts.to,
      subject: opts.subject,
      text: opts.text,
      html: opts.html || opts.text.replace(/\n/g, '<br>'),
      attachments: opts.attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType || 'application/pdf',
      })),
    });
    return { delivered: true, mode: 'smtp' };
  }

  console.log(`[EMAIL stub] To: ${opts.to}\nSubject: ${opts.subject}\n---\n${opts.text.slice(0, 400)}${opts.text.length > 400 ? '…' : ''}`);
  return { delivered: false, mode: 'stub' };
}

export async function verifyEmailConnection(): Promise<boolean> {
  const tx = getTransporter();
  if (!tx) return false;
  await tx.verify();
  return true;
}
