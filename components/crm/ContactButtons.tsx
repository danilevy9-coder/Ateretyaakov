'use client';

import { telHref, waLink } from '@/lib/crm/util';

// One-tap Call / WhatsApp / Email. Plain links, so they work on a phone
// (tel: opens the dialer, wa.me opens WhatsApp, mailto: opens mail).
// Buttons are greyed out when the number / address is missing.

const Icon = {
  call: (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z" />
    </svg>
  ),
  wa: (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor" aria-hidden>
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.9 11.9 0 0 0 4.6 4c1.7.7 2.4.8 3.2.7.5-.1 1.5-.6 1.8-1.2.2-.6.2-1.1.1-1.2l-.5-.3z" />
    </svg>
  ),
  mail: (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 6-10 7L2 6" />
    </svg>
  ),
};

const base =
  'inline-flex items-center justify-center gap-1.5 rounded-lg border font-medium transition-colors whitespace-nowrap';
const sizes = { sm: 'px-2.5 py-1.5 text-sm', md: 'px-3.5 py-2 text-[15px]' };
const off = 'border-slate-200 bg-slate-50 text-[#b6c0cc] cursor-not-allowed pointer-events-none';

export default function ContactButtons({
  phone,
  whatsapp,
  email,
  size = 'sm',
  labels = true,
  className = '',
}: {
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  size?: 'sm' | 'md';
  labels?: boolean;
  className?: string;
}) {
  const wa = whatsapp || phone || '';
  const stop = (e: React.MouseEvent) => e.stopPropagation();
  return (
    <div className={`flex items-center gap-1.5 ${className}`} onClick={stop}>
      <a
        href={phone ? telHref(phone) : undefined}
        title={phone ? `Call ${phone}` : 'No phone number'}
        className={`${base} ${sizes[size]} ${phone ? 'border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100' : off}`}
      >
        {Icon.call}{labels && <span>Call</span>}
      </a>
      <a
        href={wa ? waLink(wa) : undefined}
        target="_blank"
        rel="noreferrer"
        title={wa ? `WhatsApp ${wa}` : 'No phone number'}
        className={`${base} ${sizes[size]} ${wa ? 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100' : off}`}
      >
        {Icon.wa}{labels && <span>WhatsApp</span>}
      </a>
      <a
        href={email ? `mailto:${email}` : undefined}
        title={email ? `Email ${email}` : 'No email address'}
        className={`${base} ${sizes[size]} ${email ? 'border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100' : off}`}
      >
        {Icon.mail}{labels && <span>Email</span>}
      </a>
    </div>
  );
}
