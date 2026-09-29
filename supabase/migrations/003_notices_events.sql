-- Public site content: notices and events (09-WEBSITE-TEMPLATE-PROMPT.md §5).
--
-- Both tables are readable by anyone — they are the society's public notice
-- board — and writable only by committee/admin, which the API enforces with
-- the service role. RLS plus the SELECT-only policy is the second line of
-- defence: the anon key cannot write or read anything else.

create table if not exists notices (
  id uuid primary key default gen_random_uuid(),
  society_id uuid not null references societies(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 160),
  body text check (char_length(body) <= 4000),
  pinned boolean not null default false,
  published_at timestamptz not null default now(),
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  society_id uuid not null references societies(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 160),
  description text check (char_length(description) <= 4000),
  starts_at timestamptz not null,
  venue text check (char_length(venue) <= 160),
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Pinned notices first, then newest; events by start time.
create index if not exists notices_society_idx
  on notices(society_id, pinned desc, published_at desc);
create index if not exists events_society_idx
  on events(society_id, starts_at);

alter table notices enable row level security;
alter table events enable row level security;

drop policy if exists notices_public_read on notices;
create policy notices_public_read on notices for select using (true);

drop policy if exists events_public_read on events;
create policy events_public_read on events for select using (true);

-- Public reads are the only grant anon/authenticated need.
grant select on notices to anon, authenticated;
grant select on events to anon, authenticated;
grant all on notices to service_role;
grant all on events to service_role;
