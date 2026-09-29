-- Local development seed. `supabase db reset` loads this after the migrations,
-- so a brand-new local stack needs no manual SQL: the society exists and an
-- admin invite is already waiting for the address below.
--
-- The cloud bootstrap template lives in ./seed.sql; that one is for the hosted
-- project (paste it into the SQL editor) and is not part of a local reset.

insert into societies (id, name)
values ('00000000-0000-0000-0000-000000000001', 'My Society')
on conflict (id) do nothing;

insert into invites (society_id, email, role, token, expires_at)
values (
  '00000000-0000-0000-0000-000000000001',
  'admin@local.test',
  'admin',
  'localdev0000000000000000000000000000000000000000000000000000000000',
  now() + interval '365 days'
)
on conflict (token) do nothing;

select 'local admin invite ready for admin@local.test' as seed_status;
