# Ateret Yaakov CRM — Setup Guide

A donor CRM + yeshiva enrollment system built into the website. Lives at **`/crm`**.

## What it does
- **Donors**: import messy Excel/CSV files — the AI sorts the columns for you. Filter/sort/search like a spreadsheet. Segments: monthly regulars, campaign one-off, campaign monthly.
- **Issues**: flag donors with unfulfilled pledges, lapsed giving, failed payments, or manual follow-ups. Upload a monthly "issues" file to flag many at once.
- **Contact**: email donors (Resend) using saved **Hebrew + English** templates, or open **WhatsApp** pre-filled for donors without email.
- **Yeshiva**: enroll students, track parents, and record monthly tuition payments + balances.

## One-time setup

### 1. Environment variables
Copy `.env.local.example` to `.env.local` and fill it in (and add the same in the Vercel dashboard for production):

| Variable | Where to get it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API (secret) |
| `DATABASE_URL` | Supabase → Settings → Database → Connection string → URI (local only, for schema) |
| `RESEND_API_KEY` | resend.com → API Keys |
| `RESEND_FROM_EMAIL` | Must be on a domain verified in Resend |
| `RESEND_REPLY_TO` | Your inbox, e.g. rabbig@lchaimcenter.org |
| `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys |
| `NEDARIM_MOSAD_ID` | Your 7-digit Nedarim Plus institution (מוסד) number |
| `NEDARIM_API_PASSWORD` | Email office@nedar.im **from an email authorized on the mosad** and ask for an API password (סיסמת API למשיכת נתונים) |
| `CRON_SECRET` | Any long random string — Vercel sends it with cron requests so only the scheduler can trigger syncs |
| `CRM_ADMIN_EMAIL` | Where the weekly Nedarim report is sent (or set `NEDARIM_REPORT_EMAIL`) |
| `NEDARIM_DONATE_URL` | (optional) Link donors use to re-set-up their donation; defaults to the site's /support page |
| `NEDARIM_REMINDER_DAYS` | (optional) Days between recovery-email reminders, default 7 |
| `NEDARIM_MAX_NOTICES` | (optional) Max automated emails per bouncing donor, default 3 |
| `NEDARIM_REPORT_WEEKDAY` | (optional) Weekly digest day, 0=Sunday (default) … 6=Saturday |

### 2. Create the database tables
```bash
node --env-file=.env.local scripts/apply-schema.mjs
```
This creates all tables and seeds the default Hebrew/English templates. Safe to re-run.

### 3. Create your login
```bash
node --env-file=.env.local scripts/create-admin.mjs "ChooseAStrongPassword"
```

### 4. Verify your Resend sending domain
In Resend → Domains, add the DKIM/SPF/MX DNS records to your domain's DNS host, then click Verify. Email won't send until this shows "Verified".

### 5. Nedarim Plus automation (`/crm/nedarim`)
Once `NEDARIM_MOSAD_ID` + `NEDARIM_API_PASSWORD` are set in Vercel, a **daily cron** (~8:00 Israel time)
pulls every credit-card standing order (הוראת קבע) from Nedarim Plus and:

1. **Detects bounces** — any order whose last charge was declined (expired card, refusal, etc.) gets an
   open *failed payment* issue with the decline reason, card last-4 and charge history.
2. **Emails the donor automatically** — the *Payment issue* template, in the donor's language, with the
   friendly decline reason (`{{error_reason}}`) and a link to re-set-up the donation. First notice
   immediately, then reminders every 7 days, up to 3 notices. Unsubscribed donors are never emailed;
   they (and donors with no email) are listed for manual follow-up instead.
3. **Detects recoveries** — when a bouncing order charges cleanly again, the issue auto-resolves and the
   donor is restored to *active*.
4. **Weekly digest** (Sunday) — email summary: monthly amounts at risk, new bounces, recoveries, every
   automated email sent, donors needing a personal call, and cards expiring within a month.

Manual controls (Sync now / email the report now) live at **`/crm/nedarim`**.
Test without credentials by setting `NEDARIM_MOCK=1` (bouncing fixtures) or `NEDARIM_MOCK=2` (recovered).

Note: the API is rate-limited by Nedarim (20 list calls/hour) and access must be requested from their
office — automated access without an issued API password can get the terminal blocked.

## Daily use
- Go to **`/crm`**, sign in.
- **Import** tab → choose Donors / Monthly issues / Yeshiva students → upload a file → review the AI's column mapping → Import.
- **Donors** / **Issues** → filter, click a name for full detail, click **Contact** to email or WhatsApp.
- **Templates** → edit the reminder wording in English and Hebrew.
- **Yeshiva** → add students, record monthly tuition.
