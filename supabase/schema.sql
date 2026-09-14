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
