-- Behavioral test of the Baropoly quest-engine RPCs (v0.3) against a scratch
-- database. Applies after migrations 0001-0003.
--
-- Test board: 20 tiles. p0 standard (move 1) · p1 hard (move 2) ·
-- p3 setback landing (-1) · p19 finish/boss. Units: goal targets are
-- informational; movement comes from approvals.
\set ON_ERROR_STOP on

create function assert(cond boolean, msg text) returns text
language plpgsql as $fn$ begin
  if cond is not true then raise exception '%', msg; end if;
  return 'ok';
end $fn$;

create function test_tiles() returns jsonb
language sql as $fn$
  select jsonb_agg(
    jsonb_build_object(
      'position', i,
      'kind', case when i = 19 then 'boss' when i = 3 then 'setback' else 'goal' end,
      'name', 'Shift ' || (i + 1),
      'movementEffect', case when i = 3 then -1 else 0 end,
      'isCheckpoint', false,
      'moveValue', case when i = 1 then 2 else 1 end,
      'goal', jsonb_build_object('type', 'volume', 'label', 'Sell 2 cocktails', 'target', 2)
    ) order by i
  ) from generate_series(0, 19) i;
$fn$;

-- Campaign C board: checkpoint at 2, harsh setback at 4, card tile at 5.
create function floor_tiles() returns jsonb
language sql as $fn$
  select jsonb_agg(
    jsonb_build_object(
      'position', i,
      'kind', case
        when i = 19 then 'boss'
        when i = 2 then 'checkpoint'
        when i = 4 then 'setback'
        when i = 5 then 'event_card'
        else 'goal' end,
      'name', case when i = 2 then 'Stock Check' when i = 4 then 'Keg Blew' else 'Shift ' || (i + 1) end,
      'movementEffect', case when i = 4 then -10 else 0 end,
      'isCheckpoint', i = 2,
      'moveValue', 1,
      'goal', jsonb_build_object('type', 'volume', 'label', 'Sell 2 cocktails', 'target', 2)
    ) order by i
  ) from generate_series(0, 19) i;
$fn$;

insert into auth.users (id) values
  ('00000000-0000-0000-0000-00000000000a'),   -- manager
  ('00000000-0000-0000-0000-00000000000b');   -- bartender

-- === T1: manager creates campaign A (manual review), bartender joins ===
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select create_campaign('Marathon A', 20, 'balanced', false, '4242', test_tiles()) as game_a \gset
select assert((select count(*) from game_tiles where game_id = :'game_a') = 20, 'T1 FAIL: tiles');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
select id as player_a from join_game(:'game_a', 'Testy', '🦊') \gset
\echo T1 PASS: campaign created with 20 quest tiles, bartender joined

-- === T2: live progress counter updates ===
select progress from update_progress(:'player_a', 2) \gset t2
select assert(:'t2progress' = '2', 'T2 FAIL');
\echo T2 PASS: progress counter synced

-- === T3: submit quest -> pending, player locked, not moved ===
select status, tile_position from submit_quest(:'player_a', 2, 'till attached', 'a/b/photo.jpg') \gset t3
select assert(:'t3status' = 'pending' and :'t3tile_position' = '0', 'T3 FAIL: submission');
select assert(
  (select awaiting_approval and position = 0 from game_players where id = :'player_a'),
  'T3 FAIL: player state');
\echo T3 PASS: submission pending, player parked awaiting review

-- === T4: double-submit rejected while pending ===
do $$
declare v_failed boolean := false;
begin
  begin
    perform submit_quest((select id from game_players limit 1), 2);
  exception when others then v_failed := true;
  end;
  if not v_failed then raise exception 'T4 FAIL: duplicate submission accepted'; end if;
end $$;
\echo T4 PASS: duplicate submission rejected

-- === T5: wrong PIN cannot review ===
do $$
declare v_failed boolean := false;
begin
  begin
    perform review_submissions(
      (select id from games where name = 'Marathon A'),
      (select array_agg(id) from quest_submissions), true, null, '9999');
  exception when others then v_failed := true;
  end;
  if not v_failed then raise exception 'T5 FAIL: wrong PIN accepted'; end if;
end $$;
select assert(
  (select count(*) from quest_submissions where status = 'pending') = 1,
  'T5 FAIL: submission state changed');
\echo T5 PASS: wrong PIN rejected

-- === T6: batch approve with PIN -> standard move to tile 1 ===
select review_submissions(
  :'game_a',
  (select array_agg(id) from quest_submissions where status = 'pending'),
  true, 'Looks right', '4242') as t6count \gset
select assert(:'t6count' = '1', 'T6 FAIL: count');
select assert(
  (select position = 1 and not awaiting_approval and progress = 0
   from game_players where id = :'player_a'),
  'T6 FAIL: player');
\echo T6 PASS: approval moved player 1 tile, progress reset

-- === T7: hard tile (move 2) + setback landing (-1) => net tile 2 ===
select id as sub7 from submit_quest(:'player_a', 3) \gset
select review_submissions(:'game_a', array[:'sub7']::uuid[], true, null, '4242');
select assert(
  (select position = 2 from game_players where id = :'player_a'),
  'T7 FAIL: expected move 2 then setback -1 -> tile 2');
\echo T7 PASS: move value 2 applied, landing setback applied once

-- === T8: rejection unlocks without moving ===
select id as sub8 from submit_quest(:'player_a', 1) \gset
select review_submissions(:'game_a', array[:'sub8']::uuid[], false, 'Till photo missing', '4242');
select assert(
  (select status = 'rejected' from quest_submissions where id = :'sub8'),
  'T8 FAIL: status');
select assert(
  (select position = 2 and not awaiting_approval from game_players where id = :'player_a'),
  'T8 FAIL: player moved or stayed locked');
\echo T8 PASS: rejection recorded, player unlocked in place

-- === T9: auto-trust campaign approves instantly (non-winning tiles) ===
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select create_campaign('Marathon B', 20, 'balanced', true, '4242', test_tiles()) as game_b \gset
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
select id as player_b from join_game(:'game_b', 'Testy', '🦊') \gset
select status as t9status from submit_quest(:'player_b', 2) \gset t9_
select assert(:'t9_t9status' = 'approved', 'T9 FAIL: not auto-approved');
select assert(
  (select position = 1 and not awaiting_approval from game_players where id = :'player_b'),
  'T9 FAIL: player did not move');
\echo T9 PASS: auto-trust approved and moved instantly

-- === T10a: manager override supersedes a pending submission (manual game) ===
select id as sub10 from submit_quest(:'player_a', 1) \gset
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select manager_override(:'game_a', :'player_a', 1, 'Verified in person', '4242');
select assert(
  (select status = 'rejected' and review_note = 'Superseded by manager override'
   from quest_submissions where id = :'sub10'),
  'T10a FAIL: pending submission not superseded');
select assert(
  (select position = 3 and not awaiting_approval from game_players where id = :'player_a'),
  'T10a FAIL: override move');
\echo T10a PASS: override superseded the pending submission

-- === T10b: the win always needs a manager, even in trust mode ===
select manager_override(:'game_b', :'player_b', 99, 'Jump to finish', '4242');
select assert(
  (select position = 19 and not awaiting_approval from game_players where id = :'player_b'),
  'T10b FAIL: override clamp');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
select status as t10status from submit_quest(:'player_b', 4) \gset t10_
select assert(:'t10_t10status' = 'pending', 'T10b FAIL: win auto-approved despite trust mode');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select review_submissions(
  :'game_b',
  (select array_agg(id) from quest_submissions where status = 'pending' and game_id = :'game_b'),
  true, 'Win verified', '4242');
select assert(
  (select finished from game_players where id = :'player_b'),
  'T10b FAIL: not finished');
select assert(
  (select status = 'finished' and winner_player_id = :'player_b'
   from games where id = :'game_b'),
  'T10b FAIL: game not finished with winner');
\echo T10b PASS: win held for manager, approved, winner recorded

\echo === ALL QUEST RPC TESTS PASSED ===

-- ============================================================
-- v0.4: manager tile control, checkpoint floor, event cards
-- ============================================================

-- === T11: campaign C, bartender joins ===
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select create_campaign('Marathon C', 20, 'chaos_shift', true, '4242', floor_tiles()) as game_c \gset
select assert(
  (select count(*) from game_tiles where game_id = :'game_c' and is_checkpoint) = 1,
  'T11 FAIL: checkpoint not stored');
select assert(
  (select movement_effect = -10 and kind = 'setback'
   from game_tiles where game_id = :'game_c' and position = 4),
  'T11 FAIL: custom setback not stored');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
select id as player_c from join_game(:'game_c', 'Testy', '🦊') \gset
\echo T11 PASS: manager-defined tiles stored (checkpoint + custom setback)

-- === T12: a -10 setback cannot push a player past the checkpoint ===
-- Walk 0 -> 1 -> 2 (checkpoint, floor rises) -> 3 -> 4 (setback -10)
select submit_quest(:'player_c', 2);
select submit_quest(:'player_c', 2);
select assert(
  (select position = 2 and checkpoint_floor = 2 from game_players where id = :'player_c'),
  'T12 FAIL: floor did not rise on reaching the checkpoint');
select submit_quest(:'player_c', 2);
select submit_quest(:'player_c', 2);
select assert(
  (select position = 2 from game_players where id = :'player_c'),
  'T12 FAIL: -10 setback broke through the checkpoint floor');
\echo T12 PASS: harsh setback clamped to the checkpoint floor

-- === T13: wrong PIN cannot edit a tile ===
do $$
declare v_failed boolean := false;
begin
  begin
    perform update_tile(
      (select id from games where name = 'Marathon C'), 4,
      '{"movementEffect": 0}'::jsonb, '9999');
  exception when others then v_failed := true;
  end;
  if not v_failed then raise exception 'T13 FAIL: wrong PIN edited a tile'; end if;
end $$;
select assert(
  (select movement_effect = -10 from game_tiles where game_id = :'game_c' and position = 4),
  'T13 FAIL: tile changed despite bad PIN');
\echo T13 PASS: tile editing is PIN-gated

-- === T14: manager edits a tile mid-campaign (patch semantics) ===
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select update_tile(:'game_c', 4,
  '{"name": "Fixed the Well", "movementEffect": 0, "ruleText": "Sorted it. Carry on."}'::jsonb,
  '4242');
select assert(
  (select tile_name = 'Fixed the Well' and movement_effect = 0
          and custom_rule_text = 'Sorted it. Carry on.' and kind = 'setback'
   from game_tiles where game_id = :'game_c' and position = 4),
  'T14 FAIL: patch did not apply (or clobbered untouched fields)');
\echo T14 PASS: tile patched in place, untouched fields preserved

-- === T15: event-card tile draws from the deck and applies its effect ===
select upsert_event_card(:'game_c', null, 'Late to Shift', 'Chef saw you. Back 1.', -1, 5, 1, '4242');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
select submit_quest(:'player_c', 2);   -- 2 -> 3
select submit_quest(:'player_c', 2);   -- 3 -> 4 (now neutral)
select assert(
  (select position = 4 from game_players where id = :'player_c'),
  'T15 FAIL: edited tile still knocking the player back');
select submit_quest(:'player_c', 2);   -- 4 -> 5 (card tile) -> card -1 -> 4
select assert(
  (select position = 4 from game_players where id = :'player_c'),
  'T15 FAIL: card movement not applied');
select assert(
  (select count(*) = 1 from card_draws
   where game_id = :'game_c' and card_name = 'Late to Shift' and tile_position = 5),
  'T15 FAIL: draw not recorded');
\echo T15 PASS: card drawn on landing, effect applied, draw recorded

-- === T16: quick-apply swaps the whole board ===
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select apply_board_template(:'game_c', test_tiles(), 'clean_fast', '4242') as t16count \gset
select assert(:'t16count' = '20', 'T16 FAIL: wrong tile count');
select assert(
  (select count(*) from game_tiles where game_id = :'game_c') = 20,
  'T16 FAIL: tiles not replaced cleanly');
select assert(
  (select tile_name = 'Shift 5' from game_tiles where game_id = :'game_c' and position = 4),
  'T16 FAIL: template not applied');
select assert(
  (select checkpoint_floor = 0 from game_players where id = :'player_c'),
  'T16 FAIL: floors not recomputed against the new board');
\echo T16 PASS: board template applied, player floors recomputed

-- === T17: a template with the wrong tile count is refused ===
do $$
declare v_failed boolean := false;
begin
  begin
    perform apply_board_template(
      (select id from games where name = 'Marathon C'),
      '[{"position":0,"kind":"goal","name":"Only one"}]'::jsonb, null, '4242');
  exception when others then v_failed := true;
  end;
  if not v_failed then raise exception 'T17 FAIL: short template accepted'; end if;
end $$;
select assert(
  (select count(*) from game_tiles where game_id = :'game_c') = 20,
  'T17 FAIL: board damaged by refused template');
\echo T17 PASS: mismatched template refused, board intact

-- === T18: the deck can be replaced wholesale ===
select replace_event_deck(:'game_c',
  '[{"name":"Bribe the Barback","ruleText":"Skip ahead 2.","movementEffect":2,"weight":1},
    {"name":"Dirty Well Penalty","ruleText":"Back 2.","movementEffect":-2,"weight":3}]'::jsonb,
  '4242') as t18count \gset
select assert(:'t18count' = '2', 'T18 FAIL: wrong card count');
select assert(
  (select count(*) from event_cards where game_id = :'game_c') = 2,
  'T18 FAIL: old cards not cleared');
\echo T18 PASS: event deck replaced

-- === T19: the prize is manager-owned and PIN-gated ===
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
do $$
declare v_failed boolean := false;
begin
  begin
    perform update_prize((select id from games where name = 'Marathon C'),
      'Hijacked', null, null, null, '9999');
  exception when others then v_failed := true;
  end;
  if not v_failed then raise exception 'T19 FAIL: wrong PIN set the prize'; end if;
end $$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select prize_title, campaign_days from update_prize(:'game_c',
  'Monthly Winner: £250 Cash + Weekend Off',
  'First past Last Call with a manager sign-off takes the cash and gets first pick of next month''s shifts.',
  '💷', 30, '4242') \gset t19
select assert(:'t19prize_title' = 'Monthly Winner: £250 Cash + Weekend Off', 'T19 FAIL: title');
select assert(:'t19campaign_days' = '30', 'T19 FAIL: campaign days');
-- a null description must not wipe what is already there
select update_prize(:'game_c', 'Same prize, new name', null, null, null, '4242');
select assert(
  (select prize_description is not null from games where id = :'game_c'),
  'T19 FAIL: null description clobbered the stored one');
\echo T19 PASS: prize stored, PIN-gated, patch-safe

\echo === ALL BOARD-CONTROL TESTS PASSED ===
