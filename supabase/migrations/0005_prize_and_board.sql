-- Baropoly v0.5 — what they're actually playing for.
--
-- The prize lives on the game so staff can read it from the board, and the
-- campaign length is explicit so "days left" is a real number rather than
-- an assumption.

alter table games
  add column prize_title text not null default 'Winner takes the month',
  add column prize_description text,
  add column prize_badge text not null default '🏆',
  add column campaign_days int not null default 30 check (campaign_days between 1 and 120);

create or replace function update_prize(
  p_game_id uuid,
  p_title text,
  p_description text,
  p_badge text default null,
  p_campaign_days int default null,
  p_pin text default null
) returns games
language plpgsql security definer set search_path = public as $$
declare v_game games;
begin
  select * into v_game from games where id = p_game_id;
  if not found then raise exception 'no such game'; end if;
  perform _require_manager(v_game, p_pin);

  update games set
    prize_title = coalesce(nullif(trim(coalesce(p_title, '')), ''), prize_title),
    prize_description = case when p_description is null
      then prize_description else nullif(trim(p_description), '') end,
    prize_badge = coalesce(nullif(trim(coalesce(p_badge, '')), ''), prize_badge),
    campaign_days = coalesce(p_campaign_days, campaign_days)
  where id = p_game_id
  returning * into v_game;
  return v_game;
end $$;

grant execute on function update_prize(uuid, text, text, text, int, text) to authenticated;
