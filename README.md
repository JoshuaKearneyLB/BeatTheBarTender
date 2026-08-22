# 🎲 Baropoly (v0.4 — Monthly Marathon)

Mobile-first PWA that gamifies bar sales as a digital board game. The
manager builds a campaign: a 20–40 tile board where **every tile carries a
goal** — sell 12 cocktails, upsell 4 top-shelf spirits, land a 5-star
review. Bartenders track progress on their phones, submit each quest with a
till/receipt photo, and move forward when the manager approves. First to
beat the final Boss Quest at Last Call wins the marathon. No POS
integration — manual reporting backed by photo verification and manager
oversight.

**Stack:** Next.js (App Router) · Tailwind CSS v4 · Framer Motion · Lucide ·
Supabase (Auth + Postgres + Realtime + Storage) · Vercel / PWA.

## Quick start

```sh
npm install
npm run dev
```

Open http://localhost:3000. With no env vars set the app runs in **Demo
Mode** — every screen works with local seeded state (including a pending
submission in the manager queue), so you can feel the loop before
provisioning anything.

### Going live (multi-device realtime)

1. Create a Supabase project and run the four migrations in order
   (`supabase db push`, or paste `supabase/migrations/*.sql` into the SQL
   editor: 0001 → 0002 → 0003 → 0004).
2. Enable **anonymous sign-ins** (Authentication → Providers) — staff join
   with a name and a game piece, no accounts needed.
3. Copy `.env.example` to `.env.local` and fill in the project URL + anon key.

Managers build a campaign at `/manager`; bartenders open `/game/<gameId>`
on their phones, clock in, and every submission/approval syncs to every
screen over Realtime.

## The quest model

- **Every tile is a manager-editable object**: its own kind (`standard`,
  `goal`, `setback`, `event_card`, `checkpoint`, `boss`), name, house rule
  text, **movement effect** for landing on it, optional target drink, and a
  **move value** — what clearing its goal is worth (1 standard, 2 for a
  Double Shift, 3 for a Boss Night).
- **Checkpoints are a floor.** Flag any tile a checkpoint and no automatic
  setback or event card can push a player below it, however harsh the
  manager sets the numbers. Only a deliberate manager override crosses one.
- **Event-card tiles draw the house deck.** Managers write the cards
  ("Bribe the Barback: skip ahead 2", "Late to Shift: back 1"), weight how
  often each comes up, and pin a card to a specific tile or leave it in the
  general deck. Every draw is recorded.
- **The official menu drives the goals.** `lib/recipes.ts` holds the
  venue's 25-drink menu — exact specs, spirits, and garnishes, across
  Hacien house signatures, spritzes, classics, and non-alcoholic serves.
  Preset boards generate quests like "Sell 10 Hacien Pineapple Spritzes",
  and the builder's **From menu…** dropdown lets managers target any drink
  or a whole category ("Sell 15 non-alcoholic cocktails").
- **Board Builder** (a tab in the manager console): the whole board as a
  tap-to-edit map, an editor drawer per tile, the event-card deck, and
  **quick-apply templates** — Chaos Shift, Cocktail Focus, Clean & Fast,
  High-Margin Spirits. Editable mid-campaign, not just at launch.
- **Bartender flow:** the quest card shows the active goal; tap the counter
  as the shift goes (synced live so rivals can watch), attach one
  till/shift photo, submit. Status flips to *Pending approval*; on approval
  the token moves and the next quest reveals.
- **Auto-trust toggle:** when on, submissions approve instantly — except on
  the final tile: **the win always waits for a manager**.
- **Landing effects** apply once and never chain.
- **Manager console:** a 1-tap batch approval queue (all pending
  submissions with claim-vs-target, notes, and photos via 60-second signed
  URLs — approve or reject a whole night in seconds), plus roster
  overrides ("Failed Audit" −2, manual advance) and review history.

## Architecture: the database is the referee

The movement engine exists twice, on purpose: `lib/board.ts` (TypeScript)
runs optimistically in the browser; `_apply_quest_approval` in
`supabase/migrations/0004_tile_editor.sql` (plpgsql) runs authoritatively
in Postgres. Row Level Security blocks all direct writes — `create_campaign`,
`join_game`, `update_progress`, `submit_quest`, `review_submissions`,
`manager_override`, `update_tile`, `apply_board_template`,
`replace_event_deck`, `upsert_event_card` and `delete_event_card` are the
only write path (migration 0003 **drops** the v0.2 tally RPCs so they can't
bypass sign-off). Manager PIN checks are bcrypt-verified inside the RPCs,
atomically with the action they authorize. Supabase Realtime broadcasts
player, submission, and game-status changes to every device.

## Structure

```
app/
  page.tsx                  Role picker (bartender / manager / training)
  game/[gameId]/page.tsx    Bartender view: join card → board + quest card
  manager/page.tsx          Campaign setup (name, template, length, trust, PIN)
  manager/[gameId]/page.tsx Manager console: approval queue, roster, history
components/
  manager/BoardBuilder.tsx  Tile map, editor drawer, card deck, quick-apply
  bartender/QuestCard.tsx   Active quest, progress stepper, photo, submit
  bartender/JoinCard.tsx    Name + token picker (live mode)
  board/BoardStrip.tsx      Scrolling tile strip w/ animated tokens + ×2/×3 badges
  board/EventTicker.tsx     Play-by-play of board events
lib/
  recipes.ts                The official 25-drink menu: specs, categories, quest labels
  board.ts                  Board templates + pure movement engine (mirrored in SQL)
  useGame.ts                One API, two engines (demo / live)
  useDemoGame.ts            Local reducer, seeded players + pending submission
  useLiveGame.ts            Auth + optimistic RPCs + Realtime reconciliation
  supabase/                 client, auth, db (rows/RPCs/storage), realtime
supabase/
  migrations/0001_init.sql  Base schema, RLS, realtime, receipts bucket
  migrations/0002_engine_rpcs.sql  (v0.2 tally engine — superseded by 0003)
  migrations/0003_campaign_quests.sql  Goals, submissions, batch review, PIN
  migrations/0004_tile_editor.sql      Manager tile control, checkpoints, cards
  tests/                    Platform stub + engine behavioral tests
scripts/
  test-db.sh                Throwaway-Postgres test runner (npm run test:db)
  smoke.mjs                 Browser smoke test, mobile viewport (npm run test:e2e)
public/training/            “Beat the Bartender” trivia on the official menu
                            (data/cocktails.js mirrors lib/recipes.ts — keep in sync)
```

## Testing

- `npm run test:db` — throwaway local Postgres, all migrations, 18
  behavioral tests of the engine RPCs: create/join, progress sync, pending
  lock, duplicate rejection, PIN auth, batch approval movement, move value
  + landing setback, rejection, auto-trust, override supersede,
  manager-held win, **manager-defined tiles, the checkpoint floor holding
  against a −10 setback, PIN-gated tile edits, patch semantics, card draws,
  template swaps, and refused mismatched templates**.
- `npm run test:e2e` — Playwright smoke test of Demo Mode at phone size
  (progress → submit → pending; manager batch-approve moves the seeded
  player; training game). Needs `npm run build && npm start` and a
  Chromium binary (`CHROMIUM_BIN`).
- `npm run typecheck` / `npm run build` — strict TypeScript.

## Known limits (v0.4)

- Anonymous sessions are per-browser; clearing site data orphans the player
  (manager can re-add via override).
- One photo per submission (by design — the shift-summary shot).
- Manager overrides deliberately bypass the checkpoint floor — a checkpoint
  protects against the board, not against the gaffer.
- Un-flagging a checkpoint doesn't lower floors players already banked.

## Roadmap to v0.5

- Marathon summary screen + per-player history
- Player-vs-player mechanics (steal a tile, head-to-head challenges)
- Offline submission queue via background sync in `sw.js`
- Magic-link identity upgrade for persistent profiles
- Sound + bigger win celebration
