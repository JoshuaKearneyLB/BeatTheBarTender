-- Baropoly v0.3 — "Monthly Marathon": manager-configured quests per tile.
--
-- Movement is no longer tap-tally driven. Every tile carries a goal set by
-- the manager (volume / upsell / task + target + move value). Bartenders
-- submit quest completions with an optional till/receipt photo; approval
-- (manager batch review, or auto-trust for non-winning tiles) advances the
-- player by the tile's move value. Completing the FINAL tile's quest wins.

-- ---------- new enums ----------

create type goal_type as enum ('volume', 'upsell', 'task');
create type submission_status as enum ('pending', 'approved', 'rejected');

-- ---------- schema changes ----------

alter table game_tiles
  add column goal_type goal_type not null default 'volume',
  add column goal_target int not null default 1 check (goal_target between 1 and 999),
  add column goal_label text not null default 'Complete the shift goal',
  add column move_value int not null default 1 check (move_value between 1 and 3);

alter table games
  add column auto_approve boolean not null default false,
  add column campaign_preset text;

create table quest_submissions (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games (id) on delete cascade,
  player_id uuid not null references game_players (id) on delete cascade,
  tile_position int not null,
  claimed_value int not null check (claimed_value between 0 and 999),
  note text,
  photo_path text,                             -- 'receipts' bucket; signed URLs for review
  status submission_status not null default 'pending',
  reviewed_by uuid references profiles (id),
  reviewed_at timestamptz,
  review_note text,
  submitted_at timestamptz not null default now()
);

create index quest_submissions_queue_idx on quest_submissions (game_id, status, submitted_at);

alter table quest_submissions enable row level security;
create policy "read submissions" on quest_submissions for select to authenticated using (true);
-- All writes go through the security-definer RPCs below.

alter publication supabase_realtime add table quest_submissions;

-- ---------- retire the v0.2 tally write path ----------
-- Leaving these callable would let a bartender move without quest approval.
-- action_logs stays as historical data; no RPC writes to it anymore.

drop function if exists log_action(uuid, action_type, int, text);
drop function if exists void_last_action(uuid);
drop function if exists manager_approve(uuid, uuid, text);
drop function if exists create_game(text, int, int, int, text, jsonb);
drop function if exists _advance(uuid, int, int, int, int, boolean, boolean, int);

-- ---------- campaign lifecycle ----------

-- Tiles arrive as jsonb from the Campaign Preset Builder: a preset the
-- manager picked, possibly with per-tile edits. Persisted verbatim so the
-- board is auditable and editable history.
create or replace function create_campaign(
  p_name text,
  p_board_length int,
  p_preset text,
  p_auto_approve boolean,
  p_pin text,
  p_tiles jsonb
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_game_id uuid; t jsonb;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  if jsonb_array_length(p_tiles) <> p_board_length then
    raise exception 'tile count % does not match board length %', jsonb_array_length(p_tiles), p_board_length;
  end if;
  insert into profiles (id, display_name)
  values (auth.uid(), 'Manager')
  on conflict (id) do nothing;

  insert into games (name, status, board_length, actions_per_tile, board_seed,
                     auto_approve, campaign_preset, manager_pin_hash, created_by, started_at)
  values (
    p_name, 'active', p_board_length, 1, 0,
    coalesce(p_auto_approve, false), p_preset,
    case when nullif(p_pin, '') is null then null else crypt(p_pin, gen_salt('bf')) end,
    auth.uid(), now()
  )
  returning id into v_game_id;

  for t in select * from jsonb_array_elements(p_tiles) loop
    insert into game_tiles (game_id, position, tile_type, title, description, move_delta,
                            requires_approval, goal_type, goal_target, goal_label, move_value)
    values (
      v_game_id,
      (t ->> 'position')::int,
      (t ->> 'type')::tile_type,
      t ->> 'title',
      t ->> 'description',
      coalesce((t ->> 'move')::int, 0),
      false,
      coalesce((t -> 'goal' ->> 'type')::goal_type, 'volume'),
      coalesce((t -> 'goal' ->> 'target')::int, 1),
      coalesce(t -> 'goal' ->> 'label', 'Complete the shift goal'),
      coalesce((t ->> 'moveValue')::int, 1)
    );
  end loop;

  return v_game_id;
end $$;

-- ---------- bartender quest flow ----------

-- Live progress counter toward the current tile's goal, so every board
-- viewer sees it tick up in realtime. Purely informational until submit.
create or replace function update_progress(p_player_id uuid, p_progress int)
returns game_players
language plpgsql security definer set search_path = public as $$
declare v_player game_players;
begin
  select * into v_player from game_players where id = p_player_id for update;
  if not found or v_player.profile_id <> auth.uid() then
    raise exception 'not your player';
  end if;
  if v_player.awaiting_approval or v_player.finished then
    raise exception 'player is locked';
  end if;
  update game_players
  set progress = greatest(0, least(p_progress, 999))
  where id = p_player_id
  returning * into v_player;
  return v_player;
end $$;

-- Advance machinery shared by review + auto-trust. Completing the final
-- tile's quest wins; otherwise move by the tile's move_value, then apply
-- the landing tile's effect once (no chaining) — mirrors lib/board.ts.
create or replace function _apply_quest_approval(
  p_submission_id uuid,
  p_reviewer uuid,
  p_note text
) returns game_players
language plpgsql security definer set search_path = public as $$
declare v_sub quest_submissions; v_player game_players; v_game games;
        v_move int; v_delta int; v_new_pos int;
begin
  update quest_submissions
  set status = 'approved', reviewed_by = p_reviewer, reviewed_at = now(), review_note = p_note
  where id = p_submission_id and status = 'pending'
  returning * into v_sub;
  if not found then
    raise exception 'submission is not pending';
  end if;

  select * into v_player from game_players where id = v_sub.player_id for update;
  select * into v_game from games where id = v_player.game_id;

  if v_player.position >= v_game.board_length - 1 then
    update game_players
    set awaiting_approval = false, finished = true, progress = 0
    where id = v_player.id
    returning * into v_player;
    update games
    set status = 'finished', winner_player_id = v_player.id, ended_at = now()
    where id = v_game.id and status <> 'finished';
    return v_player;
  end if;

  select move_value into v_move
  from game_tiles where game_id = v_game.id and position = v_player.position;
  v_new_pos := least(v_player.position + coalesce(v_move, 1), v_game.board_length - 1);

  select coalesce(move_delta, 0) into v_delta
  from game_tiles where game_id = v_game.id and position = v_new_pos;
  if coalesce(v_delta, 0) <> 0 then
    v_new_pos := greatest(0, least(v_new_pos + v_delta, v_game.board_length - 1));
  end if;

  update game_players
  set position = v_new_pos, progress = 0, awaiting_approval = false
  where id = v_player.id
  returning * into v_player;
  return v_player;
end $$;

-- One submission per quest at a time. Auto-trust approves immediately —
-- except a submission on the final tile, which always waits for the manager
-- (the win is the one milestone that must be human-verified).
create or replace function submit_quest(
  p_player_id uuid,
  p_claimed_value int,
  p_note text default null,
  p_photo_path text default null
) returns quest_submissions
language plpgsql security definer set search_path = public as $$
declare v_player game_players; v_game games; v_sub quest_submissions;
begin
  select * into v_player from game_players where id = p_player_id for update;
  if not found or v_player.profile_id <> auth.uid() then
    raise exception 'not your player';
  end if;
  select * into v_game from games where id = v_player.game_id;
  if v_game.status <> 'active' then
    raise exception 'game is not active';
  end if;
  if v_player.finished then
    raise exception 'player already finished';
  end if;
  if v_player.awaiting_approval then
    raise exception 'a submission is already pending for this quest';
  end if;

  insert into quest_submissions (game_id, player_id, tile_position, claimed_value, note, photo_path)
  values (v_game.id, v_player.id, v_player.position, p_claimed_value, nullif(trim(coalesce(p_note, '')), ''), p_photo_path)
  returning * into v_sub;

  update game_players set awaiting_approval = true where id = v_player.id;

  if v_game.auto_approve and v_player.position < v_game.board_length - 1 then
    perform _apply_quest_approval(v_sub.id, v_player.profile_id, 'Auto-approved (trust mode)');
    select * into v_sub from quest_submissions where id = v_sub.id;
  end if;

  return v_sub;
end $$;

-- ---------- manager batch review ----------
-- The 1-tap approval queue: approve or reject any number of pending
-- submissions in one PIN-authorized call. Returns how many were processed.

create or replace function review_submissions(
  p_game_id uuid,
  p_submission_ids uuid[],
  p_approve boolean,
  p_note text default null,
  p_pin text default null
) returns int
language plpgsql security definer set search_path = public as $$
declare v_game games; v_sub quest_submissions; v_count int := 0;
begin
  select * into v_game from games where id = p_game_id;
  if not found then raise exception 'no such game'; end if;
  perform _require_manager(v_game, p_pin);
  perform ensure_profile('Manager', '🎩');

  for v_sub in
    select * from quest_submissions
    where game_id = p_game_id and id = any(p_submission_ids) and status = 'pending'
    order by submitted_at
  loop
    if p_approve then
      perform _apply_quest_approval(v_sub.id, auth.uid(), p_note);
    else
      update quest_submissions
      set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(), review_note = p_note
      where id = v_sub.id;
      update game_players set awaiting_approval = false where id = v_sub.player_id;
    end if;
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;

-- Override now lives in the quest world: moving a player resets their quest
-- progress and supersedes any pending submission, so nothing dangles.
create or replace function manager_override(
  p_game_id uuid,
  p_player_id uuid,
  p_delta int,
  p_reason text,
  p_pin text default null
) returns game_players
language plpgsql security definer set search_path = public as $$
declare v_player game_players; v_game games;
begin
  select * into v_game from games where id = p_game_id;
  if not found then raise exception 'no such game'; end if;
  perform _require_manager(v_game, p_pin);
  perform ensure_profile('Manager', '🎩');

  select * into v_player from game_players where id = p_player_id and game_id = p_game_id for update;
  if not found then raise exception 'no such player'; end if;

  update quest_submissions
  set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(),
      review_note = 'Superseded by manager override'
  where player_id = p_player_id and status = 'pending';

  update game_players
  set position = greatest(0, least(v_player.position + p_delta, v_game.board_length - 1)),
      progress = 0,
      awaiting_approval = false
  where id = p_player_id
  returning * into v_player;

  insert into overrides (game_id, player_id, delta, reason, created_by)
  values (p_game_id, p_player_id, p_delta, coalesce(nullif(trim(p_reason), ''), 'Manager override'), auth.uid());
  return v_player;
end $$;

-- ---------- grants ----------

revoke execute on all functions in schema public from public, anon;
grant execute on function
  ensure_profile(text, text),
  join_game(uuid, text, text),
  manager_override(uuid, uuid, int, text, text),
  is_manager(),
  create_campaign(text, int, text, boolean, text, jsonb),
  update_progress(uuid, int),
  submit_quest(uuid, int, text, text),
  review_submissions(uuid, uuid[], boolean, text, text)
to authenticated;
