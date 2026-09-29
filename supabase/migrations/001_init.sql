-- SocietyDesk — initial schema
-- Run once in the Supabase SQL editor (single run, in order).
-- Access model: browser = read-only via RLS. All writes = API routes with the
-- service-role key (bypasses RLS) after requireRole().

-- Extensions
create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- Enums
create type user_role as enum ('resident','committee','admin');
create type complaint_category as enum ('water','lift','parking','noise','cleaning','electrical','security','other');
create type complaint_urgency as enum ('critical','high','medium','low');
create type complaint_status as enum ('new','triaged','assigned','in_progress','resolved','closed');
create type complaint_source as enum ('web','import','whatsapp');
create type triage_status as enum ('pending','done','failed');

-- Tables
create table societies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  society_id uuid not null references societies(id) on delete cascade,
  role user_role not null default 'resident',
  full_name text,
  flat_no text,
  phone text,
  preferred_lang text not null default 'en' check (preferred_lang in ('en','hi')),
  created_at timestamptz not null default now()
);
create index profiles_society_idx on profiles(society_id);

create table invites (
  id uuid primary key default gen_random_uuid(),
  society_id uuid not null references societies(id) on delete cascade,
  email text not null,
  role user_role not null default 'resident',
  flat_no text,
  token text not null unique,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references profiles(id) on delete set null,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index invites_email_idx on invites(lower(email));

create table complaint_clusters (
  id uuid primary key default gen_random_uuid(),
  society_id uuid not null references societies(id) on delete cascade,
  title text not null,
  category complaint_category not null,
  urgency complaint_urgency not null default 'medium',
  canonical_complaint_id uuid,
  created_at timestamptz not null default now()
);
create index clusters_society_idx on complaint_clusters(society_id);

create table complaints (
  id uuid primary key default gen_random_uuid(),
  ref_no bigint generated always as identity,
  society_id uuid not null references societies(id) on delete cascade,
  reporter_id uuid references profiles(id) on delete set null,
  reporter_label text,                       -- sender name from chat import
  flat_no text,
  source complaint_source not null default 'web',
  source_hash text,                          -- dedupe re-imports
  raw_text text not null check (char_length(raw_text) between 3 and 1000),
  language text check (language in ('en','hi','hinglish')),
  summary_en text,
  title text,
  category complaint_category not null default 'other',
  urgency complaint_urgency not null default 'medium',
  status complaint_status not null default 'new',
  triage triage_status not null default 'pending',
  location text,
  ai_confidence numeric(3,2),
  ai_reason text,
  needs_review boolean not null default false,
  cluster_id uuid references complaint_clusters(id) on delete set null,
  assignee_id uuid references profiles(id) on delete set null,
  sla_due_at timestamptz,
  resolved_at timestamptz,
  closed_at timestamptz,
  reopened_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table complaint_clusters
  add constraint clusters_canonical_fk foreign key (canonical_complaint_id) references complaints(id) on delete set null;

create unique index complaints_source_hash_uq on complaints(society_id, source_hash) where source_hash is not null;
create index complaints_queue_idx on complaints(society_id, status, urgency);
create index complaints_sla_idx on complaints(society_id, sla_due_at) where status not in ('resolved','closed');
create index complaints_cluster_idx on complaints(cluster_id);
create index complaints_reporter_idx on complaints(reporter_id);
create index complaints_assignee_idx on complaints(assignee_id);
create index complaints_search_idx on complaints using gin ((coalesce(title,'') || ' ' || raw_text) extensions.gin_trgm_ops);

create table complaint_events (
  id uuid primary key default gen_random_uuid(),
  complaint_id uuid not null references complaints(id) on delete cascade,
  actor_id uuid references profiles(id) on delete set null,   -- null = system/AI
  type text not null check (type in ('created','triaged','status_changed','assigned','category_changed','urgency_changed','clustered','reopened','override')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index events_complaint_idx on complaint_events(complaint_id, created_at);

create table comments (
  id uuid primary key default gen_random_uuid(),
  complaint_id uuid not null references complaints(id) on delete cascade,
  author_id uuid references profiles(id) on delete set null,
  body text not null check (char_length(body) between 1 and 2000),
  is_internal boolean not null default false,
  created_at timestamptz not null default now()
);
create index comments_complaint_idx on comments(complaint_id, created_at);

create table rate_limits (
  key text not null,
  window_start timestamptz not null,
  count int not null default 1,
  primary key (key, window_start)
);

-- updated_at trigger
create function set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger complaints_updated before update on complaints
for each row execute function set_updated_at();

-- RLS helpers
create function current_society_id() returns uuid
language sql stable security definer set search_path = public as
$$ select society_id from profiles where id = auth.uid() $$;

create function current_user_role() returns user_role
language sql stable security definer set search_path = public as
$$ select role from profiles where id = auth.uid() $$;

-- Enable RLS everywhere
alter table societies enable row level security;
alter table profiles enable row level security;
alter table invites enable row level security;
alter table complaint_clusters enable row level security;
alter table complaints enable row level security;
alter table complaint_events enable row level security;
alter table comments enable row level security;
alter table rate_limits enable row level security;   -- no policies: service role only

-- Read policies (no insert/update/delete policies => clients cannot write)
create policy societies_read on societies for select
  using (id = current_society_id());

create policy profiles_read on profiles for select
  using (id = auth.uid()
      or (society_id = current_society_id() and current_user_role() in ('committee','admin')));

create policy invites_read on invites for select
  using (society_id = current_society_id() and current_user_role() = 'admin');

create policy clusters_read on complaint_clusters for select
  using (society_id = current_society_id() and current_user_role() in ('committee','admin'));

create policy complaints_read on complaints for select
  using (society_id = current_society_id()
     and (reporter_id = auth.uid() or current_user_role() in ('committee','admin')));

create policy events_read on complaint_events for select
  using (current_user_role() in ('committee','admin')
     and exists (select 1 from complaints c where c.id = complaint_id));

create policy comments_read on comments for select
  using (exists (select 1 from complaints c where c.id = complaint_id)
     and (is_internal = false or current_user_role() in ('committee','admin')));

-- Realtime (optional): allow live updates of the queue
alter publication supabase_realtime add table complaints;
