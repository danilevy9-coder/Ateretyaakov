import { Resend } from 'resend';

export interface OutgoingEmail {
  to: string;
  subject: string;
  body: string; // plain text (may contain newlines)
  language?: 'en' | 'he';
  unsubscribeUrl?: string; // when set, adds a footer link + one-click headers
}

// Wrap plain-text body in minimal, RTL-aware HTML, with an unsubscribe footer.
export function bodyToHtml(body: string, language?: 'en' | 'he', unsubscribeUrl?: string): string {
  const dir = language === 'he' ? 'rtl' : 'ltr';
  const align = language === 'he' ? 'right' : 'left';
  const safe = body
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br/>');

  const unsubLabel = language === 'he' ? 'להסרה מרשימת התפוצה' : 'Unsubscribe';
  const footer = unsubscribeUrl
    ? `<div style="margin-top:28px;padding-top:14px;border-top:1px solid #eee;font-size:12px;color:#999;text-align:${align};direction:${dir};">
         <a href="${unsubscribeUrl}" style="color:#999;text-decoration:underline;">${unsubLabel}</a>
       </div>`
    : '';

  return `<!doctype html><html dir="${dir}"><body style="margin:0;padding:0;background:#f6f6f6;">
  <div style="max-width:600px;margin:0 auto;padding:32px;background:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:#1a1a1a;text-align:${align};direction:${dir};">
    ${safe}
    ${footer}
  </div></body></html>`;
}

// For system emails (e.g. the weekly Nedarim digest) that build their own HTML.
export async function sendHtmlEmail(msg: { to: string; subject: string; html: string }): Promise<{ id: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY is not set.');
  const from = process.env.RESEND_FROM_EMAIL;
  if (!from) throw new Error('RESEND_FROM_EMAIL is not set (must be a verified domain).');
  const resend = new Resend(apiKey);
  const { data, error } = await resend.emails.send({
    from,
    to: msg.to,
    subject: msg.subject,
    html: msg.html,
    replyTo: process.env.RESEND_REPLY_TO || undefined,
  });
  if (error) throw new Error(error.message || 'Resend send failed');
  return { id: data?.id ?? '' };
}

export async function sendEmail(msg: OutgoingEmail): Promise<{ id: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY is not set.');
  const from = process.env.RESEND_FROM_EMAIL;
  if (!from) throw new Error('RESEND_FROM_EMAIL is not set (must be a verified domain).');

  const resend = new Resend(apiKey);
  const { data, error } = await resend.emails.send({
    from,
    to: msg.to,
    subject: msg.subject,
    html: bodyToHtml(msg.body, msg.language, msg.unsubscribeUrl),
    replyTo: process.env.RESEND_REPLY_TO || undefined,
    headers: msg.unsubscribeUrl
      ? {
          'List-Unsubscribe': `<${msg.unsubscribeUrl}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        }
      : undefined,
  });
  if (error) throw new Error(error.message || 'Resend send failed');
  return { id: data?.id ?? '' };
}
