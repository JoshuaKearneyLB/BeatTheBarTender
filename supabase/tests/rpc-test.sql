-- Behavioral test of the Baropoly RPC engine against the scratch database.
-- Board: 20 tiles, 2 units per tile (5..18 plain progress):
--   0 start · 1 progress · 2 bonus(+1) · 3 progress · 4 checkpoint · 5 finish
\set ON_ERROR_STOP on

create function assert(cond boolean, msg text) returns text
language plpgsql as $fn$ begin
  if cond is not true then raise exception '%', msg; end if;
  return 'ok';
end $fn$;

insert into auth.users (id) values
  ('00000000-0000-0000-0000-00000000000a'),   -- manager
  ('00000000-0000-0000-0000-00000000000b');   -- bartender

-- === manager creates the game ===
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);

select create_game(
  'Test Shift', 20, 2, 7, '4242',
  '[{"position":0,"type":"start","title":"Clock In"},
    {"position":1,"type":"progress","title":"Bar"},
    {"position":2,"type":"bonus","title":"Happy Hour","move":1},
    {"position":3,"type":"progress","title":"Bar"},
    {"position":4,"type":"checkpoint","title":"Stock Check","requiresApproval":true},
    {"position":5,"type":"progress","title":"Bar"},
    {"position":6,"type":"progress","title":"Bar"},
    {"position":7,"type":"progress","title":"Bar"},
    {"position":8,"type":"progress","title":"Bar"},
    {"position":9,"type":"progress","title":"Bar"},
    {"position":10,"type":"progress","title":"Bar"},
    {"position":11,"type":"progress","title":"Bar"},
    {"position":12,"type":"progress","title":"Bar"},
    {"position":13,"type":"progress","title":"Bar"},
    {"position":14,"type":"progress","title":"Bar"},
    {"position":15,"type":"progress","title":"Bar"},
    {"position":16,"type":"progress","title":"Bar"},
    {"position":17,"type":"progress","title":"Bar"},
    {"position":18,"type":"progress","title":"Bar"},
    {"position":19,"type":"finish","title":"Last Call","requiresApproval":true}]'::jsonb
) as game_id \gset g

-- === bartender joins ===
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
select id as player_id from join_game(:'ggame_id', 'Testy', '🦊') \gset p

do $$ begin
  if (select count(*) from game_players) <> 1 then raise exception 'join failed'; end if;
end $$;

-- === tally 1: +1 unit → progress 1, still on start ===
select position, progress from log_action(:'pplayer_id', 'cocktail', 1) \gset t1
select assert(:'t1position' = '0' and :'t1progress' = '1', 'T1 FAIL');
\echo T1 PASS: 1 unit -> tile 0, progress 1

-- === tally 2: +1 unit → advance to tile 1 ===
select position, progress from log_action(:'pplayer_id', 'cocktail', 1) \gset t2
select assert(:'t2position' = '1' and :'t2progress' = '0', 'T2 FAIL');
\echo T2 PASS: 2 units -> tile 1

-- === tally 3: +2 units (upsell) → land on bonus tile 2, hop to tile 3 ===
select position, progress, awaiting_approval from log_action(:'pplayer_id', 'upsell', 2) \gset t3
select assert(:'t3position' = '3' and :'t3awaiting_approval' = 'f', 'T3 FAIL');
\echo T3 PASS: bonus tile hopped 2 -> 3, no chain

-- === tally 4: +2 units → tile 4 checkpoint, parked awaiting approval ===
select position, awaiting_approval from log_action(:'pplayer_id', 'upsell', 2) \gset t4
select assert(:'t4position' = '4' and :'t4awaiting_approval' = 't', 'T4 FAIL');
\echo T4 PASS: parked on checkpoint

-- === tally while locked must be rejected ===
do $$ begin
  begin
    perform log_action((select id from game_players limit 1), 'cocktail', 1);
  exception when others then null;
  end;
end $$;
select case when exists (
  select 1 from game_players where id = :'pplayer_id' and awaiting_approval
) then 'T5 PASS: still locked' else 'T5 FAIL' end as t5;
do $$ begin
  if not (select awaiting_approval from game_players limit 1) then raise exception 'T5 FAIL'; end if;
end $$;

-- === wrong PIN rejected (bartender has no standing) ===
do $$
declare v_failed boolean := false;
begin
  begin
    perform manager_approve((select id from games limit 1), (select id from game_players limit 1), '9999');
  exception when others then v_failed := true;
  end;
  if not v_failed then raise exception 'T6 FAIL: wrong PIN accepted'; end if;
end $$;
\echo T6 PASS: wrong PIN rejected

-- === correct PIN approves the checkpoint ===
select awaiting_approval from manager_approve(:'ggame_id', :'pplayer_id', '4242') \gset t7
select assert(:'t7awaiting_approval' = 'f', 'T7 FAIL');
\echo T7 PASS: PIN-authorized checkpoint approval

-- === undo: void last tally, replay -> back before the checkpoint ===
select position, progress, awaiting_approval from void_last_action(:'pplayer_id') \gset t8
-- remaining logs: 1+1+2 units = tile 3 via bonus hop, progress 0, unlocked
select assert(:'t8position' = '3' and :'t8progress' = '0' and :'t8awaiting_approval' = 'f', 'T8 FAIL');
do $$ begin
  if (select count(*) from action_logs where voided) <> 1 then raise exception 'T8 FAIL: void count'; end if;
end $$;
\echo T8 PASS: undo voided + replayed correctly

-- === manager override with PIN: Failed Audit -2 ===
select position from manager_override(:'ggame_id', :'pplayer_id', -2, 'Failed Audit', '4242') \gset t9
select assert(:'t9position' = '1', 'T9 FAIL');
select assert((select count(*) from overrides) >= 2, 'T9 FAIL: override not recorded');
\echo T9 PASS: override applied and recorded

-- === drive to the finish and approve the win ===
select manager_override(:'ggame_id', :'pplayer_id', 99, 'Jump to finish (clamped)', '4242'); -- clamp -> tile 19 finish (parked)
select finished from manager_approve(:'ggame_id', :'pplayer_id', '4242') \gset t10
select assert(:'t10finished' = 't', 'T10 FAIL: not finished');
select assert((select status from games limit 1) = 'finished', 'T10 FAIL: game status');
select assert((select winner_player_id from games limit 1) is not null, 'T10 FAIL: no winner');
\echo T10 PASS: win approved, game finished, winner recorded

\echo === ALL RPC TESTS PASSED ===
