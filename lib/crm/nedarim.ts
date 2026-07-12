// ── Nedarim Plus management API client ──────────────────────────────
// Docs: https://matara.pro/nedarimplus/ApiDocumentation.html
// All report calls are GET to Manage3.aspx with querystring params.
// Auth = MosadId (7-digit institution id) + ApiPassword, both issued by
// the Nedarim Plus office (office@nedar.im) to an authorized email.
// GetKevaJson is rate-limited to 20 calls/hour — the daily sync uses
// at most a handful of pages, well under the limit.

const MANAGE_URL = 'https://matara.pro/nedarimplus/Reports/Manage3.aspx';
const PAGE_SIZE = 2000; // API hard cap per request
const MAX_PAGES = 5;    // safety guard (10k standing orders)

export interface NedarimKeva {
  kevaId: string;
  clientName: string | null;
  zeout: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  amount: number | null;
  currency: 'ILS' | 'USD';
  chargesDone: number | null;      // Success — charges completed
  chargesRemaining: number | null; // Itra — blank = unlimited
  lastNum: string | null;          // card last 4
  tokef: string | null;            // card expiry MMYY, e.g. "1225"
  createdDate: string | null;      // ISO yyyy-mm-dd
  nextDate: string | null;
  errorText: string | null;        // decline reason; non-empty = bouncing
  enabled: boolean;
  groupe: string | null;
  comments: string | null;
  masofId: string | null;
  raw: Record<string, unknown>;
}

export interface KevaChargeEvent {
  status: 'success' | 'declined' | 'cancelled';
  date: string | null; // ISO
  amount: number | null;
  name: string | null;
}

export interface KevaDetail {
  kevaId: string;
  kevaStatus: 'active' | 'frozen' | 'deleted';
  totalCharged: number | null;
  historyCount: number | null;
  history: KevaChargeEvent[];
}

export function nedarimConfigured(): boolean {
  return Boolean(
    (process.env.NEDARIM_MOSAD_ID && process.env.NEDARIM_API_PASSWORD) ||
      process.env.NEDARIM_MOCK
  );
}

// ── value coercion (API mixes numbers, strings and '' for null) ─────
function str(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^\d.\-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

// Dates arrive as dd/mm/yyyy or dd/mm/yy (2-digit years seen in the wild).
export function parseNedarimDate(v: unknown): string | null {
  const s = str(v);
  if (!s) return null;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4}|\d{2})(?!\d)/);
  if (!m) return null;
  const year = m[3].length === 2 ? 2000 + parseInt(m[3], 10) : parseInt(m[3], 10);
  return `${year}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

// Tokef "1225" = Dec 2025. Returns the last day of that month (ISO).
export function tokefToDate(tokef: string | null): string | null {
  if (!tokef) return null;
  const m = tokef.trim().match(/^(\d{2})\/?(\d{2})$/);
  if (!m) return null;
  const month = parseInt(m[1], 10);
  const year = 2000 + parseInt(m[2], 10);
  if (month < 1 || month > 12) return null;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${String(month).padStart(2, '0')}-${lastDay}`;
}

export function monthsUntilExpiry(tokef: string | null, from = new Date()): number | null {
  const iso = tokefToDate(tokef);
  if (!iso) return null;
  const exp = new Date(iso + 'T00:00:00Z');
  return (
    (exp.getUTCFullYear() - from.getUTCFullYear()) * 12 +
    (exp.getUTCMonth() - from.getUTCMonth())
  );
}

// ── Friendly decline reasons ─────────────────────────────────────────
// ErrorText comes back in Hebrew from the card networks. Map the common
// cases to a donor-friendly explanation in the donor's language; fall
// back to the raw text so nothing is hidden.
const ERROR_PATTERNS: { re: RegExp; en: string; he: string }[] = [
  { re: /תוקף|פג/, en: 'the card has expired', he: 'פג תוקף הכרטיס' },
  { re: /גנוב/, en: 'the card was reported stolen', he: 'הכרטיס דווח כגנוב' },
  { re: /חסום/, en: 'the card is blocked', he: 'הכרטיס חסום' },
  { re: /מסגרת|חריג/, en: 'the charge exceeded the card’s credit limit', he: 'החיוב חרג ממסגרת האשראי' },
  { re: /מבוטל|בוטל/, en: 'the card has been cancelled', he: 'הכרטיס בוטל' },
  { re: /שגוי|לא תקין|לא נכון/, en: 'the card details on file are incorrect', he: 'פרטי הכרטיס הרשומים אינם נכונים' },
  { re: /סירוב|סרוב|נדחה|דחה/, en: 'the charge was declined by the card company', he: 'החיוב נדחה על ידי חברת האשראי' },
  { re: /קשר.*חברת|התקשר/, en: 'the card company asked to be contacted', he: 'חברת האשראי ביקשה ליצור קשר' },
];

// "לא פעיל - אין יתרת תשלומים" = the order finished its committed number of
// installments. That is NOT a payment failure — the donor completed what they
// signed up for. It must never trigger a "problem with your payment" email;
// it's a renewal opportunity surfaced in the weekly report instead.
export type ErrorKind = 'card_failure' | 'completed';

export function classifyError(errorText: string | null): ErrorKind | null {
  const t = (errorText || '').trim();
  if (!t) return null;
  return /לא פעיל|אין יתרת/.test(t) ? 'completed' : 'card_failure';
}

export function friendlyErrorReason(errorText: string | null, language: 'en' | 'he'): string {
  const raw = (errorText || '').trim();
  if (!raw) return language === 'he' ? 'החיוב לא עבר' : 'the payment did not go through';
  for (const p of ERROR_PATTERNS) {
    if (p.re.test(raw)) return language === 'he' ? p.he : p.en;
  }
  // Unrecognized: show the raw (Hebrew) reason so the donor still sees it.
  return language === 'he' ? raw : `the card company responded: "${raw}"`;
}

// ── HTTP ─────────────────────────────────────────────────────────────
class NedarimApiError extends Error {}

// SAFETY: this integration is strictly READ-ONLY towards Nedarim Plus.
// The management API also exposes destructive actions (UpdateKevaNew,
// DeleteKeva, freeze, single-charge, receipts…) — none of them may ever
// be called from this codebase. Every request funnels through callManage,
// which refuses any action not on this list.
const READ_ONLY_ACTIONS = new Set([
  'GetKevaJson',    // list standing orders
  'GetKevaId',      // one standing order + charge history
  'GetKevaNew',     // standing orders as shown in the UI
  'GetHistoryJson', // transaction history
  'GetErrorLogsCSV',// declined-charges export
]);

async function callManage(action: string, extra: Record<string, string> = {}): Promise<unknown> {
  if (!READ_ONLY_ACTIONS.has(action)) {
    throw new NedarimApiError(
      `Blocked: "${action}" is not a read-only action. This integration never writes to Nedarim Plus.`
    );
  }
  const mosadId = process.env.NEDARIM_MOSAD_ID;
  const apiPassword = process.env.NEDARIM_API_PASSWORD;
  if (!mosadId || !apiPassword) {
    throw new NedarimApiError('NEDARIM_MOSAD_ID / NEDARIM_API_PASSWORD are not set.');
  }
  const url = new URL(MANAGE_URL);
  url.searchParams.set('Action', action);
  // The docs use MosadId for some actions and MosadNumber for others —
  // send both so every action authenticates.
  url.searchParams.set('MosadId', mosadId);
  url.searchParams.set('MosadNumber', mosadId);
  url.searchParams.set('ApiPassword', apiPassword);
  for (const [k, v] of Object.entries(extra)) url.searchParams.set(k, v);

  const res = await fetch(url.toString(), {
    method: 'GET',
    signal: AbortSignal.timeout(30000),
    cache: 'no-store',
  });
  if (!res.ok) throw new NedarimApiError(`Nedarim API HTTP ${res.status} for ${action}`);
  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new NedarimApiError(
      `Nedarim API returned non-JSON for ${action} (possibly blocked / captcha): ${text.slice(0, 200)}`
    );
  }
  // Error envelope: { Result | Status: "...", Message: "..." }
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const obj = parsed as Record<string, unknown>;
    const status = (obj.Result ?? obj.Status) as string | undefined;
    if (status && status !== 'OK' && !('KevaId' in obj)) {
      throw new NedarimApiError(`Nedarim API error for ${action}: ${status} ${obj.Message ?? ''}`);
    }
  }
  return parsed;
}

function parseKevaRow(row: Record<string, unknown>): NedarimKeva {
  const { KevaCVV: _cvv, CVV: _cvv2, ...safeRaw } = row; // never store CVV
  return {
    kevaId: String(row.KevaId ?? ''),
    clientName: str(row.ClientName),
    zeout: str(row.Zeout),
    email: str(row.Mail)?.toLowerCase() ?? null,
    phone: str(row.Phone),
    address: str(row.Adresse),
    city: str(row.City),
    amount: num(row.Amount),
    currency: String(row.Currency) === '2' ? 'USD' : 'ILS',
    chargesDone: num(row.Success),
    chargesRemaining: num(row.Itra),
    lastNum: str(row.LastNum),
    tokef: str(row.Tokef),
    createdDate: parseNedarimDate(row.CreationDate),
    nextDate: parseNedarimDate(row.NextDate),
    errorText: str(row.ErrorText),
    enabled: String(row.Enabled) === '1' || row.Enabled === 1 || row.Enabled === true,
    groupe: str(row.Groupe),
    comments: str(row.Comments),
    masofId: str(row.MasofId),
    raw: safeRaw,
  };
}

/** Pull every credit-card standing order via GetKevaJson (paginated). */
export async function fetchAllKevas(): Promise<NedarimKeva[]> {
  if (process.env.NEDARIM_MOCK) return mockKevas(process.env.NEDARIM_MOCK);

  const all: NedarimKeva[] = [];
  let lastId: string | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const extra: Record<string, string> = { MaxId: String(PAGE_SIZE) };
    if (lastId) extra.LastId = lastId;
    const data = await callManage('GetKevaJson', extra);
    const rows: Record<string, unknown>[] = Array.isArray(data)
      ? (data as Record<string, unknown>[])
      : Array.isArray((data as Record<string, unknown>)?.data)
        ? ((data as Record<string, unknown>).data as Record<string, unknown>[])
        : [];
    if (!Array.isArray(data) && !rows.length) {
      throw new NedarimApiError('Unexpected GetKevaJson response shape: ' + JSON.stringify(data).slice(0, 200));
    }
    for (const r of rows) {
      const keva = parseKevaRow(r);
      if (keva.kevaId) all.push(keva);
    }
    if (rows.length < PAGE_SIZE) break;
    lastId = String(rows[rows.length - 1].KevaId ?? '');
    if (!lastId) break;
  }
  // The API can return the same keva across pages; keep the last occurrence.
  const byId = new Map<string, NedarimKeva>();
  for (const k of all) byId.set(k.kevaId, k);
  return Array.from(byId.values());
}

/** Pull one standing order's full charge history via GetKevaId. */
export async function fetchKevaDetail(kevaId: string): Promise<KevaDetail | null> {
  if (process.env.NEDARIM_MOCK) return mockDetail(kevaId);

  const data = (await callManage('GetKevaId', { KevaId: kevaId })) as Record<string, unknown>;
  if (!data || typeof data !== 'object' || !('KevaId' in data)) return null;

  const statusRaw = String(data.KevaStatus ?? '1');
  const historyRaw = Array.isArray(data.HistoryData)
    ? (data.HistoryData as Record<string, unknown>[])
    : [];
  return {
    kevaId: String(data.KevaId),
    kevaStatus: statusRaw === '3' ? 'deleted' : statusRaw === '2' ? 'frozen' : 'active',
    totalCharged: num(data.TotalHistoryAmount),
    historyCount: num(data.HistoryCount),
    history: historyRaw.map((h) => ({
      // ID: 1 = charged ok, 2 = declined, 3 = cancelled
      status:
        String(h.ID) === '2' ? 'declined' : String(h.ID) === '3' ? 'cancelled' : 'success',
      date: parseNedarimDate(h.Date),
      amount: num(h.Amount),
      name: str(h.Name),
    })),
  };
}

// ── Mock fixtures (NEDARIM_MOCK=1 bouncing / =2 recovered) ──────────
// Lets the whole sync pipeline run end-to-end with no credentials.
function mockKevas(mode: string): NedarimKeva[] {
  const base = [
    {
      KevaId: '900001', ClientName: 'ישראל ישראלי', Zeout: '012345678',
      Mail: 'israel.test@example.com', Phone: '0501234567',
      Adresse: 'הרב קוק 1', City: 'ירושלים', Amount: '180', Currency: '1',
      Itra: '', Success: '14', LastNum: '4321', CreationDate: '01/05/2025',
      NextDate: '01/08/2026', ErrorText: mode === '2' ? '' : 'כרטיס פג תוקף',
      Groupe: 'Monthly', Comments: '', MasofId: '', Tokef: '0126', Enabled: '1',
    },
    {
      KevaId: '900002', ClientName: 'Sarah Levy', Zeout: '',
      Mail: 'sarah.test@example.com', Phone: '0521111111',
      Adresse: '', City: '', Amount: '360', Currency: '1',
      Itra: '', Success: '30', LastNum: '9876', CreationDate: '15/01/2024',
      NextDate: '15/07/2026', ErrorText: '', Groupe: 'General', Comments: '',
      MasofId: '', Tokef: '0928', Enabled: '1',
    },
    {
      KevaId: '900003', ClientName: 'דוד כהן', Zeout: '',
      Mail: '', Phone: '0539999999',
      Adresse: '', City: 'בני ברק', Amount: '100', Currency: '1',
      Itra: '', Success: '5', LastNum: '1111', CreationDate: '01/02/2026',
      NextDate: '01/07/2026', ErrorText: 'סירוב - נא לפנות לחברת האשראי',
      Groupe: 'Gemach', Comments: '', MasofId: '', Tokef: '0827', Enabled: '1',
    },
    {
      // Finished its committed term — a renewal opportunity, NOT a bounce.
      KevaId: '900004', ClientName: 'Moshe Green', Zeout: '',
      Mail: 'moshe.test@example.com', Phone: '0541112222',
      Adresse: '', City: '', Amount: '250', Currency: '1',
      Itra: '0', Success: '24', LastNum: '5555', CreationDate: '01/06/2024',
      NextDate: '', ErrorText: 'לא פעיל - אין יתרת תשלומים',
      Groupe: 'General', Comments: '', MasofId: '', Tokef: '0327', Enabled: '1',
    },
  ];
  return base.map((r) => parseKevaRow(r as Record<string, unknown>));
}

function mockDetail(kevaId: string): KevaDetail {
  return {
    kevaId,
    kevaStatus: 'active',
    totalCharged: 2520,
    historyCount: 17,
    history: [
      { status: 'declined', date: '2026-07-01', amount: null, name: 'כרטיס פג תוקף' },
      { status: 'declined', date: '2026-06-01', amount: null, name: 'כרטיס פג תוקף' },
      { status: 'declined', date: '2026-05-01', amount: null, name: 'כרטיס פג תוקף' },
      { status: 'success', date: '2026-04-01', amount: 180, name: 'ישראל ישראלי' },
    ],
  };
}
