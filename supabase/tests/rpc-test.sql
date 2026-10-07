-- Behavioral test of the Drink Race RPCs against a scratch database.
-- Race A: target 3, PIN 4242. Manager = a, bartenders = b and c.
\set ON_ERROR_STOP on

create function assert(cond boolean, msg text) returns text
language plpgsql as $fn$ begin
  if cond is not true then raise exception '%', msg; end if;
  return 'ok';
end $fn$;

create function expect_error(sql text, msg text) returns text
language plpgsql as $fn$ begin
  begin
    execute sql;
  exception when others then return 'ok';
  end;
  raise exception '%', msg;
end $fn$;

create function as_user(uid text) returns void
language sql as $fn$ select set_config('request.jwt.claim.sub', uid, false) $fn$;

insert into auth.users (id) values
  ('00000000-0000-0000-0000-00000000000a'),
  ('00000000-0000-0000-0000-00000000000b'),
  ('00000000-0000-0000-0000-00000000000c');

-- === T1: manager opens a race, two bartenders join ===
select as_user('00000000-0000-0000-0000-00000000000a');
select create_race('Friday Race', 'Hacien Pineapple Spritz', 3, '£50 bar tab', null, 'cash', '4242') as race \gset
select assert((select status = 'active' and target = 3 from races where id = :'race'), 'T1 FAIL: race');

select as_user('00000000-0000-0000-0000-00000000000b');
select id as ben from join_race(:'race', 'Ben', 'pint') \gset
select as_user('00000000-0000-0000-0000-00000000000c');
select id as cat from join_race(:'race', 'Cat', 'lime') \gset
select assert((select count(*) = 2 from racers where race_id = :'race'), 'T1 FAIL: racers');
\echo T1 PASS: race opened, two racers joined

-- === T2: the PIN hash is not readable from races ===
select assert(
  not exists (select 1 from information_schema.columns
              where table_name = 'races' and column_name like '%pin%'),
  'T2 FAIL: pin hash on races');
\echo T2 PASS: PIN hash kept off the public table

-- === T3: ring in, undo, and only +-1 accepted ===
select as_user('00000000-0000-0000-0000-00000000000b');
select ring_in(:'ben', 1);
select ring_in(:'ben', 1);
select ring_in(:'ben', -1);
select assert((select count = 1 from racers where id = :'ben'), 'T3 FAIL: count');
select expect_error(format('select ring_in(%L, 5)', :'ben'), 'T3 FAIL: +5 accepted');
\echo T3 PASS: taps count, undo works, bulk taps refused

-- === T4: you can only tap for yourself ===
select expect_error(format('select ring_in(%L, 1)', :'cat'), 'T4 FAIL: tapped for Cat');
\echo T4 PASS: cannot ring in for someone else

-- === T5: first to the target wins and the race locks ===
select as_user('00000000-0000-0000-0000-00000000000c');
select ring_in(:'cat', 1);
select ring_in(:'cat', 1);
select ring_in(:'cat', 1);
select assert(
  (select status = 'finished' and winner_racer_id = :'cat' from races where id = :'race'),
  'T5 FAIL: winner');
select expect_error(format('select ring_in(%L, 1)', :'cat'), 'T5 FAIL: tap after win');
select as_user('00000000-0000-0000-0000-00000000000b');
select expect_error(format('select ring_in(%L, 1)', :'ben'), 'T5 FAIL: rival tap after win');
\echo T5 PASS: first to 3 wins, taps lock

-- === T6: wrong PIN cannot correct counts; a bartender cannot either ===
select expect_error(format('select adjust_count(%L, %L, 3, %L)', :'race', :'ben', '9999'),
  'T6 FAIL: wrong PIN accepted');
select expect_error(format('select adjust_count(%L, %L, 3, null)', :'race', :'ben'),
  'T6 FAIL: no PIN accepted');
\echo T6 PASS: corrections need the manager

-- === T7: end-of-night check knocks the winner short -> race reopens ===
select adjust_count(:'race', :'cat', 2, '4242');
select assert(
  (select status = 'active' and winner_racer_id is null from races where id = :'race'),
  'T7 FAIL: race not reopened');
select assert((select finished_at is null from racers where id = :'cat'), 'T7 FAIL: finish kept');
select assert((select count(*) = 1 from count_corrections where racer_id = :'cat'), 'T7 FAIL: no trail');
\echo T7 PASS: correction reopened the race, with a paper trail

-- === T8: manager (as creator, no PIN) corrects Ben up to the target -> Ben wins ===
select as_user('00000000-0000-0000-0000-00000000000a');
select adjust_count(:'race', :'ben', 99, null);
select assert((select count = 3 from racers where id = :'ben'), 'T8 FAIL: clamp');
select assert(
  (select status = 'finished' and winner_racer_id = :'ben' from races where id = :'race'),
  'T8 FAIL: winner');
\echo T8 PASS: creator corrects without PIN, count clamps, win moves

-- === T9: rejoining updates the name, not a second racer ===
select as_user('00000000-0000-0000-0000-00000000000b');
select join_race(:'race', 'Benji', 'pint');
select assert(
  (select count(*) = 1 and min(display_name) = 'Benji'
   from racers where race_id = :'race' and profile_id = '00000000-0000-0000-0000-00000000000b'),
  'T9 FAIL');
\echo T9 PASS: rejoin is idempotent

-- === T10: direct writes are blocked by RLS (Supabase grants table DML) ===
grant select, update on racers to authenticated;
set role authenticated;
update racers set count = 0 where id = :'ben';
reset role;
select assert((select count = 3 from racers where id = :'ben'), 'T10 FAIL: direct update landed');
\echo T10 PASS: direct writes refused

-- === T11: every race gets a short code; lookup ignores case ===
select code as race_code from races where id = :'race' \gset
select assert(:'race_code' ~ '^[A-HJKMNP-Z2-9]{5}$', 'T11 FAIL: code shape ' || :'race_code');
select assert(race_id_for_code(lower(:'race_code')) = :'race', 'T11 FAIL: lookup');
select assert(race_id_for_code('nope!') is null, 'T11 FAIL: bad code resolved');
\echo T11 PASS: short race code, case-insensitive lookup

-- ---------- specs test personal bests ----------

-- Ten rounds: rounds 1-3 called right on line 1 of 4 (200 each), round 4
-- missed, rounds 5-10 called on line 2 of 4 (150 each). Streak 6.
create function good_rounds() returns jsonb
language sql as $fn$
  select jsonb_agg(jsonb_build_object(
    'drink', 'Drink ' || i,
    'correct', i <> 4,
    'linesShown', case when i <= 3 then 1 when i = 4 then 4 else 2 end,
    'totalLines', 4,
    'points', case when i <= 3 then 200 when i = 4 then 0 else 150 end,
    'housePoints', 100
  ) order by i) from generate_series(1, 10) i;
$fn$;

-- === T12: a real game is recorded, totals worked out by the server ===
select as_user('00000000-0000-0000-0000-00000000000b');
select player_score, house_score, correct, best_streak, fastest_lines
  from record_specs_run('Ben', 'mixologist', 6, good_rounds()) \gset t12
select assert(:'t12player_score' = '1500' and :'t12house_score' = '1000'
  and :'t12correct' = '9' and :'t12best_streak' = '6' and :'t12fastest_lines' = '1', 'T12 FAIL');
\echo T12 PASS: specs run recorded with server-checked totals

-- === T13: impossible runs are refused ===
select expect_error(format('select record_specs_run(%L, %L, 6, %L::jsonb)', 'Ben', 'mixologist',
  jsonb_set(good_rounds(), '{0,points}', '9999')), 'T13 FAIL: inflated round score');
select expect_error(format('select record_specs_run(%L, %L, 6, %L::jsonb)', 'Ben', 'mixologist',
  (select jsonb_agg(e) from jsonb_array_elements(good_rounds()) with ordinality t(e, n) where n <= 9)),
  'T13 FAIL: nine-round game');
select expect_error(format('select record_specs_run(%L, %L, 10, %L::jsonb)', 'Ben', 'mixologist', good_rounds()),
  'T13 FAIL: fake streak');
select expect_error(format('select record_specs_run(%L, %L, 6, %L::jsonb)', 'Ben', 'godmode', good_rounds()),
  'T13 FAIL: unknown opponent');
select expect_error(format('select record_specs_run(%L, %L, 6, %L::jsonb)', 'Ben', 'barback',
  jsonb_set(good_rounds(), '{0,linesShown}', '9')), 'T13 FAIL: more lines than the build');
\echo T13 PASS: inflated scores, short games, fake streaks, bad opponents refused

-- === T14: runs are private (Supabase grants table reads; RLS decides rows) ===
grant select on specs_runs to authenticated;
set role authenticated;
select as_user('00000000-0000-0000-0000-00000000000b');
select assert((select count(*) from specs_runs) = 1, 'T14 FAIL: cannot see own run');
select as_user('00000000-0000-0000-0000-00000000000c');
select assert((select count(*) from specs_runs) = 0, 'T14 FAIL: can see someone else''s run');
reset role;
\echo T14 PASS: you only ever see your own runs

\echo ALL RPC TESTS PASSED
