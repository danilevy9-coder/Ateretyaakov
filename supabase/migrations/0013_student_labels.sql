-- ════════════════════════════════════════════════════════════════════
-- Ateret Yaakov CRM — labels for STUDENTS (optional, one time).
--
-- Donor labels need nothing: they use the existing `categories` +
-- `donor_categories` tables. This adds the same thing for students:
-- one shared label list (`categories`), linked to students through a new
-- `student_categories` table. Safe to run more than once.
--
-- Access: locked to danilevy9@gmail.com only, the same rule as the rest of
-- the CRM since Oct 22 2026. Anonymous visitors get nothing.
-- ════════════════════════════════════════════════════════════════════

create table if not exists public.student_categories (
  student_id  uuid not null references public.students(id)   on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (student_id, category_id)
);
create index if not exists student_cat_cat_idx on public.student_categories (category_id);

alter table public.student_categories enable row level security;

drop policy if exists student_categories_admin_all on public.student_categories;
create policy student_categories_admin_all on public.student_categories
  for all to authenticated
  using      ((auth.jwt() ->> 'email') = 'danilevy9@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'danilevy9@gmail.com');

-- Make the new table visible to the API straight away.
notify pgrst, 'reload schema';

-- Check: should list one policy for student_categories.
select tablename, policyname, qual from pg_policies
where schemaname = 'public' and tablename = 'student_categories';
