-- Saturday bones schema. Text games now, image_url reserved for Drawful later.
create table if not exists rooms (
  code text primary key,
  phase text not null default 'LOBBY',
  game_type text not null default 'text',
  prompt text,
  ends_at timestamptz,
  current_round int not null default 0,
  scores jsonb not null default '{}'::jsonb,
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
