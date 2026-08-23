-- Baropoly v0.6 — pixel sprites replace platform emoji.
--
-- Player pieces and prize badges are now sprite ids (see lib/tokens.ts)
-- rather than emoji characters. The columns stay text; only what we put in
-- them changes, and the client falls back to a default sprite for any value
-- it doesn't recognise, so pre-existing emoji rows keep rendering.

comment on column game_players.token_emoji is
  'Pixel sprite id from lib/tokens.ts (e.g. "martini"). Legacy emoji values still render via a client-side fallback.';
comment on column games.prize_badge is
  'Pixel badge id from lib/tokens.ts (e.g. "trophy").';

alter table games alter column prize_badge set default 'trophy';
alter table profiles alter column token_emoji set default 'martini';
alter table game_players alter column token_emoji set default 'martini';
