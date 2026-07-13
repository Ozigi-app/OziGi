/**
 * SMTP email sender — for Yahoo, Outlook, custom domains, and any
 * provider that isn't Gmail OAuth.
 *
 * Credentials are stored encrypted in email_accounts
 * (smtp_host, smtp_port, smtp_username, smtp_password_enc).
 */
import nodemailer from 'nodemailer'
import { decrypt } from '@/lib/gtm/encrypt'
import { supabaseAdmin } from '@/lib/supabase/admin'
import type { GmailSendResult } from '@/lib/gtm/gmail'

// Well-known SMTP presets so users don't have to look up host/port
export const SMTP_PRESETS: Record<string, { host: string; port: number; label: string }> = {
  gmail:     { host: 'smtp.gmail.com',      port: 587,  label: 'Gmail (App Password)' },
  outlook:   { host: 'smtp.office365.com', port: 587,  label: 'Outlook / Microsoft 365' },
  yahoo:     { host: 'smtp.mail.yahoo.com', port: 587,  label: 'Yahoo Mail' },
  zohomail:  { host: 'smtp.zoho.com',       port: 587,  label: 'Zoho Mail' },
  fastmail:  { host: 'smtp.fastmail.com',   port: 587,  label: 'Fastmail' },
  sendgrid:  { host: 'smtp.sendgrid.net',   port: 587,  label: 'SendGrid' },
  mailgun:   { host: 'smtp.mailgun.org',    port: 587,  label: 'Mailgun' },
  custom:    { host: '',                    port: 587,  label: 'Custom SMTP' },
}

export async function sendViaSmtp(
  accountId: string,
  to: string,
  subject: string,
  htmlBody: string,
  fromName: string,
  fromEmail: string
): Promise<GmailSendResult> {
  const { data, error } = await supabaseAdmin
    .from('email_accounts')
    .select('smtp_host, smtp_port, smtp_username, smtp_password_enc')
    .eq('id', accountId)
    .single()

  if (error || !data) throw new Error('SMTP account not found')
  if (!data.smtp_host || !data.smtp_username || !data.smtp_password_enc) {
    throw new Error('SMTP account is missing credentials')
  }

  const password = decrypt(data.smtp_password_enc)

  const transporter = nodemailer.createTransport({
    host: data.smtp_host,
    port: data.smtp_port ?? 587,
    secure: (data.smtp_port ?? 587) === 465,
    auth: { user: data.smtp_username, pass: password },
  })

  const info = await transporter.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to,
    subject,
    html: htmlBody,
  })

  // nodemailer returns a messageId; no threadId concept outside Gmail
  return {
    messageId: info.messageId ?? '',
    threadId:  '',   // SMTP has no thread concept — reply detection won't work
  }
}
