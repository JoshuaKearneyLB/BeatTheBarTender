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

Open http://localhost:3000. With no env vars set, every race is a **demo
race**: start one at **I run the bar** and the demo uses *your* drink,
number and prize. A seeded crew (Marco, Dee, Sam) keep ringing drinks in on
their own so the race feels live; tap **try the bar view** to race them.

### Going live

1. **Supabase:** create a project, then run both migrations in order —
   `supabase/migrations/0001_drink_race.sql`, then `0002_go_live.sql`
   (`supabase db push`, or paste each into the SQL editor).
2. **Anonymous sign-ins:** Authentication → Sign In / Providers → turn on
   *Allow anonymous sign-ins*. Staff never make accounts.
3. **Env vars** (Project Settings → API) — locally in `.env.local`, and on
   Vercel under Settings → Environment Variables:
   `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. **Redeploy.** `NEXT_PUBLIC_*` values are baked in at build time, so a
   deploy made before they were set stays demo-only.

Live and demo run side by side: real races live in Supabase, and
`/manager/demo` stays available as a no-setup demo for showing venues.

### A night with it

1. Manager: **I run the bar** → drink, number, prize → **Race to 20**.
2. The console shows a five-letter **race code** and a **Share** button
   (the phone's share sheet → the staff group chat).
3. Staff: open the link, or type the code on the front door → name + piece
   → **Sold one** every time they ring the drink in.
4. First to the number wins; the manager's console updates live.
5. At close, **Till check**: nudge counts to match the till. The win follows.

Both phones keep the race on their front door under *Your races on this
phone*, so nobody has to find the link again.

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
path (`race_id_for_code` resolves typed codes). Taps lock the race row so two people hitting the target together
can't both win. The PIN hash lives in a table no client can read.

## Structure

```
app/
  page.tsx                  Front door: race code box, run the bar, demo, your races
  join/[code]/page.tsx      Short link / typed code → the race
  manager/page.tsx          Start a race: drink, target, prize (name + PIN tucked away)
  manager/[gameId]/page.tsx Manager console: race code + share, stats, track, till check
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
  myRaces.ts                Races this phone opened or joined (front door list)
  recipes.ts                The venue's 25-drink menu (the drink picker)
  supabase/                 client, auth, db (rows/RPCs), realtime
supabase/
  migrations/0001_drink_race.sql  The schema, RLS, RPCs
  migrations/0002_go_live.sql     Supabase fixes + five-letter race codes
  tests/                    Platform stub + RPC behavioral tests
public/training/            Bonus: “Beat the Bartender” specs test
                            (data/cocktails.js mirrors lib/recipes.ts — keep in sync)
```

## Testing

- `npm run test:db` — throwaway local Postgres, the migrations, and 11
  behavioral tests: create/join, PIN hash kept private, ±1 taps and undo,
  no tapping for someone else, first-to-target wins and locks, PIN-gated
  corrections, a correction reopening the race with a paper trail, the
  win moving on a correction, idempotent rejoin, RLS blocking direct writes,
  short codes with case-insensitive lookup.
- `npm run test:e2e` — Playwright smoke test of Demo Mode at phone size
  (setup → manager console → bar view carries the race → taps/undo → prize
  → finish → manager correction hands out the win → specs test). Needs
  `npm run build && npm start` and a Chromium binary (`CHROMIUM_BIN`).
- `npm run test:e2e:live` — two phones (separate anonymous sessions)
  against a real Supabase: manager opens a race, bartender joins by typed
  code, fast taps to the win, the manager sees it over Realtime, a till
  check reopens it on both phones, refresh keeps the racer, front-door
  lists, polite bad codes/links, and the demo still working. Needs a build
  made with the Supabase env vars (`npx supabase start` works locally with
  anonymous sign-ins enabled in `supabase/config.toml`).
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
