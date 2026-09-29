-- Bootstrap: create the society and a one-time admin invite.
-- Replace ADMIN_EMAIL@example.com with the address that will sign in first,
-- then run this in the Supabase SQL editor.

insert into societies (id, name)
values ('00000000-0000-0000-0000-000000000001', 'My Society')
on conflict (id) do nothing;

insert into invites (society_id, email, role, token, expires_at)
values (
  '00000000-0000-0000-0000-000000000001',
  'ADMIN_EMAIL@example.com',
  'admin',
  encode(gen_random_bytes(24), 'hex'),
  now() + interval '7 days'
);

select token from invites where email = 'ADMIN_EMAIL@example.com';
