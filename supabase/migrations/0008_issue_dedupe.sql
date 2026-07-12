-- Concurrent sync runs (rapid manual triggers) could double-create issues
-- for the same standing order. Remove duplicates (keep the oldest open
-- issue per keva) and make recurrence impossible at the DB level.

delete from public.donor_issues di
using public.donor_issues keep
where di.keva_id is not null
  and di.status = 'open'
  and keep.keva_id = di.keva_id
  and keep.status = 'open'
  and (keep.created_at < di.created_at
       or (keep.created_at = di.created_at and keep.id < di.id));

create unique index if not exists issues_open_keva_uniq
  on public.donor_issues (keva_id)
  where keva_id is not null and status = 'open';
