-- DeepLife Simulator — cloud save + leaderboard schema.
--
-- This file is a faithful capture of the schema ALREADY LIVE in the
-- `deeplife-backend` project (gyxmoqanjdvvllwjfsst), reconstructed by
-- introspecting the running database on 2026-08-20 — not written from memory.
-- Every statement is idempotent, so re-running it against the live project is
-- a no-op.
--
-- RLS is enabled on every table WITH NO POLICIES, deliberately. `anon` and
-- `authenticated` can therefore do nothing at all; the edge functions reach
-- these tables with the service role. The Supabase linter reports
-- `rls_enabled_no_policy` as INFO for each — that is the intended posture, not
-- a gap. Matches server/beta-hub/schema.sql and docs/CLOUD-SAVE-BACKEND.md.

-- The shared bearer token both edge functions check on every request.
-- `cloud_auth_token` is the only key the functions read. It is only an abuse
-- barrier, not a real secret: it ships inlined in the app bundle, so anyone
-- with the APK can read it. Do not put anything here that must stay private.
create table if not exists public.backend_config (
  key         text primary key,
  value       text not null,
  updated_at  timestamptz not null default now()
);

-- One row per (device, slot). The device id is anonymous and minted client
-- side; see services/CloudSyncService.ts `resolveUserId`.
create table if not exists public.cloud_saves (
  user_id     text not null,
  slot_id     text not null check (slot_id ~ '^slot_[1-3]$'),
  state       jsonb not null,
  -- Epoch MILLISECONDS, mirroring GameState.updatedAt. bigint, not integer:
  -- an epoch-ms value overflows int4 by three orders of magnitude.
  updated_at  bigint not null,
  -- Monotonic per (user, slot). The function answers 409 to anything at or
  -- below what it already holds, so an older write can never clobber a newer
  -- backup. int4 — the client caps at 2147483647 to match.
  revision    integer not null check (revision >= 1),
  hash        text not null,
  signature   text not null,
  -- Server clock, used for the write-rate limiter and for retention pruning.
  -- Distinct from updated_at, which is the CLIENT's game-state stamp and is
  -- therefore attacker-controlled.
  received_at timestamptz not null default now(),
  primary key (user_id, slot_id)
);

-- One row per (category, device): each player's personal best, never lowered.
create table if not exists public.leaderboard_entries (
  category      text not null,
  user_id       text not null,
  name          text not null,
  score         numeric not null check (score >= 0),
  run_signature text not null,
  revision      integer not null check (revision >= 1),
  created_at    timestamptz not null default now(),
  primary key (category, user_id)
);

alter table public.backend_config      enable row level security;
alter table public.cloud_saves         enable row level security;
alter table public.leaderboard_entries enable row level security;

-- ---------------------------------------------------------------------------
-- Transfer codes — cross-device restore WITHOUT accounts.
--
-- A code is a BEARER CREDENTIAL: whoever holds it gets the save. That single
-- fact drives every choice below — short TTL, single use, high entropy, and an
-- atomic claim.
create table if not exists public.save_transfer_codes (
  code       text primary key,
  user_id    text not null,          -- the device the code was minted FOR
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  claimed_at timestamptz,            -- null = still spendable
  claimed_by text                    -- the device that spent it
);
create index if not exists save_transfer_codes_user_idx
  on public.save_transfer_codes (user_id);

alter table public.save_transfer_codes enable row level security;

-- Claim a transfer code and copy the saves, in ONE transaction.
--
-- The UPDATE's WHERE clause is the gate and the same statement is the grant, so
-- two devices racing the same code cannot both win: exactly one UPDATE matches
-- the `claimed_at is null` predicate and the other returns no row. This is
-- CLAUDE.md section 4.4's gate-then-grant rule in server form — the identical
-- double-tap bug class, over HTTP instead of a React batch. Doing the check in
-- the edge function and the write afterwards would reintroduce precisely the
-- race the rule exists to prevent.
--
-- Returns: -1 unknown/expired/already-claimed, otherwise the number of slots
-- copied (0 is legitimate — a code minted by a device with no saves yet).
create or replace function public.claim_save_transfer(p_code text, p_new_user text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source  text;
  v_copied  integer;
begin
  update public.save_transfer_codes
     set claimed_at = now(), claimed_by = p_new_user
   where code = p_code
     and claimed_at is null
     and expires_at > now()
  returning user_id into v_source;

  if v_source is null then
    return -1;
  end if;

  -- Claiming your own code is a no-op, not an error.
  if v_source = p_new_user then
    return 0;
  end if;

  -- COPY, never repoint. If the claiming device simply adopted the source id,
  -- two phones would write to one key and clobber each other on every backup.
  -- Copying leaves the old phone working and lets the two diverge.
  insert into public.cloud_saves as tgt
        (user_id, slot_id, state, updated_at, revision, hash, signature, received_at)
  select p_new_user, s.slot_id, s.state, s.updated_at, s.revision, s.hash, s.signature, now()
    from public.cloud_saves s
   where s.user_id = v_source
  on conflict (user_id, slot_id) do update
     set state      = excluded.state,
         updated_at = excluded.updated_at,
         -- Outrank whatever the claiming device already had in this slot, so
         -- its own next upload cannot be refused as stale against the copy.
         revision   = greatest(tgt.revision, excluded.revision) + 1,
         hash       = excluded.hash,
         signature  = excluded.signature,
         received_at = now();

  get diagnostics v_copied = row_count;
  return v_copied;
end;
$$;

-- anon/authenticated reach nothing here. service_role keeps the EXECUTE that
-- Supabase's ALTER DEFAULT PRIVILEGES stamps on new functions, which is what
-- the edge function calls it with. Widening this revoke to service_role would
-- break claiming outright (same trap as beta_cast_vote; see server/beta-hub).
revoke all on function public.claim_save_transfer(text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Retention: 18 months from the last upload, per the owner's decision on
-- 2026-08-20. Long enough that a player returning after a year still finds
-- their save; short enough to be a defensible storage-limitation position.
-- Keep this number in step with the privacy policy.
create or replace function public.prune_abandoned_cloud_saves()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_deleted integer;
begin
  delete from public.cloud_saves
   where received_at < now() - interval '18 months';
  get diagnostics v_deleted = row_count;

  -- Spent and expired codes are not worth keeping once they can never be
  -- claimed again; the week of slack keeps them briefly for support questions.
  delete from public.save_transfer_codes
   where expires_at < now() - interval '7 days';

  return v_deleted;
end;
$$;

revoke all on function public.prune_abandoned_cloud_saves() from public, anon, authenticated;

-- Daily at 03:17 UTC. An odd minute on purpose: it keeps the job off the
-- top-of-hour spike every other scheduled thing lands on. cron.schedule upserts
-- by job name, so re-running this file is safe.
create extension if not exists pg_cron;
select cron.schedule(
  'prune-abandoned-cloud-saves',
  '17 3 * * *',
  $$select public.prune_abandoned_cloud_saves()$$
);

-- ---------------------------------------------------------------------------
-- Rate limiting for transfer-code claims.
--
-- A code carries ~49.5 bits of entropy and lives 15 minutes, so brute force is
-- already infeasible on the numbers alone. This is defence in depth: it caps
-- how fast a single device can guess, and it costs one row.
create table if not exists public.save_ratelimit (
  bucket     text primary key,
  hits       integer not null default 0,
  expires_at timestamptz not null
);
alter table public.save_ratelimit enable row level security;

-- Increment-and-check in ONE statement. A read-then-write in the edge function
-- would let two concurrent requests both observe "under the limit" and both
-- proceed — the same gate-then-grant race claim_save_transfer avoids.
-- Returns true when the caller is still within the limit.
create or replace function public.save_ratelimit_hit(
  p_bucket text, p_limit integer, p_window interval
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_hits integer;
begin
  insert into public.save_ratelimit as r (bucket, hits, expires_at)
  values (p_bucket, 1, now() + p_window)
  on conflict (bucket) do update
    set hits = case when r.expires_at < now() then 1 else r.hits + 1 end,
        expires_at = case when r.expires_at < now() then now() + p_window else r.expires_at end
  returning r.hits into v_hits;
  return v_hits <= p_limit;
end;
$$;

revoke all on function public.save_ratelimit_hit(text, integer, interval) from public, anon, authenticated;
