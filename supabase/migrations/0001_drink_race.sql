-- Drink Race — the whole schema.
--
-- A manager opens a race: one drink, a target, a prize. Staff join with a
-- name and a pixel piece and tap +1 per sale. First to the target wins.
-- Taps are trusted; the manager corrects counts at the end of the night.
--
-- Row Level Security blocks every direct write: create_race, join_race,
-- ring_in and adjust_count are the only write path. Run via
-- `supabase db push` or paste into the Supabase SQL editor.

create extension if not exists pgcrypto;

-- ---------- tables ----------

create table races (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  drink_name text not null,
  target int not null check (target between 3 and 200),
  prize_title text not null,
  prize_description text,
  prize_badge text not null default 'trophy',
  status text not null default 'active' check (status in ('active', 'finished')),
  winner_racer_id uuid,                        -- fk added below (circular)
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  ended_at timestamptz
);

-- Kept out of `races` so the PIN hash never reaches a browser via select.
create table race_secrets (
  race_id uuid primary key references races (id) on delete cascade,
  manager_pin_hash text
);

create table racers (
  id uuid primary key default gen_random_uuid(),
  race_id uuid not null references races (id) on delete cascade,
  profile_id uuid not null references auth.users (id) on delete cascade,
  display_name text not null,
  token text not null default 'martini',       -- pixel sprite id (lib/tokens.ts)
  count int not null default 0 check (count >= 0),
  finished_at timestamptz,
  joined_at timestamptz not null default now(),
  unique (race_id, profile_id)
);

alter table races
  add constraint races_winner_fk
  foreign key (winner_racer_id) references racers (id) on delete set null;

-- The end-of-night check leaves a trail.
create table count_corrections (
  id uuid primary key default gen_random_uuid(),
  race_id uuid not null references races (id) on delete cascade,
  racer_id uuid not null references racers (id) on delete cascade,
  old_count int not null,
  new_count int not null,
  created_by uuid not null,
  created_at timestamptz not null default now()
);

-- ---------- row level security ----------

alter table races enable row level security;
alter table race_secrets enable row level security;   -- no policies: RPCs only
alter table racers enable row level security;
alter table count_corrections enable row level security;

create policy "read races" on races for select to authenticated using (true);
create policy "read racers" on racers for select to authenticated using (true);
create policy "read corrections" on count_corrections for select to authenticated using (true);

alter publication supabase_realtime add table races, racers;

-- ---------- helpers ----------

create or replace function _require_manager(p_race races, p_pin text)
returns void
language plpgsql stable security definer set search_path = public as $$
declare v_hash text;
begin
  if p_race.created_by = auth.uid() then
    return;
  end if;
  select manager_pin_hash into v_hash from race_secrets where race_id = p_race.id;
  if v_hash is not null
     and nullif(p_pin, '') is not null
     and crypt(p_pin, v_hash) = v_hash then
    return;
  end if;
  raise exception 'manager authorization failed';
end $$;

-- Mirrors lib/race.ts settle(): stamp or clear finish times, then the
-- earliest finisher holds the race. Caller must hold the race row lock.
create or replace function _settle_race(p_race_id uuid)
returns races
language plpgsql security definer set search_path = public as $$
declare v_race races; v_winner uuid;
begin
  select * into v_race from races where id = p_race_id;

  update racers set finished_at = now()
  where race_id = p_race_id and count >= v_race.target and finished_at is null;
  update racers set finished_at = null
  where race_id = p_race_id and count < v_race.target and finished_at is not null;

  select id into v_winner from racers
  where race_id = p_race_id and finished_at is not null
  order by finished_at, joined_at
  limit 1;

  update races set
    winner_racer_id = v_winner,
    status = case when v_winner is null then 'active' else 'finished' end,
    ended_at = case
      when v_winner is null then null
      when winner_racer_id is distinct from v_winner then now()
      else ended_at end
  where id = p_race_id
  returning * into v_race;
  return v_race;
end $$;

-- ---------- manager ----------

create or replace function create_race(
  p_name text,
  p_drink_name text,
  p_target int,
  p_prize_title text,
  p_prize_description text default null,
  p_prize_badge text default null,
  p_pin text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  if nullif(trim(coalesce(p_drink_name, '')), '') is null then
    raise exception 'pick a drink to race';
  end if;

  insert into races (name, drink_name, target, prize_title, prize_description, prize_badge, created_by)
  values (
    coalesce(nullif(trim(p_name), ''), 'Drink Race'),
    trim(p_drink_name),
    p_target,
    coalesce(nullif(trim(p_prize_title), ''), 'Bragging rights'),
    nullif(trim(coalesce(p_prize_description, '')), ''),
    coalesce(nullif(trim(coalesce(p_prize_badge, '')), ''), 'trophy'),
    auth.uid()
  )
  returning id into v_id;

  insert into race_secrets (race_id, manager_pin_hash)
  values (v_id, case when nullif(p_pin, '') is null then null else crypt(p_pin, gen_salt('bf')) end);

  return v_id;
end $$;

-- End-of-night check: set a racer's count to what the till says. Can hand
-- the win to someone else, or reopen the race if the leader drops short.
create or replace function adjust_count(
  p_race_id uuid,
  p_racer_id uuid,
  p_count int,
  p_pin text default null
) returns racers
language plpgsql security definer set search_path = public as $$
declare v_race races; v_racer racers; v_old int;
begin
  select * into v_race from races where id = p_race_id for update;
  if not found then raise exception 'no such race'; end if;
  perform _require_manager(v_race, p_pin);

  select count into v_old from racers where id = p_racer_id and race_id = p_race_id for update;
  if not found then raise exception 'no such racer'; end if;

  update racers set count = greatest(0, least(p_count, v_race.target))
  where id = p_racer_id;
  perform _settle_race(p_race_id);

  select * into v_racer from racers where id = p_racer_id;
  if v_racer.count <> v_old then
    insert into count_corrections (race_id, racer_id, old_count, new_count, created_by)
    values (p_race_id, p_racer_id, v_old, v_racer.count, auth.uid());
  end if;
  return v_racer;
end $$;

-- ---------- staff ----------

create or replace function join_race(p_race_id uuid, p_display_name text, p_token text)
returns racers
language plpgsql security definer set search_path = public as $$
declare v_racer racers;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  if not exists (select 1 from races where id = p_race_id) then
    raise exception 'no such race';
  end if;
  insert into racers (race_id, profile_id, display_name, token)
  values (
    p_race_id,
    auth.uid(),
    left(coalesce(nullif(trim(p_display_name), ''), 'Staff'), 24),
    coalesce(nullif(trim(coalesce(p_token, '')), ''), 'martini')
  )
  on conflict (race_id, profile_id) do update
    set display_name = excluded.display_name,
        token = excluded.token
  returning * into v_racer;
  return v_racer;
end $$;

-- One tap: +1 for a sale, -1 to undo a mis-tap. The race row lock
-- serialises taps, so two people hitting the target together can't both win.
create or replace function ring_in(p_racer_id uuid, p_delta int)
returns racers
language plpgsql security definer set search_path = public as $$
declare v_racer racers; v_race races;
begin
  if p_delta not in (-1, 1) then
    raise exception 'one drink at a time';
  end if;
  select * into v_racer from racers where id = p_racer_id;
  if not found or v_racer.profile_id <> auth.uid() then
    raise exception 'not your racer';
  end if;
  select * into v_race from races where id = v_racer.race_id for update;
  if v_race.status <> 'active' then
    raise exception 'the race is over';
  end if;

  update racers set count = greatest(0, least(count + p_delta, v_race.target))
  where id = p_racer_id;
  perform _settle_race(v_race.id);

  select * into v_racer from racers where id = p_racer_id;
  return v_racer;
end $$;

-- ---------- grants ----------

revoke execute on all functions in schema public from public, anon;
grant execute on function
  create_race(text, text, int, text, text, text, text),
  adjust_count(uuid, uuid, int, text),
  join_race(uuid, text, text),
  ring_in(uuid, int)
to authenticated;
