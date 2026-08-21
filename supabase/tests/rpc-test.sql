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
      'type', case when i = 0 then 'start' when i = 19 then 'finish' else 'progress' end,
      'title', 'Day ' || (i + 1),
      'move', case when i = 3 then -1 else null end,
      'moveValue', case when i = 1 then 2 else 1 end,
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
