-- Root cause of "permission denied for table profiles" (42501) on login:
-- RLS policies were created, but the `authenticated` role was never given
-- base table-level GRANTs. Postgres checks GRANTs before RLS ever runs —
-- without them, every query fails at the privilege check, regardless of
-- policy. RLS stays the real access-control layer; this just lets it run.
-- Run this once in Supabase SQL Editor (Dashboard > SQL Editor > New query > paste > Run)

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;

-- so every future migration's new tables get this automatically too
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
