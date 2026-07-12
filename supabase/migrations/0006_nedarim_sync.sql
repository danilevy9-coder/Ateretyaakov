-- ════════════════════════════════════════════════════════════════════
-- Nedarim Plus integration — automated standing-order (הוראת קבע) sync.
-- Mirrors GetKevaJson data, tracks bounce/recovery lifecycle, logs runs.
-- Safe to re-run (idempotent).
-- ════════════════════════════════════════════════════════════════════

-- ── nedarim_keva: mirror of every credit-card standing order ────────
create table if not exists public.nedarim_keva (
  id              uuid primary key default gen_random_uuid(),
  keva_id         text not null unique,          -- Nedarim KevaId
  donor_id        uuid references public.donors(id) on delete set null,

  client_name     text,
  zeout           text,                          -- donor ID number
  email           text,
  phone           text,
  address_line    text,
  city            text,

  amount          numeric(12,2),                 -- monthly charge
  currency        text not null default 'ILS',   -- Currency 1=ILS 2=USD
  charges_done    int,                           -- Success
  charges_remaining int,                         -- Itra (blank = unlimited)

  last_num        text,                          -- card last 4
  tokef           text,                          -- card expiry MMYY
  nedarim_created date,                          -- CreationDate
  next_charge     date,                          -- NextDate

  error_text      text,                          -- decline reason; non-empty = bouncing
  enabled         boolean not null default true, -- Enabled 1/0
  bouncing_since  date,                          -- first sync where error_text appeared

  groupe          text,                          -- category / cause
  comments        text,
  masof_id        text,

  raw             jsonb,                         -- last full API row (CVV never stored)
  first_seen_at   timestamptz not null default now(),
  last_synced_at  timestamptz not null default now()
);

create index if not exists nedarim_keva_donor_idx on public.nedarim_keva (donor_id);
create index if not exists nedarim_keva_enabled_idx on public.nedarim_keva (enabled);
create index if not exists nedarim_keva_bouncing_idx on public.nedarim_keva (keva_id)
  where error_text is not null and error_text <> '';

-- ── nedarim_sync_runs: audit log of every sync ──────────────────────
create table if not exists public.nedarim_sync_runs (
  id              uuid primary key default gen_random_uuid(),
  started_at      timestamptz not null default now(),
  finished_at     timestamptz,
  trigger         text not null default 'cron',  -- cron | manual
  ok              boolean,
  error           text,

  kevas_total     int,
  kevas_active    int,
  kevas_bouncing  int,
  new_bounces     int,
  recovered       int,
  emails_sent     int,
  emails_failed   int,
  emails_skipped  int,

  report          jsonb,                         -- detail lists for the UI / weekly digest
  weekly_report_sent boolean not null default false
);

create index if not exists nedarim_runs_started_idx on public.nedarim_sync_runs (started_at desc);

-- ── donor_issues: outreach tracking for automated recovery emails ───
alter table public.donor_issues add column if not exists keva_id text;
alter table public.donor_issues add column if not exists last_notified_at timestamptz;
alter table public.donor_issues add column if not exists notify_count int not null default 0;

create index if not exists issues_keva_idx on public.donor_issues (keva_id)
  where keva_id is not null;

-- ── RLS (single-admin model, same as the rest of the CRM) ───────────
do $$
declare t text;
begin
  foreach t in array array['nedarim_keva','nedarim_sync_runs']
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists %I on public.%I;', t||'_admin_all', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (true) with check (true);',
      t||'_admin_all', t
    );
  end loop;
end $$;

-- ── Improved default failed-payment email templates ─────────────────
-- Adds {{error_reason}} (friendly decline explanation from Nedarim) and
-- {{card_last4}}. Runs after 0002, so this wins over its generic seed.
delete from public.message_templates
  where is_default = true and category = 'failed_payment' and channel = 'email';

insert into public.message_templates (name, channel, language, category, subject, body, is_default) values

('Payment issue', 'email', 'en', 'failed_payment',
 'There was an issue with your recent payment to {{org}}',
 'Dear {{first_name}},

We tried to process your monthly contribution of {{currency}}{{monthly_amount}} to {{org}} (card ending {{card_last4}}), but the payment did not go through.

The reason given by the card company: {{error_reason}}

You can set up your donation again with updated details here: [DONATE LINK]

If it is easier, simply reply to this email or call us and we will take care of it together. Your monthly partnership sustains our talmidim and their growth in Torah — thank you for standing with us.

With gratitude,
{{org}}', true),

('Payment issue', 'email', 'he', 'failed_payment',
 'אירעה תקלה בתשלום האחרון שלך ל{{org}}',
 'יקירנו {{first_name}},

ניסינו לחייב את תרומתך החודשית בסך {{currency}}{{monthly_amount}} ל{{org}} (כרטיס המסתיים ב-{{card_last4}}), אך התשלום לא עבר.

הסיבה שהתקבלה מחברת האשראי: {{error_reason}}

ניתן להסדיר את התרומה מחדש עם פרטים מעודכנים כאן: [DONATE LINK]

אם נוח לך יותר, פשוט השב למייל זה או התקשר אלינו ונסדיר זאת יחד. שותפותך החודשית מחזיקה את תלמידינו ואת גדילתם בתורה — תודה שאתה עומד לצדנו.

בהכרת הטוב,
{{org}}', true);
