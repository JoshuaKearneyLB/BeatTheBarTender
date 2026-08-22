-- Baropoly v0.4 — total manager control over the board.
--
-- Every tile becomes a manager-editable object: its own kind, name, rule
-- text, movement effect, optional target drink, and an is_checkpoint flag
-- that acts as a floor no automatic setback can push a player below.
-- Event-card tiles draw from a manager-written deck on landing.

create type tile_kind as enum ('standard', 'goal', 'setback', 'event_card', 'checkpoint', 'boss');

-- ---------- game_tiles: rename to the manager's vocabulary, add controls ----------

alter table game_tiles rename column title to tile_name;
alter table game_tiles rename column description to custom_rule_text;
alter table game_tiles rename column move_delta to movement_effect;

alter table game_tiles
  add column kind tile_kind not null default 'goal',
  add column is_checkpoint boolean not null default false,
  add column target_drink_id text;

-- Movement effects are bounded so a typo can't fling someone off the board.
alter table game_tiles
  add constraint game_tiles_movement_effect_check
  check (movement_effect between -10 and 10);

-- Backfill kind from the old generated type, then retire it.
update game_tiles set kind = case tile_type
  when 'start' then 'standard'::tile_kind
  when 'progress' then 'goal'::tile_kind
  when 'challenge' then 'boss'::tile_kind
  when 'setback' then 'setback'::tile_kind
  when 'bonus' then 'standard'::tile_kind
  when 'checkpoint' then 'checkpoint'::tile_kind
  when 'finish' then 'boss'::tile_kind
end;
update game_tiles set is_checkpoint = true where tile_type = 'checkpoint';

alter table game_tiles drop column tile_type;
alter table game_tiles drop column requires_approval;
drop type tile_type;

-- ---------- checkpoint floor ----------
-- The furthest checkpoint a player has reached. Automatic setbacks (tile
-- effects and event cards) can never push them below it.

alter table game_players add column checkpoint_floor int not null default 0;

-- ---------- event cards ----------
-- Manager-written deck. tile_position null = general deck, drawn from any
-- event-card tile; set = only drawn on that tile.

create table event_cards (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games (id) on delete cascade,
  tile_position int,
  card_name text not null,
  rule_text text,
  movement_effect int not null default 0 check (movement_effect between -10 and 10),
  weight int not null default 1 check (weight between 1 and 10),
  created_at timestamptz not null default now()
);

create index event_cards_game_idx on event_cards (game_id, tile_position);

-- Every draw is recorded, so the board's history is auditable.
create table card_draws (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games (id) on delete cascade,
  player_id uuid not null references game_players (id) on delete cascade,
  card_id uuid references event_cards (id) on delete set null,
  card_name text not null,
  rule_text text,
  movement_effect int not null,
  tile_position int not null,
  drawn_at timestamptz not null default now()
);

create index card_draws_game_idx on card_draws (game_id, drawn_at desc);

alter table event_cards enable row level security;
alter table card_draws enable row level security;
create policy "read cards" on event_cards for select to authenticated using (true);
create policy "read draws" on card_draws for select to authenticated using (true);
-- All writes go through the security-definer RPCs below.

alter publication supabase_realtime add table game_tiles, event_cards, card_draws;

-- ---------- checkpoint helper ----------

create or replace function _checkpoint_floor(p_game_id uuid, p_position int)
returns int
language sql stable security definer set search_path = public as $$
  select coalesce(max(position), 0)
  from game_tiles
  where game_id = p_game_id and is_checkpoint and position <= p_position;
$$;

-- ---------- shared tile writer ----------

create or replace function _insert_tiles(p_game_id uuid, p_tiles jsonb)
returns void
language plpgsql security definer set search_path = public as $$
declare t jsonb;
begin
  for t in select * from jsonb_array_elements(p_tiles) loop
    insert into game_tiles (
      game_id, position, kind, tile_name, custom_rule_text, movement_effect,
      is_checkpoint, target_drink_id, goal_type, goal_target, goal_label, move_value
    )
    values (
      p_game_id,
      (t ->> 'position')::int,
      coalesce((t ->> 'kind')::tile_kind, 'goal'),
      coalesce(t ->> 'name', 'Shift'),
      nullif(t ->> 'ruleText', ''),
      coalesce((t ->> 'movementEffect')::int, 0),
      coalesce((t ->> 'isCheckpoint')::boolean, false),
      nullif(t ->> 'targetDrinkId', ''),
      coalesce((t -> 'goal' ->> 'type')::goal_type, 'volume'),
      coalesce((t -> 'goal' ->> 'target')::int, 1),
      coalesce(t -> 'goal' ->> 'label', 'Hit the shift goal'),
      coalesce((t ->> 'moveValue')::int, 1)
    );
  end loop;
end $$;

-- ---------- campaign creation (new tile shape) ----------

create or replace function create_campaign(
  p_name text,
  p_board_length int,
  p_preset text,
  p_auto_approve boolean,
  p_pin text,
  p_tiles jsonb
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_game_id uuid;
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

  perform _insert_tiles(v_game_id, p_tiles);
  return v_game_id;
end $$;

-- ---------- movement: manager effects, cards, and the checkpoint floor ----------

create or replace function _apply_quest_approval(
  p_submission_id uuid,
  p_reviewer uuid,
  p_note text
) returns game_players
language plpgsql security definer set search_path = public as $$
declare
  v_sub quest_submissions; v_player game_players; v_game games; v_card event_cards;
  v_move int; v_effect int := 0; v_kind tile_kind; v_new_pos int; v_floor int;
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

  -- Last tile: clearing its goal takes the campaign.
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

  -- Checkpoints cleared on the way forward raise the floor before any drop.
  v_floor := greatest(v_player.checkpoint_floor, _checkpoint_floor(v_game.id, v_new_pos));

  select kind, coalesce(movement_effect, 0) into v_kind, v_effect
  from game_tiles where game_id = v_game.id and position = v_new_pos;

  -- Event-card tiles draw the manager's deck instead of a fixed effect.
  if v_kind = 'event_card' then
    select * into v_card from event_cards
    where game_id = v_game.id and (tile_position is null or tile_position = v_new_pos)
    order by power(random(), 1.0 / weight) desc
    limit 1;
    if found then
      v_effect := v_card.movement_effect;
      insert into card_draws (game_id, player_id, card_id, card_name, rule_text, movement_effect, tile_position)
      values (v_game.id, v_player.id, v_card.id, v_card.card_name, v_card.rule_text,
              v_card.movement_effect, v_new_pos);
    else
      v_effect := 0;
    end if;
  end if;

  -- The landing effect fires once, never chains, and never breaks the floor.
  if v_effect <> 0 then
    v_new_pos := greatest(v_floor, least(v_new_pos + v_effect, v_game.board_length - 1));
  end if;
  v_floor := greatest(v_floor, _checkpoint_floor(v_game.id, v_new_pos));

  update game_players
  set position = v_new_pos, progress = 0, awaiting_approval = false, checkpoint_floor = v_floor
  where id = v_player.id
  returning * into v_player;
  return v_player;
end $$;

-- ---------- manager board editing ----------
-- Tiles are editable mid-campaign. Only the keys present in the patch
-- change, so the editor can send one field at a time.

create or replace function update_tile(
  p_game_id uuid,
  p_position int,
  p_patch jsonb,
  p_pin text default null
) returns game_tiles
language plpgsql security definer set search_path = public as $$
declare v_game games; v_tile game_tiles;
begin
  select * into v_game from games where id = p_game_id;
  if not found then raise exception 'no such game'; end if;
  perform _require_manager(v_game, p_pin);

  update game_tiles set
    kind = coalesce((p_patch ->> 'kind')::tile_kind, kind),
    tile_name = coalesce(nullif(p_patch ->> 'name', ''), tile_name),
    custom_rule_text = case when p_patch ? 'ruleText'
      then nullif(p_patch ->> 'ruleText', '') else custom_rule_text end,
    movement_effect = coalesce((p_patch ->> 'movementEffect')::int, movement_effect),
    is_checkpoint = coalesce((p_patch ->> 'isCheckpoint')::boolean, is_checkpoint),
    target_drink_id = case when p_patch ? 'targetDrinkId'
      then nullif(p_patch ->> 'targetDrinkId', '') else target_drink_id end,
    goal_type = coalesce((p_patch -> 'goal' ->> 'type')::goal_type, goal_type),
    goal_label = coalesce(nullif(p_patch -> 'goal' ->> 'label', ''), goal_label),
    goal_target = coalesce((p_patch -> 'goal' ->> 'target')::int, goal_target),
    move_value = coalesce((p_patch ->> 'moveValue')::int, move_value)
  where game_id = p_game_id and position = p_position
  returning * into v_tile;

  if not found then raise exception 'no such tile'; end if;
  return v_tile;
end $$;

-- Quick-apply: swap the whole board for a template. Players keep their
-- places; their checkpoint floors are recomputed against the new board.
create or replace function apply_board_template(
  p_game_id uuid,
  p_tiles jsonb,
  p_preset text default null,
  p_pin text default null
) returns int
language plpgsql security definer set search_path = public as $$
declare v_game games; v_player game_players;
begin
  select * into v_game from games where id = p_game_id;
  if not found then raise exception 'no such game'; end if;
  perform _require_manager(v_game, p_pin);
  if jsonb_array_length(p_tiles) <> v_game.board_length then
    raise exception 'template has % tiles, board is %', jsonb_array_length(p_tiles), v_game.board_length;
  end if;

  delete from game_tiles where game_id = p_game_id;
  perform _insert_tiles(p_game_id, p_tiles);
  update games set campaign_preset = coalesce(p_preset, campaign_preset) where id = p_game_id;

  for v_player in select * from game_players where game_id = p_game_id loop
    update game_players
    set checkpoint_floor = _checkpoint_floor(p_game_id, v_player.position)
    where id = v_player.id;
  end loop;

  return jsonb_array_length(p_tiles);
end $$;

-- ---------- event card deck ----------

create or replace function upsert_event_card(
  p_game_id uuid,
  p_card_id uuid,
  p_card_name text,
  p_rule_text text,
  p_movement_effect int,
  p_tile_position int default null,
  p_weight int default 1,
  p_pin text default null
) returns event_cards
language plpgsql security definer set search_path = public as $$
declare v_game games; v_card event_cards;
begin
  select * into v_game from games where id = p_game_id;
  if not found then raise exception 'no such game'; end if;
  perform _require_manager(v_game, p_pin);
  if nullif(trim(coalesce(p_card_name, '')), '') is null then
    raise exception 'card needs a name';
  end if;

  if p_card_id is null then
    insert into event_cards (game_id, tile_position, card_name, rule_text, movement_effect, weight)
    values (p_game_id, p_tile_position, trim(p_card_name), nullif(trim(coalesce(p_rule_text, '')), ''),
            coalesce(p_movement_effect, 0), coalesce(p_weight, 1))
    returning * into v_card;
  else
    update event_cards
    set tile_position = p_tile_position,
        card_name = trim(p_card_name),
        rule_text = nullif(trim(coalesce(p_rule_text, '')), ''),
        movement_effect = coalesce(p_movement_effect, 0),
        weight = coalesce(p_weight, 1)
    where id = p_card_id and game_id = p_game_id
    returning * into v_card;
    if not found then raise exception 'no such card'; end if;
  end if;

  return v_card;
end $$;

create or replace function delete_event_card(
  p_game_id uuid,
  p_card_id uuid,
  p_pin text default null
) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_game games;
begin
  select * into v_game from games where id = p_game_id;
  if not found then raise exception 'no such game'; end if;
  perform _require_manager(v_game, p_pin);
  delete from event_cards where id = p_card_id and game_id = p_game_id;
  return found;
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
  review_submissions(uuid, uuid[], boolean, text, text),
  update_tile(uuid, int, jsonb, text),
  apply_board_template(uuid, jsonb, text, text),
  upsert_event_card(uuid, uuid, text, text, int, int, int, text),
  delete_event_card(uuid, uuid, text)
to authenticated;

-- Replace the whole deck in one call (used when quick-applying a template
-- that ships its own cards).
create or replace function replace_event_deck(
  p_game_id uuid,
  p_cards jsonb,
  p_pin text default null
) returns int
language plpgsql security definer set search_path = public as $$
declare v_game games; c jsonb; v_count int := 0;
begin
  select * into v_game from games where id = p_game_id;
  if not found then raise exception 'no such game'; end if;
  perform _require_manager(v_game, p_pin);

  delete from event_cards where game_id = p_game_id;
  for c in select * from jsonb_array_elements(p_cards) loop
    insert into event_cards (game_id, tile_position, card_name, rule_text, movement_effect, weight)
    values (
      p_game_id,
      nullif(c ->> 'tilePosition', '')::int,
      coalesce(c ->> 'name', 'Card'),
      nullif(c ->> 'ruleText', ''),
      coalesce((c ->> 'movementEffect')::int, 0),
      coalesce((c ->> 'weight')::int, 1)
    );
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;

grant execute on function replace_event_deck(uuid, jsonb, text) to authenticated;
