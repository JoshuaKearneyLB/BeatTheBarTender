-- Baropoly v0.1 — initial schema
-- Run via `supabase db push` or paste into the Supabase SQL editor.

-- ---------- enums ----------

create type game_status as enum ('lobby', 'active', 'paused', 'finished');
create type staff_role as enum ('bartender', 'manager');
create type tile_type as enum ('start', 'progress', 'challenge', 'setback', 'bonus', 'checkpoint', 'finish');
create type action_type as enum ('cocktail', 'premium_draft', 'upsell');
create type audit_status as enum ('pending', 'approved', 'rejected');

-- ---------- user profiles ----------
-- One row per staff member, keyed to Supabase Auth.

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  role staff_role not null default 'bartender',
  token_emoji text not null default '🍸',
  created_at timestamptz not null default now()
);

-- ---------- shifts / games ----------

create table games (
  id uuid primary key default gen_random_uuid(),
  name text not null,                          -- "Friday Night Shift"
  status game_status not null default 'lobby',
  board_length int not null default 30 check (board_length between 20 and 40),
  actions_per_tile int not null default 3 check (actions_per_tile between 1 and 20),
  board_seed int not null default 1,           -- deterministic board generation
  manager_pin_hash text,                       -- bcrypt hash; verified in an edge function
  created_by uuid not null references profiles (id),
  winner_player_id uuid,                       -- fk added below (circular)
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------- board tiles ----------
-- Persisted per game (even though generation is deterministic) so audits and
-- manager edits have a concrete record of what the board was.

create table game_tiles (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games (id) on delete cascade,
  position int not null,
  tile_type tile_type not null,
  title text not null,
  description text,
  move_delta int not null default 0,           -- +skip / -setback on landing
  requires_approval boolean not null default false,
  unique (game_id, position)
);

-- ---------- players in a game ----------

create table game_players (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games (id) on delete cascade,
  profile_id uuid not null references profiles (id) on delete cascade,
  display_name text not null,                  -- denormalized for cheap realtime payloads
  token_emoji text not null default '🍸',
  position int not null default 0,
  progress int not null default 0,             -- tally units toward next tile
  awaiting_approval boolean not null default false,
  finished boolean not null default false,
  joined_at timestamptz not null default now(),
  unique (game_id, profile_id)
);

alter table games
  add constraint games_winner_fk
  foreign key (winner_player_id) references game_players (id);

-- ---------- logged actions (the tally taps) ----------

create table action_logs (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games (id) on delete cascade,
  player_id uuid not null references game_players (id) on delete cascade,
  action_type action_type not null,
  units int not null default 1 check (units between 1 and 10),
  receipt_path text,                           -- storage path in the 'receipts' bucket
  voided boolean not null default false,
  voided_by uuid references profiles (id),
  created_at timestamptz not null default now()
);

create index action_logs_game_created_idx on action_logs (game_id, created_at desc);
create index action_logs_player_idx on action_logs (player_id) where not voided;

-- ---------- receipt audits (manager spot-checks) ----------

create table receipt_audits (
  id uuid primary key default gen_random_uuid(),
  action_log_id uuid not null references action_logs (id) on delete cascade,
  reviewed_by uuid not null references profiles (id),
  status audit_status not null default 'pending',
  note text,
  reviewed_at timestamptz not null default now(),
  unique (action_log_id)
);

-- ---------- manager overrides (manual advance / setback / approvals) ----------

create table overrides (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games (id) on delete cascade,
  player_id uuid not null references game_players (id) on delete cascade,
  delta int not null,                          -- tiles moved; 0 for a pure approval
  reason text not null,                        -- "Failed Audit", "Win approved", ...
  created_by uuid not null references profiles (id),
  created_at timestamptz not null default now()
);

-- ---------- row level security ----------

alter table profiles enable row level security;
alter table games enable row level security;
alter table game_tiles enable row level security;
alter table game_players enable row level security;
alter table action_logs enable row level security;
alter table receipt_audits enable row level security;
alter table overrides enable row level security;

create function is_manager() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'manager');
$$;

-- Everyone signed in can read shared game state (it's a shared board).
create policy "read profiles" on profiles for select to authenticated using (true);
create policy "read games" on games for select to authenticated using (true);
create policy "read tiles" on game_tiles for select to authenticated using (true);
create policy "read players" on game_players for select to authenticated using (true);
create policy "read actions" on action_logs for select to authenticated using (true);
create policy "read audits" on receipt_audits for select to authenticated using (true);
create policy "read overrides" on overrides for select to authenticated using (true);

-- Self-service writes.
create policy "update own profile" on profiles for update to authenticated
  using (id = auth.uid());
create policy "join a game" on game_players for insert to authenticated
  with check (profile_id = auth.uid());
create policy "log own actions" on action_logs for insert to authenticated
  with check (exists (
    select 1 from game_players gp
    where gp.id = player_id and gp.profile_id = auth.uid() and gp.game_id = action_logs.game_id
  ));

-- Manager-only writes. Position/progress mutation goes through server-side
-- RPCs in v0.2; for v0.1 the manager role is trusted to update player rows.
create policy "managers create games" on games for insert to authenticated with check (is_manager());
create policy "managers update games" on games for update to authenticated using (is_manager());
create policy "managers write tiles" on game_tiles for insert to authenticated with check (is_manager());
create policy "managers move players" on game_players for update to authenticated using (is_manager());
create policy "managers void actions" on action_logs for update to authenticated using (is_manager());
create policy "managers audit" on receipt_audits for insert to authenticated with check (is_manager());
create policy "managers override" on overrides for insert to authenticated with check (is_manager());

-- ---------- realtime ----------

alter publication supabase_realtime add table game_players, action_logs, games;

-- ---------- storage ----------
-- Receipt photos live in a private 'receipts' bucket; paths land in
-- action_logs.receipt_path and are served to managers via signed URLs.

insert into storage.buckets (id, name, public) values ('receipts', 'receipts', false);

create policy "staff upload receipts" on storage.objects for insert to authenticated
  with check (bucket_id = 'receipts');
create policy "staff read receipts" on storage.objects for select to authenticated
  using (bucket_id = 'receipts');
