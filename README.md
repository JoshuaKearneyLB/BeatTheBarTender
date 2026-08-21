# 🎲 Baropoly (v0.1)

Mobile-first PWA that gamifies bar sales as a digital board game. Bartenders
speed-tally sales on their phones; every tally pushes their token along a
30-tile board with bonuses, setbacks, and manager checkpoints. First to Last
Call wins the shift. No POS integration at launch — manual tallies backed by
receipt-photo spot-checks and manager oversight.

**Stack:** Next.js (App Router) · Tailwind CSS v4 · Framer Motion · Lucide ·
Supabase (Postgres + Realtime + Storage) · Vercel / PWA.

## Quick start

```sh
npm install
npm run dev
```

Open http://localhost:3000. With no env vars set the app runs in **Demo
Mode** — every screen works with local seeded state, so you can feel the
game loop before provisioning anything.

To go live: create a Supabase project, run
`supabase/migrations/0001_init.sql`, copy `.env.example` to `.env.local`,
and fill in the URL + anon key.

## Structure

```
app/
  page.tsx                  Role picker (bartender / manager / training)
  layout.tsx, globals.css   Shell, theme tokens, PWA metadata
  manifest.ts               PWA web manifest
  game/[gameId]/page.tsx    Bartender view: board + ticker + tally pad
  manager/page.tsx          Shift setup (name, board size, pace, PIN)
  manager/[gameId]/page.tsx Manager console: roster, overrides, audit feed
components/
  bartender/TallyPad.tsx    Speed-tally buttons, receipt capture, undo
  board/BoardStrip.tsx      Scrolling tile strip w/ animated player tokens
  board/EventTicker.tsx     Play-by-play of board events
  RegisterSW.tsx            Service-worker registration
lib/
  types.ts                  Domain types + default tally actions
  board.ts                  Board engine (pure): generation, movement, effects
  useGame.ts                Game state hook (demo reducer / realtime seam)
  supabase/client.ts        Browser client (null ⇒ Demo Mode)
  supabase/realtime.ts      Per-game live subscription
supabase/migrations/
  0001_init.sql             Schema, RLS, realtime publication, storage bucket
public/
  sw.js, icon.svg           Offline shell + app icon
  training/                 “Beat the Bartender” cocktail trivia mini-game
```

## Game rules (v0.1 defaults)

- Each tally tap logs an action (cocktail/draft = 1 unit, upsell = 2).
- Every `actions_per_tile` units (default 3) advances the token one tile.
- Landing effects: **bonus** skips ahead, **setback** moves back
  ("Spill on the Rail — move back 2"), **challenge** poses a task; effects
  never chain.
- **Checkpoint** (mid-board) and **finish** tiles park the player until a
  manager approves — the anti-cheat pinch points.
- Managers can manual-advance, apply a "Failed Audit" setback, void
  tallies, and approve/deny the win.

## Demo Mode notes

Demo state is per-tab (the bartender and manager demo screens each seed
their own session). Realtime cross-device sync activates with Supabase env
vars — the seam is `lib/useGame.ts` + `lib/supabase/realtime.ts`.

## Training corner

`/training` serves **Beat the Bartender**, a self-contained cocktail-trivia
game (guess the drink from its ingredients before the house bartender does).
Handy for onboarding new staff during dead hours. It predates the Baropoly
scaffold and is intentionally dependency-free — see
`public/training/ABOUT.md`.

## Roadmap to v0.2

- Supabase Auth (magic link) + profile onboarding
- Server-authoritative moves via Postgres RPC (client stays optimistic)
- Receipt upload to Storage + signed-URL audit feed
- Manager PIN verification in an edge function
- Offline tally queue via background sync in `sw.js`
