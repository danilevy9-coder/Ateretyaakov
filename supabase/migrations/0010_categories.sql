-- ════════════════════════════════════════════════════════════════════
-- Donor categories — admin-defined labels, many per donor.
-- ════════════════════════════════════════════════════════════════════

create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  name        text not null unique,
  color       text not null default '#f59e0b'   -- hex, drives the chip color
);

create table if not exists public.donor_categories (
  donor_id    uuid not null references public.donors(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (donor_id, category_id)
);
create index if not exists donor_cat_cat_idx on public.donor_categories (category_id);

do $$
declare t text;
begin
  foreach t in array array['categories','donor_categories']
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists %I on public.%I;', t||'_admin_all', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (true) with check (true);',
      t||'_admin_all', t
    );
  end loop;
end $$;
