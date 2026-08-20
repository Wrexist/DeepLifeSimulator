-- ─────────────────────────────────────────────────────────────────────────────
-- Deep Life Simulator — Beta Hub schema
--
-- Lives in the SAME Supabase project as cloud save / leaderboard / analytics
-- (`deeplife-backend`, gyxmoqanjdvvllwjfsst). It follows the conventions that
-- project already uses, documented in docs/CLOUD-SAVE-BACKEND.md:
--
--   * RLS is ENABLED on every table with NO policies. anon/authenticated can do
--     nothing at all; the `betahub` edge function reaches the tables with the
--     service role. The Supabase linter reports `rls_enabled_no_policy` as INFO
--     — that is the intended posture here too, not a gap.
--   * Admin auth is a bearer token compared against a row in `beta_config`.
--     Unlike `cloud_auth_token` this one is NEVER shipped to a client bundle:
--     it is typed into the admin page by the operator and held in sessionStorage
--     for the tab's lifetime only. It IS a real secret.
--
-- Everything here is additive. Nothing touches cloud_saves / leaderboard_entries
-- / analytics_events / backend_config.
-- ─────────────────────────────────────────────────────────────────────────────

-- Key/value settings the admin dashboard edits (Play URLs, launch mode, target
-- tester count, …). Separate from `backend_config` so a Beta Hub write can never
-- touch the cloud-save auth token.
create table if not exists public.beta_config (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now()
);

-- One row per real person who signed up.
--
-- `token` is a capability token minted server-side and handed to the browser
-- once. It is how a tester reaches their own dashboard without an account or a
-- password. It grants access to exactly one tester row and nothing else.
create table if not exists public.beta_testers (
  id             uuid primary key default gen_random_uuid(),
  token          text unique not null,
  nickname       text not null,
  contact        text,
  contact_kind   text not null default 'none'
                 check (contact_kind in ('none','email','discord','other')),
  country        text,
  device         text,
  age_range      text,
  source         text not null default 'direct',
  campaign       text,
  referral_code  text unique not null,
  referred_by    uuid references public.beta_testers(id) on delete set null,
  -- Funnel flags. Each is set by the tester's own confirmation in their
  -- dashboard — NOTHING here is inferred from Google Play, which the Beta Hub
  -- has no visibility into and must not pretend to.
  opted_in       boolean not null default false,
  installed      boolean not null default false,
  played         boolean not null default false,
  waitlisted     boolean not null default false,
  completed      boolean not null default false,
  xp             integer not null default 0 check (xp >= 0),
  missions_done  text[]  not null default '{}',
  notes          text,
  created_at     timestamptz not null default now(),
  last_seen_at   timestamptz not null default now()
);

create index if not exists beta_testers_source_idx     on public.beta_testers (source);
create index if not exists beta_testers_created_idx    on public.beta_testers (created_at desc);
create index if not exists beta_testers_last_seen_idx  on public.beta_testers (last_seen_at desc);

create table if not exists public.beta_feedback (
  id          uuid primary key default gen_random_uuid(),
  tester_id   uuid references public.beta_testers(id) on delete cascade,
  rating      integer check (rating between 1 and 5),
  mood        text,
  categories  text[] not null default '{}',
  best        text,
  confusing   text,
  change      text,
  keep        text,
  stop        text,
  app_version text,
  hub_version text,
  created_at  timestamptz not null default now()
);
create index if not exists beta_feedback_created_idx on public.beta_feedback (created_at desc);

create table if not exists public.beta_bugs (
  id            uuid primary key default gen_random_uuid(),
  tester_id     uuid references public.beta_testers(id) on delete set null,
  title         text not null,
  description   text,
  steps         text,
  expected      text,
  actual        text,
  device        text,
  android       text,
  app_version   text,
  hub_version   text,
  severity      text not null default 'medium'
                check (severity in ('low','medium','high','critical')),
  category      text not null default 'other',
  attachment    text,
  status        text not null default 'open'
                check (status in ('open','triaged','fixed','wontfix','duplicate')),
  created_at    timestamptz not null default now()
);
create index if not exists beta_bugs_status_idx on public.beta_bugs (status, created_at desc);

create table if not exists public.beta_ideas (
  id          uuid primary key default gen_random_uuid(),
  tester_id   uuid references public.beta_testers(id) on delete set null,
  title       text not null,
  description text,
  why         text,
  priority    text not null default 'nice'
              check (priority in ('nice','want','need')),
  status      text not null default 'new'
              check (status in ('new','considering','planned','building','shipped','declined')),
  votes       integer not null default 0 check (votes >= 0),
  created_at  timestamptz not null default now()
);
create index if not exists beta_ideas_votes_idx on public.beta_ideas (votes desc, created_at desc);

-- One vote per tester per idea, enforced by the PK rather than by a client
-- check — the same "gate and grant in one atomic step" rule the game itself
-- lives by. A double-tapped vote button hits a unique violation, not a double
-- count.
create table if not exists public.beta_idea_votes (
  idea_id    uuid not null references public.beta_ideas(id) on delete cascade,
  tester_id  uuid not null references public.beta_testers(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (idea_id, tester_id)
);

-- First-party funnel analytics. Deliberately holds NO personal data and no raw
-- IP: `visitor` is a random id minted in the browser, and that is the whole
-- identity model.
create table if not exists public.beta_events (
  id         bigserial primary key,
  type       text not null,
  visitor    text,
  tester_id  uuid references public.beta_testers(id) on delete set null,
  source     text,
  campaign   text,
  path       text,
  meta       jsonb,
  created_at timestamptz not null default now()
);
create index if not exists beta_events_type_idx    on public.beta_events (type, created_at desc);
create index if not exists beta_events_source_idx  on public.beta_events (source, created_at desc);
create index if not exists beta_events_visitor_idx on public.beta_events (visitor);

-- Community: announcements / devlog entries, and the public roadmap.
create table if not exists public.beta_posts (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null default 'announcement'
             check (kind in ('announcement','devlog')),
  title      text not null,
  body       text not null,
  pinned     boolean not null default false,
  published  boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.beta_roadmap (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  detail     text,
  column_key text not null default 'coming'
             check (column_key in ('coming','building','done')),
  sort       integer not null default 0,
  created_at timestamptz not null default now()
);

-- Soft abuse barrier for the unauthenticated write endpoints. Keyed on a SALTED
-- HASH of the caller IP, never the IP itself, and swept by the function on
-- write, so the table cannot become a log of who visited.
create table if not exists public.beta_ratelimit (
  bucket     text primary key,
  hits       integer not null default 0,
  expires_at timestamptz not null
);

alter table public.beta_config     enable row level security;
alter table public.beta_testers    enable row level security;
alter table public.beta_feedback   enable row level security;
alter table public.beta_bugs       enable row level security;
alter table public.beta_ideas      enable row level security;
alter table public.beta_idea_votes enable row level security;
alter table public.beta_events     enable row level security;
alter table public.beta_posts      enable row level security;
alter table public.beta_roadmap    enable row level security;
alter table public.beta_ratelimit  enable row level security;

-- Atomic vote: insert the ballot and increment the tally in ONE statement, so a
-- double-submitted vote cannot land twice and a lost increment cannot leave a
-- ballot with no tally. Returns the new total, or NULL when already voted.
create or replace function public.beta_cast_vote(p_idea uuid, p_tester uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total integer;
begin
  insert into public.beta_idea_votes (idea_id, tester_id)
  values (p_idea, p_tester)
  on conflict do nothing;

  if not found then
    return null;
  end if;

  update public.beta_ideas
     set votes = votes + 1
   where id = p_idea
  returning votes into v_total;

  return v_total;
end;
$$;

revoke all on function public.beta_cast_vote(uuid, uuid) from public, anon, authenticated;

-- Why this still leaves the edge function able to call it: Supabase ships
-- ALTER DEFAULT PRIVILEGES for `postgres`/`supabase_admin` in schema public
-- granting EXECUTE on new functions to anon, authenticated AND service_role,
-- so creation stamps all three on explicitly. The revoke above names only
-- public, anon and authenticated, which leaves service_role's own grant
-- standing — exactly the intent, since the edge function reaches this through
-- `rpc/beta_cast_vote` with the service key. Do NOT widen the revoke to
-- service_role: that kills idea voting outright.
