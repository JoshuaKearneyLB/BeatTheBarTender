# 🏁 Baropoly — tonight's drink race

**Pick a drink. Set a number. First behind the bar to sell it wins.**

A manager opens a race in under a minute: the drink (from the house menu or
anything else), a target (10, 20, 30…) and what the winner gets. The crew
open a link on their phones, pick a name and a pixel piece, and tap
**Sold one** every time they ring the drink in. Everyone's piece moves along
the same chalkboard track in real time. First to the target wins; at close
the manager checks counts against the till and the win follows the numbers.

No POS integration, no accounts, no photos — counts are trusted on the night
and checked at close.

**Stack:** Next.js (App Router) · Tailwind CSS v4 · Framer Motion · Lucide ·
Supabase (anonymous Auth + Postgres + Realtime) · installable PWA.

## Quick start

```sh
npm install
npm run dev
```

Open http://localhost:3000. With no env vars set the app runs in **Demo
Mode**: start a race at **I run the bar**, and the demo uses *your* drink,
number and prize. A seeded crew (Marco, Dee, Sam) keep ringing drinks in on
their own so the race feels live; tap **try the bar view** to race them.

### Going live (multi-device realtime)

1. Create a Supabase project and run `supabase/migrations/0001_drink_race.sql`
   (`supabase db push`, or paste it into the SQL editor).
2. Enable **anonymous sign-ins** (Authentication → Providers).
3. Copy `.env.example` to `.env.local` and fill in the project URL + anon key.
4. Deploy (e.g. Vercel) with the same two env vars.

The manager starts a race at `/manager`, copies the crew link from the
console, and drops it in the staff group chat.

## How it works

- **One race, one drink, one number.** The track has one box per drink;
  your count is your square.
- **Sold one / undo.** One tap per sale, with an undo key for mis-taps. The
  server only accepts ±1 per tap, and only for your own piece.
- **First to the target wins**, and the race locks for everyone.
- **Till check at close.** The manager nudges any count up or down to
  match the till. Knock the winner short and the race reopens; push someone
  else to the target and the win moves. Every correction is logged.
- **Manager PIN** (optional) lets a second phone make corrections. The
  phone that opened the race never needs it.

## Architecture: the database is the referee

`lib/race.ts` runs the rules optimistically in the browser;
`_settle_race` in `supabase/migrations/0001_drink_race.sql` runs them
authoritatively in Postgres. Row Level Security blocks every direct write —
`create_race`, `join_race`, `ring_in` and `adjust_count` are the only write
path. Taps lock the race row so two people hitting the target together
can't both win. The PIN hash lives in a table no client can read.

## Structure

```
app/
  page.tsx                  Front door: on the bar / run the bar (+ specs test link)
  manager/page.tsx          Start a race: drink, target, prize (name + PIN tucked away)
  manager/[gameId]/page.tsx Manager console: crew link, stats, track, till check
  game/[gameId]/page.tsx    Bartender view: track, ticker, Sold one, leaderboard
components/
  race/RaceTrack.tsx        Chalkboard track, one box per drink, animated pieces
  race/Leaderboard.tsx      Ranked racers with progress bars (+ manager controls)
  race/EventTicker.tsx      Play-by-play
  race/PrizeModal.tsx       Full-screen prize poster
  bartender/TallyPad.tsx    The drink, your count, Sold one / undo
  bartender/JoinCard.tsx    Name + piece picker (live mode)
lib/
  race.ts                   Pure race rules (mirrored in SQL) + ticker lines
  useRace.ts                One API, two engines (demo / live)
  useDemoRace.ts            Local race with a seeded crew that keeps pouring
  useLiveRace.ts            Auth + optimistic taps + Realtime reconciliation
  demoSetup.ts              Carries the demo race setup in the URL
  recipes.ts                The venue's 25-drink menu (the drink picker)
  supabase/                 client, auth, db (rows/RPCs), realtime
supabase/
  migrations/0001_drink_race.sql  The whole schema, RLS, RPCs
  tests/                    Platform stub + RPC behavioral tests
public/training/            Bonus: “Beat the Bartender” specs test
                            (data/cocktails.js mirrors lib/recipes.ts — keep in sync)
```

## Testing

- `npm run test:db` — throwaway local Postgres, the migration, and 10
  behavioral tests: create/join, PIN hash kept private, ±1 taps and undo,
  no tapping for someone else, first-to-target wins and locks, PIN-gated
  corrections, a correction reopening the race with a paper trail, the
  win moving on a correction, idempotent rejoin, RLS blocking direct writes.
- `npm run test:e2e` — Playwright smoke test of Demo Mode at phone size
  (setup → manager console → bar view carries the race → taps/undo → prize
  → finish → manager correction hands out the win → specs test). Needs
  `npm run build && npm start` and a Chromium binary (`CHROMIUM_BIN`).
- `npm run typecheck` / `npm run build` — strict TypeScript.

## Known limits

- Anonymous sessions are per-browser; clearing site data means rejoining
  as a new racer.
- Counts are trusted until the till check — by design, for speed behind a
  busy bar.
- One race per link; start another race for the next night.

## Cut for the MVP (in git history)

The v0.5 "Monthly Marathon" — a 20–40 tile quest board, Board Builder,
setbacks, checkpoints, event-card deck, templates, photo-verified
sign-off queue, and the square Monopoly-style board — lives in git history
before this commit if any of it earns its way back.
