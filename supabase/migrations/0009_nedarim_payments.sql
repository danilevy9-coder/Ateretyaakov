-- ════════════════════════════════════════════════════════════════════
-- Nedarim transaction history + recovery-workbench actions.
-- ════════════════════════════════════════════════════════════════════

-- ── every processed payment, mirrored from GetHistoryJson ───────────
create table if not exists public.nedarim_payments (
  id              uuid primary key default gen_random_uuid(),
  transaction_id  text not null unique,
  transaction_num bigint,                        -- numeric form, for cursoring
  keva_id         text,                          -- set for standing-order charges
  donor_id        uuid references public.donors(id) on delete set null,
  client_name     text,
  zeout           text,
  email           text,
  phone           text,
  amount          numeric(12,2),
  currency        text not null default 'ILS',
  paid_at         timestamptz,
  transaction_type text,                         -- רגיל / תשלומים / הו"ק
  confirmation    text,
  shovar          text,
  last_num        text,
  groupe          text,
  comments        text,
  masof_id        text,
  receipt_id      text,                          -- KabalaId
  raw             jsonb,
  created_at      timestamptz not null default now()
);
create index if not exists nedarim_pay_donor_idx on public.nedarim_payments (donor_id);
create index if not exists nedarim_pay_keva_idx  on public.nedarim_payments (keva_id);
create index if not exists nedarim_pay_paid_idx  on public.nedarim_payments (paid_at desc);
create index if not exists nedarim_pay_num_idx   on public.nedarim_payments (transaction_num desc);

alter table public.nedarim_sync_runs add column if not exists payments_imported int;

-- ── manual recovery actions on issues ───────────────────────────────
alter table public.donor_issues add column if not exists last_called_at timestamptz;
alter table public.donor_issues add column if not exists snooze_reason text;

-- ── per-donor giving stats for the recovery workbench ───────────────
create or replace function public.nedarim_donor_payment_stats(donor_ids uuid[])
returns table (donor_id uuid, total_paid numeric, payment_count bigint, last_paid timestamptz)
language sql stable as $$
  select p.donor_id, sum(p.amount), count(*), max(p.paid_at)
  from public.nedarim_payments p
  where p.donor_id = any(donor_ids)
  group by p.donor_id;
$$;

-- ── RLS ──────────────────────────────────────────────────────────────
alter table public.nedarim_payments enable row level security;
drop policy if exists nedarim_payments_admin_all on public.nedarim_payments;
create policy nedarim_payments_admin_all on public.nedarim_payments
  for all to authenticated using (true) with check (true);
