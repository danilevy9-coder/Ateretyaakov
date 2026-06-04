-- ════════════════════════════════════════════════════════════════════
-- Email suppression / unsubscribe support.
-- Each donor gets an unguessable token used in the unsubscribe link.
-- ════════════════════════════════════════════════════════════════════

alter table public.donors add column if not exists unsubscribed boolean not null default false;
alter table public.donors add column if not exists unsubscribed_at timestamptz;
alter table public.donors add column if not exists unsubscribe_token uuid not null default gen_random_uuid();

create index if not exists donors_unsub_token_idx on public.donors (unsubscribe_token);
create index if not exists donors_unsubscribed_idx on public.donors (unsubscribed);
