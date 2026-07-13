-- Latin-script name variant (hebrew_name already exists) so bilingual
-- emails can greet donors in the right script in each language section.
alter table public.donors add column if not exists latin_name text;
