-- Baropoly v0.2 — server-authoritative game engine + manager PIN security.
--
-- Clients stay optimistic (lib/board.ts mirrors this logic for instant UI),
-- but the database is the referee: every tally, undo, override, and approval
-- goes through these RPCs, and Realtime broadcasts the resulting row changes
-- to all connected devices. PIN checks happen here, server-side, atomically
-- with the state change they authorize.

create extension if not exists pgcrypto;

-- ---------- profiles ----------
-- Anonymous auth means a user may have no profile row yet; every entry point
-- upserts one.

create or replace function ensure_profile(p_display_name text, p_token_emoji text)
returns profiles
language plpgsql security definer set search_path = public as $$
declare v_profile profiles;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  insert into profiles (id, display_name, token_emoji)
  values (auth.uid(), coalesce(nullif(trim(p_display_name), ''), 'Staff'), coalesce(p_token_emoji, '🍸'))
  on conflict (id) do update
    set display_name = excluded.display_name,
        token_emoji = excluded.token_emoji
  returning * into v_profile;
  return v_profile;
end $$;

-- ---------- board engine ----------
-- Port of lib/board.ts applyUnits: walk forward tile by tile, apply landing
-- effects (never chaining), park on approval tiles. A locked player
-- (awaiting approval / finished) absorbs no units.

create or replace function _advance(
  p_game_id uuid,
  p_actions_per_tile int,
  p_board_length int,
  p_position int,
  p_progress int,
  p_awaiting boolean,
  p_finished boolean,
  p_units int,
  out o_position int,
  out o_progress int,
  out o_awaiting boolean
)
language plpgsql stable set search_path = public as $$
declare v_move int; v_requires boolean;
begin
  o_position := p_position;
  o_progress := p_progress;
  o_awaiting := p_awaiting;
  if p_awaiting or p_finished then
    return;
  end if;

  o_progress := o_progress + p_units;
  while o_progress >= p_actions_per_tile and not o_awaiting loop
    o_progress := o_progress - p_actions_per_tile;
    o_position := least(o_position + 1, p_board_length - 1);

    select move_delta, requires_approval into v_move, v_requires
    from game_tiles where game_id = p_game_id and position = o_position;

    if coalesce(v_move, 0) <> 0 then
      o_position := greatest(0, least(o_position + v_move, p_board_length - 1));
      select requires_approval into v_requires
      from game_tiles where game_id = p_game_id and position = o_position;
    end if;

    if coalesce(v_requires, false) then
      o_awaiting := true;
    end if;
  end loop;
end $$;

-- ---------- game lifecycle ----------

-- Anyone signed in can open a shift; whoever knows the PIN (or created the
-- game) is its manager. Tiles are generated client-side (deterministic) and
-- persisted here for auditability.
create or replace function create_game(
  p_name text,
  p_board_length int,
  p_actions_per_tile int,
  p_seed int,
  p_pin text,
  p_tiles jsonb
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_game_id uuid; t jsonb;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  insert into profiles (id, display_name)
  values (auth.uid(), 'Manager')
  on conflict (id) do nothing;

  insert into games (name, status, board_length, actions_per_tile, board_seed, manager_pin_hash, created_by, started_at)
  values (
    p_name, 'active', p_board_length, p_actions_per_tile, p_seed,
    case when nullif(p_pin, '') is null then null else crypt(p_pin, gen_salt('bf')) end,
    auth.uid(), now()
  )
  returning id into v_game_id;

  for t in select * from jsonb_array_elements(p_tiles) loop
    insert into game_tiles (game_id, position, tile_type, title, description, move_delta, requires_approval)
    values (
      v_game_id,
      (t ->> 'position')::int,
      (t ->> 'type')::tile_type,
      t ->> 'title',
      t ->> 'description',
      coalesce((t ->> 'move')::int, 0),
      coalesce((t ->> 'requiresApproval')::boolean, false)
    );
  end loop;

  return v_game_id;
end $$;

create or replace function join_game(p_game_id uuid, p_display_name text, p_token_emoji text)
returns game_players
language plpgsql security definer set search_path = public as $$
declare v_player game_players;
begin
  perform ensure_profile(p_display_name, p_token_emoji);

  insert into game_players (game_id, profile_id, display_name, token_emoji)
  values (p_game_id, auth.uid(), coalesce(nullif(trim(p_display_name), ''), 'Staff'), coalesce(p_token_emoji, '🍸'))
  on conflict (game_id, profile_id) do update
    set display_name = excluded.display_name,
        token_emoji = excluded.token_emoji
  returning * into v_player;
  return v_player;
end $$;

-- ---------- tally + undo ----------

create or replace function log_action(
  p_player_id uuid,
  p_action_type action_type,
  p_units int,
  p_receipt_path text default null
) returns game_players
language plpgsql security definer set search_path = public as $$
declare v_player game_players; v_game games; v_adv record;
begin
  select * into v_player from game_players where id = p_player_id for update;
  if not found or v_player.profile_id <> auth.uid() then
    raise exception 'not your player';
  end if;
  select * into v_game from games where id = v_player.game_id;
  if v_game.status <> 'active' then
    raise exception 'game is not active';
  end if;
  if v_player.awaiting_approval or v_player.finished then
    raise exception 'player is locked pending manager approval';
  end if;
  if p_units not between 1 and 10 then
    raise exception 'invalid units';
  end if;

  insert into action_logs (game_id, player_id, action_type, units, receipt_path)
  values (v_game.id, v_player.id, p_action_type, p_units, p_receipt_path);

  select * into v_adv from _advance(
    v_game.id, v_game.actions_per_tile, v_game.board_length,
    v_player.position, v_player.progress, v_player.awaiting_approval, v_player.finished, p_units
  );

  update game_players
  set position = v_adv.o_position, progress = v_adv.o_progress, awaiting_approval = v_adv.o_awaiting
  where id = v_player.id
  returning * into v_player;
  return v_player;
end $$;

-- Voids the newest un-voided tally and recomputes the player by replaying
-- their remaining logs from the start. MVP limitation (same as the client
-- engine): manager override deltas are not replayed — an undo after an
-- override reverts the override's effect too. Managers can re-apply.
create or replace function void_last_action(p_player_id uuid)
returns game_players
language plpgsql security definer set search_path = public as $$
declare v_player game_players; v_game games; v_log action_logs; l record; v_adv record;
  v_position int := 0; v_progress int := 0; v_awaiting boolean := false;
begin
  select * into v_player from game_players where id = p_player_id for update;
  if not found or v_player.profile_id <> auth.uid() then
    raise exception 'not your player';
  end if;
  select * into v_game from games where id = v_player.game_id;
  if v_game.status <> 'active' then
    raise exception 'game is not active';
  end if;

  update action_logs set voided = true, voided_by = auth.uid()
  where id = (
    select id from action_logs
    where player_id = p_player_id and not voided
    order by created_at desc, id desc limit 1
  )
  returning * into v_log;
  if not found then
    return v_player;
  end if;

  for l in
    select units from action_logs
    where player_id = p_player_id and not voided
    order by created_at asc, id asc
  loop
    select * into v_adv from _advance(
      v_game.id, v_game.actions_per_tile, v_game.board_length,
      v_position, v_progress, v_awaiting, false, l.units
    );
    v_position := v_adv.o_position;
    v_progress := v_adv.o_progress;
    v_awaiting := v_adv.o_awaiting;
  end loop;

  update game_players
  set position = v_position, progress = v_progress, awaiting_approval = v_awaiting, finished = false
  where id = v_player.id
  returning * into v_player;
  return v_player;
end $$;

-- ---------- manager security ----------
-- Authorized if: correct PIN for this game, OR the game's creator, OR a
-- profile with the 'manager' role. The PIN is bcrypt-checked in-database so
-- it never gates anything client-side.

create or replace function _require_manager(p_game games, p_pin text)
returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if p_game.manager_pin_hash is not null
     and nullif(p_pin, '') is not null
     and crypt(p_pin, p_game.manager_pin_hash) = p_game.manager_pin_hash then
    return;
  end if;
  if p_game.created_by = auth.uid() then
    return;
  end if;
  if is_manager() then
    return;
  end if;
  raise exception 'manager authorization failed';
end $$;

create or replace function manager_override(
  p_game_id uuid,
  p_player_id uuid,
  p_delta int,
  p_reason text,
  p_pin text default null
) returns game_players
language plpgsql security definer set search_path = public as $$
declare v_player game_players; v_game games; v_requires boolean;
begin
  select * into v_game from games where id = p_game_id;
  if not found then raise exception 'no such game'; end if;
  perform _require_manager(v_game, p_pin);
  perform ensure_profile('Manager', '🎩');

  select * into v_player from game_players where id = p_player_id and game_id = p_game_id for update;
  if not found then raise exception 'no such player'; end if;

  update game_players
  set position = greatest(0, least(v_player.position + p_delta, v_game.board_length - 1)),
      awaiting_approval = coalesce((
        select requires_approval from game_tiles
        where game_id = p_game_id
          and position = greatest(0, least(v_player.position + p_delta, v_game.board_length - 1))
      ), false)
  where id = p_player_id
  returning * into v_player;

  insert into overrides (game_id, player_id, delta, reason, created_by)
  values (p_game_id, p_player_id, p_delta, coalesce(nullif(trim(p_reason), ''), 'Manager override'), auth.uid());
  return v_player;
end $$;

create or replace function manager_approve(
  p_game_id uuid,
  p_player_id uuid,
  p_pin text default null
) returns game_players
language plpgsql security definer set search_path = public as $$
declare v_player game_players; v_game games; v_is_finish boolean;
begin
  select * into v_game from games where id = p_game_id;
  if not found then raise exception 'no such game'; end if;
  perform _require_manager(v_game, p_pin);
  perform ensure_profile('Manager', '🎩');

  select * into v_player from game_players where id = p_player_id and game_id = p_game_id for update;
  if not found then raise exception 'no such player'; end if;
  if not v_player.awaiting_approval then
    raise exception 'player is not awaiting approval';
  end if;

  select tile_type = 'finish' into v_is_finish
  from game_tiles where game_id = p_game_id and position = v_player.position;

  update game_players
  set awaiting_approval = false, finished = coalesce(v_is_finish, false)
  where id = p_player_id
  returning * into v_player;

  if coalesce(v_is_finish, false) then
    update games
    set status = 'finished', winner_player_id = v_player.id, ended_at = now()
    where id = p_game_id;
  end if;

  insert into overrides (game_id, player_id, delta, reason, created_by)
  values (
    p_game_id, p_player_id, 0,
    case when coalesce(v_is_finish, false) then 'Win approved' else 'Checkpoint approved' end,
    auth.uid()
  );
  return v_player;
end $$;

-- ---------- grants ----------
-- RPCs are the only write path clients need; lock them to signed-in users.

revoke execute on all functions in schema public from public, anon;
grant execute on function
  ensure_profile(text, text),
  create_game(text, int, int, int, text, jsonb),
  join_game(uuid, text, text),
  log_action(uuid, action_type, int, text),
  void_last_action(uuid),
  manager_override(uuid, uuid, int, text, text),
  manager_approve(uuid, uuid, text),
  is_manager()
to authenticated;
