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
