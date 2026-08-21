# 🎲 Baropoly (v0.2)

Mobile-first PWA that gamifies bar sales as a digital board game. Bartenders
speed-tally sales on their phones; every tally pushes their token along a
30-tile board with bonuses, setbacks, and manager checkpoints. First to Last
Call wins the shift. No POS integration at launch — manual tallies backed by
receipt-photo spot-checks and manager oversight.

**Stack:** Next.js (App Router) · Tailwind CSS v4 · Framer Motion · Lucide ·
Supabase (Auth + Postgres + Realtime + Storage) · Vercel / PWA.

## Quick start

```sh
npm install
npm run dev
```

Open http://localhost:3000. With no env vars set the app runs in **Demo
Mode** — every screen works with local seeded state, so you can feel the
game loop before provisioning anything.

### Going live (multi-device realtime)

1. Create a Supabase project and run both migrations in order
   (`supabase db push`, or paste `supabase/migrations/0001_init.sql` then
   `0002_engine_rpcs.sql` into the SQL editor).
2. Enable **anonymous sign-ins** (Authentication → Providers) — staff join
   with a name and a game piece, no accounts needed.
3. Copy `.env.example` to `.env.local` and fill in the project URL + anon key.

Managers create a shift at `/manager` (setting the PIN); bartenders open
`/game/<gameId>` on their phones, clock in, and every tap syncs to every
screen over Realtime.

## Architecture: the database is the referee

The pure board engine exists twice, on purpose:

- `lib/board.ts` (TypeScript) runs **optimistically** in the browser, so a
  tap moves your token instantly.
- `supabase/migrations/0002_engine_rpcs.sql` (plpgsql) runs
  **authoritatively** in Postgres: `log_action`, `void_last_action`,
  `manager_override`, `manager_approve`, `join_game`, `create_game`. Row
  Level Security blocks all direct writes; the RPCs are the only write path.

Each RPC returns the authoritative player row, which reconciles the
optimistic state; Supabase Realtime broadcasts the same row changes to every
other device, where `lib/useLiveGame.ts` patches local state and derives
ticker events (Framer Motion animates tokens on any position change,
regardless of which device caused it).

**Manager security:** the PIN set at shift creation is bcrypt-hashed
(pgcrypto) and verified inside the RPCs — atomically with the override or
approval it authorizes. Nothing PIN-gated ever happens client-side. The
game's creator and profiles with the `manager` role bypass the PIN.

**Receipts:** tally taps can attach a camera photo. Live mode uploads it to
the private `receipts` bucket and stores the path on the `action_logs` row;
the manager console mints a 60-second signed URL on demand to view it.

## Structure

```
app/
  page.tsx                  Role picker (bartender / manager / training)
  game/[gameId]/page.tsx    Bartender view: join card → board + tally pad
  manager/page.tsx          Shift setup (board size, pace, PIN)
  manager/[gameId]/page.tsx Manager console: roster, PIN'd overrides, audit feed
components/
  bartender/TallyPad.tsx    Speed-tally buttons, receipt capture, undo
  bartender/JoinCard.tsx    Name + token picker (live mode)
  board/BoardStrip.tsx      Scrolling tile strip w/ animated player tokens
  board/EventTicker.tsx     Play-by-play of board events
lib/
  board.ts                  Pure board engine (mirrored by the SQL engine)
  useGame.ts                One API, two engines (demo / live)
  useDemoGame.ts            Local reducer, seeded players
  useLiveGame.ts            Auth + optimistic RPCs + Realtime reconciliation
  supabase/                 client, auth, db (rows/RPCs/storage), realtime
supabase/
  migrations/0001_init.sql  Schema, RLS, realtime publication, receipts bucket
  migrations/0002_engine_rpcs.sql  Server-side engine + PIN security
  tests/                    Platform stub + RPC behavioral tests
scripts/
  test-db.sh                Throwaway-Postgres test runner (npm run test:db)
  smoke.mjs                 Browser smoke test, mobile viewport (npm run test:e2e)
public/training/            “Beat the Bartender” trivia mini-game
```

## Testing

- `npm run test:db` — spins up a throwaway local Postgres, applies both
  migrations against a Supabase-surface stub, and runs 10 behavioral tests
  of the RPC engine (movement, bonus hop, checkpoint parking, locked-player
  rejection, wrong/right PIN, undo replay, override, win approval).
- `npm run test:e2e` — Playwright smoke test of Demo Mode at phone size
  (tally → advance → undo, manager override, training game). Needs a
  running production server (`npm run build && npm start`) and a Chromium
  binary (`CHROMIUM_BIN`).
- `npm run typecheck` / `npm run build` — strict TypeScript.

## Known limits (v0.2)

- Undo replays only tally logs, so it also unwinds manager override deltas
  (managers can re-apply). Same behavior in both engines, by design.
- Live per-action tallies are derived from the last 500 log rows.
- Anonymous sessions are per-browser; clearing site data orphans the player
  (manager can re-add via override).

## Roadmap to v0.3

- Shift-end summary screen + history
- Offline tally queue via background sync in `sw.js`
- Challenge tile task verification flow
- Magic-link identity upgrade for persistent profiles
- Sound + bigger win celebration
