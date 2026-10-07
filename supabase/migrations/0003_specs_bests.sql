-- Specs test personal bests.
--
-- Every finished game of Beat the Bartender is recorded against the
-- player's anonymous sign-in. Personal bests are worked out from that
-- history. Runs are private: you can only ever read your own.
--
-- Scoring happens on the phone, so record_specs_run re-checks the maths
-- and refuses anything impossible. It mirrors lib/specs.ts:
--   a correct call scores 50 + 50 × (lines still hidden), a miss scores 0.

create table specs_runs (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references auth.users (id) on delete cascade,
  display_name text,
  difficulty text not null check (difficulty in ('barback', 'bartender', 'mixologist')),
  player_score int not null check (player_score >= 0),
  house_score int not null check (house_score >= 0),
  best_streak int not null check (best_streak between 0 and 10),
  correct int not null check (correct between 0 and 10),
  fastest_lines int check (fastest_lines >= 0),
  rounds jsonb not null,
  played_at timestamptz not null default now()
);

create index specs_runs_profile_idx on specs_runs (profile_id, played_at desc);

alter table specs_runs enable row level security;
create policy "read own specs runs" on specs_runs for select to authenticated
  using (profile_id = auth.uid());
-- No write policies: record_specs_run is the only way in.

create or replace function record_specs_run(
  p_display_name text,
  p_difficulty text,
  p_best_streak int,
  p_rounds jsonb
) returns specs_runs
language plpgsql security definer set search_path = public as $$
declare
  v_round jsonb;
  v_total int; v_shown int; v_points int; v_house int; v_correct boolean;
  v_player_score int := 0; v_house_score int := 0; v_right int := 0;
  v_fastest int; v_streak int := 0; v_max_streak int := 0;
  v_run specs_runs;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  if jsonb_typeof(p_rounds) <> 'array' or jsonb_array_length(p_rounds) <> 10 then
    raise exception 'a game is exactly 10 rounds';
  end if;

  for v_round in select * from jsonb_array_elements(p_rounds) loop
    v_total := (v_round ->> 'totalLines')::int;
    v_shown := (v_round ->> 'linesShown')::int;
    v_points := (v_round ->> 'points')::int;
    v_house := (v_round ->> 'housePoints')::int;
    v_correct := (v_round ->> 'correct')::boolean;

    if coalesce(v_total, 0) not between 1 and 12
       or v_shown is null or v_shown not between 0 and v_total
       or v_correct is null or v_points is null or v_house is null
       or nullif(trim(coalesce(v_round ->> 'drink', '')), '') is null then
      raise exception 'malformed round';
    end if;
    -- The one thing a round can score is fixed by how much was showing.
    if v_points <> (case when v_correct then 50 + 50 * (v_total - v_shown) else 0 end) then
      raise exception 'round score does not add up';
    end if;
    if v_house < 0 or v_house > 50 + 50 * v_total then
      raise exception 'house score does not add up';
    end if;

    v_player_score := v_player_score + v_points;
    v_house_score := v_house_score + v_house;
    if v_correct then
      v_right := v_right + 1;
      v_fastest := least(coalesce(v_fastest, v_shown), v_shown);
      v_streak := v_streak + 1;
      v_max_streak := greatest(v_max_streak, v_streak);
    else
      v_streak := 0;
    end if;
  end loop;

  if p_best_streak is distinct from v_max_streak then
    raise exception 'streak does not add up';
  end if;

  insert into specs_runs (profile_id, display_name, difficulty, player_score, house_score,
                          best_streak, correct, fastest_lines, rounds)
  values (auth.uid(), left(nullif(trim(coalesce(p_display_name, '')), ''), 24), p_difficulty,
          v_player_score, v_house_score, v_max_streak, v_right, v_fastest, p_rounds)
  returning * into v_run;
  return v_run;
end $$;

revoke execute on function record_specs_run(text, text, int, jsonb) from public, anon;
grant execute on function record_specs_run(text, text, int, jsonb) to authenticated;
