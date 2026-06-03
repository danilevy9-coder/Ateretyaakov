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

## Daily use
- Go to **`/crm`**, sign in.
- **Import** tab → choose Donors / Monthly issues / Yeshiva students → upload a file → review the AI's column mapping → Import.
- **Donors** / **Issues** → filter, click a name for full detail, click **Contact** to email or WhatsApp.
- **Templates** → edit the reminder wording in English and Hebrew.
- **Yeshiva** → add students, record monthly tuition.
