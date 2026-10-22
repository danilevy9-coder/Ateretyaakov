import type { Donor } from './types';

export const ORG_NAME = 'Yeshiva Ateret Yaakov';

// ── Template rendering ──────────────────────────────────────────────
// Replaces {{variable}} tokens. Missing values render as ''.
export function renderTemplate(
  text: string,
  vars: Record<string, string | number | null | undefined>
): string {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => {
    const v = vars[key];
    return v === null || v === undefined ? '' : String(v);
  });
}

export function donorVars(d: Donor): Record<string, string | number> {
  const first =
    d.first_name || (d.full_name ? d.full_name.split(' ')[0] : '') || 'Friend';
  return {
    first_name: first,
    full_name: d.full_name || `${d.first_name ?? ''} ${d.last_name ?? ''}`.trim(),
    amount: fmtMoney(d.total_paid || d.monthly_amount || 0, ''),
    balance: fmtMoney(d.balance ?? 0, ''),
    monthly_amount: fmtMoney(d.monthly_amount ?? 0, ''),
    currency: currencySymbol(d.currency),
    org: ORG_NAME,
  };
}

export function currencySymbol(code?: string | null): string {
  switch ((code || 'USD').toUpperCase()) {
    case 'USD':
      return '$';
    case 'ILS':
    case 'NIS':
      return '₪';
    case 'GBP':
      return '£';
    case 'EUR':
      return '€';
    default:
      return (code || '') + ' ';
  }
}

export function fmtMoney(n: number, symbol = '$'): string {
  const num = Number.isFinite(n) ? n : 0;
  return symbol + num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

// ── Phone / WhatsApp ────────────────────────────────────────────────
// Strips everything but digits and a leading +. WhatsApp click-to-chat
// needs an international number with no +, spaces or dashes.
export function normalizePhone(raw?: string | null): string {
  if (!raw) return '';
  let s = raw.trim().replace(/[^\d+]/g, '');
  if (s.startsWith('+')) s = s.slice(1);
  return s;
}

// International number for WhatsApp (wa.me) — digits only, country code first.
// Most numbers in this CRM are Israeli and stored in local format
// (052-123-4567), which wa.me cannot open. Rules:
//   +44 20…  / 0044 20…      → keep the country code as written (4420…)
//   052-123-4567 / 02-…      → leading 0 becomes 972 (972521234567)
//   52-123-4567 (9 digits, 5…) → Israeli mobile missing its 0 → 97252…
//   (718) 555-1234 (10 digits) → North American number → 1718…
//   972… / 1… / anything else → kept as is
// NOTE: normalizePhone() above is deliberately left unchanged — the import
// and the Nedarim sync use it to match donors by phone.
export function waNumber(raw?: string | null): string {
  if (!raw) return '';
  const s = raw.trim();
  const hadPlus = s.startsWith('+');
  let d = s.replace(/\D/g, '');
  if (!d) return '';
  if (hadPlus) return d;
  if (d.startsWith('00')) return d.slice(2);
  if (d.startsWith('0')) return '972' + d.slice(1);
  if (d.length === 9 && d.startsWith('5')) return '972' + d;
  if (d.length === 10 && /^[2-9]/.test(d)) return '1' + d;
  return d;
}

// tel: link that works from an Israeli phone and from abroad.
export function telHref(raw?: string | null): string {
  if (!raw) return '';
  const s = raw.trim();
  const d = s.replace(/\D/g, '');
  if (!d) return '';
  return 'tel:' + (s.startsWith('+') ? '+' + d : d);
}

// Build a wa.me click-to-chat link, with an optional pre-filled message.
export function waLink(phone: string, message = ''): string {
  const p = waNumber(phone);
  return message
    ? `https://wa.me/${p}?text=${encodeURIComponent(message)}`
    : `https://wa.me/${p}`;
}

// Digits-only "national" form used to compare phone numbers written in any
// format: strips +972 / 00972 / leading 0, so 052-123 4567 and
// +972 52 123 4567 both become 521234567.
export function phoneKey(raw?: string | null): string {
  let d = (raw || '').replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('972')) d = d.slice(3);
  if (d.startsWith('0')) d = d.slice(1);
  return d;
}

// ── Import value coercion ───────────────────────────────────────────
export function toNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return v;
  const cleaned = String(v).replace(/[^0-9.\-]/g, '');
  if (cleaned === '' || cleaned === '-' || cleaned === '.') return null;
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

// Excel stores dates as serial numbers; xlsx usually parses them, but be safe.
export function toDate(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'number') {
    // Excel serial date → JS date (epoch 1899-12-30)
    const ms = Math.round((v - 25569) * 86400 * 1000);
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

export function cleanStr(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}
