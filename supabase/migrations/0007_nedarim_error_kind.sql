-- Distinguish genuine card failures from standing orders that simply
-- finished their committed term ("לא פעיל - אין יתרת תשלומים").
alter table public.nedarim_keva add column if not exists error_kind text;
  -- 'card_failure' | 'completed' | null (healthy)
alter table public.nedarim_sync_runs add column if not exists kevas_completed int;
