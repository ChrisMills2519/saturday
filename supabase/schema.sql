-- Saturday bones schema. Text games now, image_url reserved for Drawful later.
create table if not exists rooms (
  code text primary key,
  phase text not null default 'LOBBY',
  game_type text not null default 'text',
  prompt text,
  prompt_hint text,
  ends_at timestamptz,
  current_round int not null default 0,
  total_rounds int not null default 3,
  scores jsonb not null default '{}'::jsonb,
  -- Monotonic bump per mutation (join/start/submit/vote/next). Clients
  -- drop broadcasts with seq <= last seen (out-of-order delivery guard).
  seq int not null default 0,
  -- No-repeat prompt bookkeeping (json array of strings, length = rounds played).
  used_prompts jsonb not null default '[]'::jsonb,
  -- Frozen INPUT roster so late joins don't inflate the typing denominator.
  input_total int,
  -- Light host auth for start/next/kick/extend (new games get one; legacy rooms stay open).
  host_token text,
  -- Per-round vote deltas: { "1": {session: pts}, "2": {...} } — powers phone history + host MVP.
  round_history jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists players (
  id bigint generated always as identity primary key,
  room_code text references rooms(code) on delete cascade,
  session_id text not null,
  name text not null,
  connected boolean default true,
  created_at timestamptz default now(),
  unique(room_code, session_id)
);

create table if not exists submissions (
  id bigint generated always as identity primary key,
  room_code text references rooms(code) on delete cascade,
  round int not null,
  player_session text not null,
  text_content text,
  image_url text,
  votes int not null default 0,
  created_at timestamptz default now(),
  unique(room_code, round, player_session)
);

-- One vote per voter per round. Server inserts here first, so spam-clicks
-- and double-votes collapse to a single row (unique voter guard).
-- Run this file in the Supabase SQL Editor after pulling ("Success. No rows returned").
create table if not exists votes (
  id bigint generated always as identity primary key,
  room_code text references rooms(code) on delete cascade,
  round int not null,
  voter_session text not null,
  target_session text not null,
  created_at timestamptz default now(),
  unique(room_code, round, voter_session)
);

-- TTL cleanup (auto-expire rooms older than 24h via /api/cleanup + Vercel
-- Cron, plus opportunistic purge on room creation). Cascade on the FKs
-- below means deleting the room row removes players/submissions/votes.
-- Delta migration for live rooms (no drop): new columns added idempotently; defaults keep old snapshots valid.
alter table public.rooms add column if not exists prompt_hint text;
alter table public.rooms add column if not exists used_prompts jsonb not null default '[]'::jsonb;
alter table public.rooms add column if not exists input_total int;
alter table public.rooms add column if not exists host_token text;
alter table public.rooms add column if not exists round_history jsonb not null default '{}'::jsonb;

create index if not exists rooms_created_at_idx on public.rooms (created_at);

-- API role grants. Tables created in the SQL Editor are owned by postgres,
-- but PostgREST serves the anon / authenticated / service_role roles, so a
-- fresh table answers 403 "permission denied" until granted (hit on `votes`
-- 2026-09-15: rooms/players/submissions worked, votes 403'd). service_role
-- bypasses RLS, so grants alone fix the API routes; anon stays read-only
-- (all writes go through API routes with service_role). Safe to re-run.
grant select, insert, update, delete on public.rooms to service_role;
grant select, insert, update, delete on public.players to service_role;
grant select, insert, update, delete on public.submissions to service_role;
grant select, insert, update, delete on public.votes to service_role;

-- Identity columns allocate from sequences; inserts fail without USAGE.
grant usage, select on all sequences in schema public to service_role;

grant select on public.rooms to anon, authenticated;
grant select on public.players to anon, authenticated;
grant select on public.submissions to anon, authenticated;
grant select on public.votes to anon, authenticated;
