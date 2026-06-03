-- ════════════════════════════════════════════════════════════════════
-- Ateret Yaakov CRM — initial schema
-- Donor CRM + Yeshiva enrollment / tuition tracking
-- Safe to re-run (idempotent): uses IF NOT EXISTS / CREATE OR REPLACE.
-- ════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;  -- gen_random_uuid()

-- ── updated_at auto-touch trigger ──────────────────────────────────
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ════════════════════════════════════════════════════════════════════
-- DONOR CRM
-- ════════════════════════════════════════════════════════════════════

-- ── donors ─────────────────────────────────────────────────────────
create table if not exists public.donors (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  first_name      text,
  last_name       text,
  full_name       text,                 -- some sheets only have a single name field
  hebrew_name     text,

  email           text,
  phone           text,                 -- general phone
  whatsapp_phone  text,                 -- defaults to phone if blank

  address_line    text,
  city            text,
  state           text,
  postal_code     text,
  country         text,

  -- monthly_regular | campaign_oneoff | campaign_monthly | other
  segment         text not null default 'other',
  source          text,                 -- campaign name / year / list origin
  preferred_language text not null default 'en',  -- 'en' | 'he'

  -- active | lapsed | inactive
  status          text not null default 'active',
  tags            text[] not null default '{}',
  notes           text,

  -- money (denormalised summary fields, set on import or recomputed)
  total_pledged   numeric(12,2) not null default 0,
  total_paid      numeric(12,2) not null default 0,
  balance         numeric(12,2) generated always as (total_pledged - total_paid) stored,
  monthly_amount  numeric(12,2),        -- for recurring givers
  currency        text not null default 'USD',
  first_gift_at   date,
  last_gift_at    date,

  external_id     text,                 -- id from the source spreadsheet (dedupe aid)
  import_batch_id uuid,
  raw             jsonb,                 -- original row, for reference

  -- Stable key for de-duplicating imports: external id → email → digits-only phone.
  dedupe_key text generated always as (
    coalesce(
      nullif(lower(external_id), ''),
      nullif(lower(email), ''),
      nullif(regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g'), '')
    )
  ) stored,

  constraint donors_segment_chk check (segment in
    ('monthly_regular','campaign_oneoff','campaign_monthly','other')),
  constraint donors_status_chk check (status in ('active','lapsed','inactive')),
  constraint donors_lang_chk check (preferred_language in ('en','he'))
);

drop trigger if exists donors_touch on public.donors;
create trigger donors_touch before update on public.donors
  for each row execute function public.touch_updated_at();

create index if not exists donors_email_idx   on public.donors (lower(email));
create index if not exists donors_phone_idx   on public.donors (phone);
create index if not exists donors_segment_idx on public.donors (segment);
create index if not exists donors_status_idx  on public.donors (status);
create index if not exists donors_name_idx    on public.donors (lower(full_name));
create index if not exists donors_extid_idx   on public.donors (external_id);
create unique index if not exists donors_dedupe_uniq on public.donors (dedupe_key)
  where dedupe_key is not null;

-- ── donor_pledges (commitments) ────────────────────────────────────
create table if not exists public.donor_pledges (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  donor_id      uuid not null references public.donors(id) on delete cascade,
  amount        numeric(12,2) not null default 0,
  frequency     text not null default 'once',   -- 'once' | 'monthly'
  campaign      text,
  start_date    date,
  end_date      date,
  fulfilled_amount numeric(12,2) not null default 0,
  status        text not null default 'open',    -- 'open' | 'fulfilled' | 'cancelled'
  notes         text,
  raw           jsonb,
  constraint pledge_freq_chk check (frequency in ('once','monthly'))
);
create index if not exists pledges_donor_idx on public.donor_pledges (donor_id);

-- ── donor_contributions (actual payments) ──────────────────────────
create table if not exists public.donor_contributions (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  donor_id    uuid not null references public.donors(id) on delete cascade,
  pledge_id   uuid references public.donor_pledges(id) on delete set null,
  amount      numeric(12,2) not null default 0,
  paid_on     date,
  method      text,                              -- card | check | cash | bank | other
  status      text not null default 'completed', -- completed | failed | pending | refunded
  campaign    text,
  reference   text,
  notes       text,
  raw         jsonb,
  constraint contrib_status_chk check (status in
    ('completed','failed','pending','refunded'))
);
create index if not exists contrib_donor_idx  on public.donor_contributions (donor_id);
create index if not exists contrib_status_idx on public.donor_contributions (status);

-- ── donor_issues (the "trouble" list) ──────────────────────────────
create table if not exists public.donor_issues (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  donor_id      uuid not null references public.donors(id) on delete cascade,
  -- unfulfilled_pledge | lapsed | failed_payment | manual
  type          text not null,
  status        text not null default 'open',    -- open | resolved | snoozed
  amount        numeric(12,2),                    -- outstanding amount, if relevant
  detail        text,
  detected_at   date not null default current_date,
  resolved_at   date,
  import_batch_id uuid,
  raw           jsonb,
  constraint issue_type_chk check (type in
    ('unfulfilled_pledge','lapsed','failed_payment','manual')),
  constraint issue_status_chk check (status in ('open','resolved','snoozed'))
);
create index if not exists issues_donor_idx  on public.donor_issues (donor_id);
create index if not exists issues_status_idx on public.donor_issues (status);
create index if not exists issues_type_idx   on public.donor_issues (type);

drop trigger if exists issues_touch on public.donor_issues;
create trigger issues_touch before update on public.donor_issues
  for each row execute function public.touch_updated_at();

-- ── donor_notes (interaction timeline) ─────────────────────────────
create table if not exists public.donor_notes (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  donor_id    uuid not null references public.donors(id) on delete cascade,
  body        text not null,
  author      text
);
create index if not exists donor_notes_donor_idx on public.donor_notes (donor_id);

-- ════════════════════════════════════════════════════════════════════
-- MESSAGING (email + whatsapp)
-- ════════════════════════════════════════════════════════════════════

create table if not exists public.message_templates (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  name        text not null,
  channel     text not null default 'email',     -- email | whatsapp
  language    text not null default 'en',         -- en | he
  category    text not null default 'general',    -- general | reminder | thank_you | unfulfilled_pledge | lapsed | failed_payment
  subject     text,                               -- email only
  body        text not null,                      -- supports {{first_name}}, {{amount}}, {{balance}} ...
  is_default  boolean not null default false,
  constraint tmpl_channel_chk check (channel in ('email','whatsapp')),
  constraint tmpl_lang_chk check (language in ('en','he'))
);

drop trigger if exists tmpl_touch on public.message_templates;
create trigger tmpl_touch before update on public.message_templates
  for each row execute function public.touch_updated_at();

create table if not exists public.message_log (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  donor_id      uuid references public.donors(id) on delete set null,
  student_id    uuid,                             -- for yeshiva messages
  channel       text not null,                    -- email | whatsapp
  template_id   uuid references public.message_templates(id) on delete set null,
  language      text,
  to_address    text,                             -- email or phone
  subject       text,
  body          text,
  -- queued | sent | failed | whatsapp_opened
  status        text not null default 'sent',
  provider_id   text,                             -- Resend message id
  error         text,
  sent_by       text,
  batch_id      uuid
);
create index if not exists msglog_donor_idx on public.message_log (donor_id);
create index if not exists msglog_created_idx on public.message_log (created_at desc);

-- ════════════════════════════════════════════════════════════════════
-- IMPORT BATCHES (audit trail of every upload)
-- ════════════════════════════════════════════════════════════════════

create table if not exists public.import_batches (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  kind          text not null,                    -- donors | issues | students | payments
  filename      text,
  sheet_name    text,
  source_columns jsonb,                           -- headers found in the file
  mapping       jsonb,                            -- ai/user column -> field mapping
  ai_model      text,
  row_count     int not null default 0,
  inserted      int not null default 0,
  updated       int not null default 0,
  skipped       int not null default 0,
  errors        jsonb,
  created_by    text,
  notes         text
);

-- ════════════════════════════════════════════════════════════════════
-- YESHIVA ENROLLMENT
-- ════════════════════════════════════════════════════════════════════

create table if not exists public.students (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  first_name      text,
  last_name       text,
  full_name       text,
  hebrew_name     text,
  date_of_birth   date,

  -- applicant | enrolled | alumni | withdrawn
  status          text not null default 'enrolled',
  enrolled_on     date,
  withdrawn_on    date,
  class_shiur     text,
  grade           text,

  parent_name     text,
  parent_phone    text,
  parent_email    text,
  parent_whatsapp text,
  parent2_name    text,
  parent2_phone   text,
  parent2_email   text,

  monthly_tuition numeric(12,2) not null default 0,
  currency        text not null default 'USD',
  notes           text,

  external_id     text,
  import_batch_id uuid,
  raw             jsonb,

  constraint student_status_chk check (status in
    ('applicant','enrolled','alumni','withdrawn'))
);

drop trigger if exists students_touch on public.students;
create trigger students_touch before update on public.students
  for each row execute function public.touch_updated_at();

create index if not exists students_status_idx on public.students (status);
create index if not exists students_name_idx on public.students (lower(full_name));

-- one row per student per month
create table if not exists public.student_payments (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  student_id  uuid not null references public.students(id) on delete cascade,
  period      date not null,                      -- first day of the month, e.g. 2026-06-01
  amount_due  numeric(12,2) not null default 0,
  amount_paid numeric(12,2) not null default 0,
  paid_on     date,
  -- paid | partial | unpaid | waived
  status      text not null default 'unpaid',
  method      text,
  notes       text,
  constraint student_pay_status_chk check (status in
    ('paid','partial','unpaid','waived')),
  unique (student_id, period)
);
create index if not exists student_pay_student_idx on public.student_payments (student_id);
create index if not exists student_pay_period_idx  on public.student_payments (period);
create index if not exists student_pay_status_idx  on public.student_payments (status);

create table if not exists public.student_notes (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  student_id  uuid not null references public.students(id) on delete cascade,
  body        text not null,
  author      text
);
create index if not exists student_notes_student_idx on public.student_notes (student_id);

-- ════════════════════════════════════════════════════════════════════
-- ROW-LEVEL SECURITY
-- Single-admin model: any authenticated user has full access.
-- The public website (anon) gets NO access to CRM tables.
-- ════════════════════════════════════════════════════════════════════

do $$
declare t text;
begin
  foreach t in array array[
    'donors','donor_pledges','donor_contributions','donor_issues','donor_notes',
    'message_templates','message_log','import_batches',
    'students','student_payments','student_notes'
  ]
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists %I on public.%I;', t||'_admin_all', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (true) with check (true);',
      t||'_admin_all', t
    );
  end loop;
end $$;
