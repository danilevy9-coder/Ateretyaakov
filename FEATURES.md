# Ateret Yaakov CRM — Features

A donor CRM + yeshiva enrollment system built into the Ateret Yaakov website.
Lives at **`/crm`** (e.g. `www.ateretyaakov.com/crm`). Built on Next.js 14 +
Supabase (Postgres, Auth, RLS) + Resend (email) + OpenAI/Anthropic (AI import).

---

## 1. Access & security
- **Single-admin login** (email + password) via Supabase Auth.
- **Middleware-protected** — every `/crm` route requires a logged-in session; visitors are redirected to `/crm/login`.
- **Row-Level Security** on all tables: the public website (anonymous) can read **nothing**; only an authenticated admin can read/write.
- The marketing site and the CRM are isolated (separate layouts; CRM has no smooth-scroll/custom-cursor chrome).

## 2. Dashboard (`/crm`)
- Live counts: **Total donors**, by segment (Monthly regulars / Campaign one-off / Campaign monthly).
- **Open issues** by type: All open, Unfulfilled pledges, Lapsed, Failed payments — each clickable through to a filtered list.
- **Money**: Total raised, Monthly recurring (₪/mo), Outstanding owed — summed across **all** rows in the database (not capped), shown in the donors' currency (₪ / $ / etc.).
- **Yeshiva**: student count.

## 3. Donors (`/crm/donors`)
- **Excel-like grid** with pagination (50/page) that scales to thousands of rows.
- **Search** by name, email, or phone.
- **Filters**: segment, status (active/lapsed/inactive), issue type, "open issues only".
- **Sortable columns**: Name, Pledged, Paid, Balance (click headers to toggle asc/desc).
- **Columns**: Name (+ Hebrew), Contact (email/phone), Segment badge, Pledged, Paid, Balance (owed), **Monthly (₪/mo)**, Issue badges, Actions.
- **Currency-aware** money formatting per donor.
- **Debounced search** (no query spam while typing).
- **Export to CSV** — exports the selected donors, or the whole current filtered view (Hebrew-safe, opens in Excel).

### Donor detail drawer (click a name)
- Money summary (Pledged / Paid / Balance).
- **Contact** button (email or WhatsApp).
- **Quick-edit**: email, phone, segment, status, preferred language.
- **Issues** list — resolve / reopen, or add a manual flag.
- **Contribution history** (per gift, per year).
- **Notes** timeline — add interaction notes.

## 4. Issues (`/crm/issues`)
- Same grid, pre-filtered to donors with **open issues**.
- Issue types: **unfulfilled pledge**, **lapsed**, **failed payment**, **manual flag**.
- Deep-links from the dashboard (e.g. `?type=failed_payment`).

## 5. Contacting donors
### Email (Resend)
- Per-donor email composer with **saved templates**.
- **Hebrew + English** templates, **RTL-aware** rendering.
- Variable substitution: `{{first_name}} {{full_name}} {{amount}} {{balance}} {{monthly_amount}} {{currency}} {{org}}`.
- Every send is logged (`message_log`) with status.

### WhatsApp (click-to-chat)
- Green **Send WhatsApp** button opens WhatsApp with a **pre-filled message** to the donor's number — for the donors who have no email.
- Uses the donor's WhatsApp/phone number; manual send; no paid API required. Logged as well.

### Bulk email
- **Select donors** with row checkboxes, "select all on page", or **"select all N matching"** the current filter.
- **Bulk email composer**: pick a template; option to **send each recipient in their own language** (auto Hebrew/English); preview the first recipient; sends in batches.
- Skips recipients with no email (shown in the count); those are handled individually via WhatsApp.

## 6. Templates (`/crm/templates`)
- Manage all email + WhatsApp templates.
- Create / edit / delete; choose channel, language, category, subject, body.
- Ships with **default Hebrew + English** templates for: pledge reminder, lapsed ("we miss you"), payment issue, thank-you.

## 7. AI-powered import (`/crm/import`)
- Upload **.xlsx / .xls / .csv**.
- **AI reads your columns** (OpenAI, or Anthropic) and auto-maps them to CRM fields — handles messy / inconsistent spreadsheets.
- **Review & adjust** the mapping before importing; pick a default segment + language.
- Three modes:
  - **Donors** — add/update donors.
  - **Monthly issues** — match rows to existing donors and flag them (failed payment / lapsed / unfulfilled pledge / manual).
  - **Yeshiva students** — import students.
- **De-duplication** by external id → email → phone (re-imports update rather than duplicate).
- Every import is recorded in `import_batches` (file, mapping, counts).

## 8. Yeshiva enrollment (`/crm/students`)
- Student grid: search (student or parent), status filter, tuition owed per student.
- **Add / edit** students: English + Hebrew name, status (applicant/enrolled/alumni/withdrawn), class/shiur, grade, enrollment date.
- **Parent/guardian** contacts (name, phone, email, WhatsApp; second parent).
- **Monthly tuition tracking**: record per-month due/paid, status (paid/partial/unpaid/waived), running **balance owed**; quick "mark paid".
- **Contact parent** by email or WhatsApp.
- Per-student **notes**.

## 9. Nedarim Plus automation (`/crm/nedarim`)
- **Daily sync** (Vercel cron) pulls every credit-card standing order via the Nedarim Plus management
  API (`GetKevaJson`), mirrors them in `nedarim_keva`, and matches/creates donors by email → phone → ID.
- **Bounce detection**: orders with a decline error open a `failed_payment` issue automatically, enriched
  with charge history (`GetKevaId`) — decline reason, card last-4/expiry, declined-attempt count.
- **Automated recovery emails**: bouncing donors get the *Payment issue* template in their language with
  `{{error_reason}}` + `{{card_last4}}`; staged cadence (immediate → reminder every 7 days → max 3),
  honors unsubscribes, failed sends retry next run. All logged to `message_log` (`sent_by: nedarim-auto`).
- **Auto-recovery**: when a charge clears again the issue resolves itself and the donor returns to active.
- **Weekly digest email** (Sunday) to the admin: money at risk, new bounces, recoveries, outreach log,
  donors needing a personal call, cards expiring within a month.
- **Dashboard** at `/crm/nedarim`: live stats, bouncing table with outreach status, sync history,
  Sync-now / send-report-now buttons. Mockable end-to-end via `NEDARIM_MOCK=1|2`.

## 10. Data model (Supabase)
- `donors`, `donor_pledges`, `donor_contributions`, `donor_issues`, `donor_notes`
- `message_templates`, `message_log`, `import_batches`
- `students`, `student_payments`, `student_notes`
- `nedarim_keva` (standing-order mirror), `nedarim_sync_runs` (sync audit + report payloads)
- Generated `balance` column (amount owed, never negative); dedupe key; updated-at triggers; `crm_dashboard_stats()` aggregate function.

## 11. Languages
- **Hebrew + English** throughout outreach (templates, RTL email rendering, per-recipient language on bulk send). Donor names stored in both EN and HE.

---

## Roadmap / not yet enabled
- **Email delivery** turns on once the Resend sending domain is verified (pending the DNS move to Vercel).
- Automatic **lapsed-donor detection** (flag donors with no gift in N months).
- Per-user roles (currently single admin).

## Tested
A full browser end-to-end test (`scripts/e2e.mjs`) covers login, dashboard totals,
the donor grid, search, filters, bulk-select, donor drawer, templates (incl. Hebrew),
students, import, CSV export, the sidebar issue badge, and logout — **20/20 passing**.
