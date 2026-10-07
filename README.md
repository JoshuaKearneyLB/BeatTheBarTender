# 🏁 Baropoly — two games for the bar

1. **The drink race.** Pick a drink. Set a number. First behind the bar to
   sell it wins.
2. **The specs test — Beat the Bartender.** The build of a house drink
   prints one line at a time; call it before the smug one behind the bar
   does. Every game goes in the book, and **My personal bests** keeps your
   records and the specs you keep fumbling.

## Game 1: the drink race

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

1. **Supabase:** create a project, then run the migrations in order —
   `0001_drink_race.sql`, `0002_go_live.sql`, `0003_specs_bests.sql` from
   `supabase/migrations/` (`supabase db push`, or paste each into the SQL
   editor).
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

## Game 2: the specs test

The mechanics are the original standalone game's, unchanged: ten rounds off
the house menu, the build prints a line every three seconds (least to most
revealing), a correct call scores 50 + 50 per line still hidden, and the
house — Sam, Rusty or Vesper — plays the same round with its own speed and
accuracy. Keys 1–4 answer, Enter moves on.

What's new is the book:

- **Every finished game is recorded**: opponent, scores, streak, rounds
  right, fastest call, and each round's drink and lines showing.
- **New personal best** gets stamped on the final tab when a game beats
  your best against that opponent.
- **`/bests`** shows, per opponent, your best score (and when), longest
  streak, fastest call and games won; your last 10 games; and **Specs to
  study** — drinks you've missed or called slowly, worst first, with the
  full spec.
- **Where it's kept:** live, in `specs_runs`, against the phone's anonymous
  sign-in (private: you can only read your own). A game finished offline is
  queued on the phone and sent next time. In demo mode, on the phone. Your
  name and piece are shared with the race's join card.
- **Cheat-proofing:** scoring happens on the phone, so `record_specs_run`
  re-adds every round and refuses anything that doesn't add up.

The menu in `lib/recipes.ts` drives both games; each drink's `clues` are
its spec reordered least-to-most revealing for the specs test.

## Architecture: the database is the referee

`lib/race.ts` runs the rules optimistically in the browser;
`_settle_race` in `supabase/migrations/0001_drink_race.sql` runs them
authoritatively in Postgres. Row Level Security blocks every direct write —
`create_race`, `join_race`, `ring_in` and `adjust_count` are the only write
path (`race_id_for_code` resolves typed codes; `record_specs_run` is the
only way a specs game gets in). Taps lock the race row so two people hitting the target together
can't both win. The PIN hash lives in a table no client can read.

## Structure

```
app/
  page.tsx                  Front door: race code box, run the bar, demo, your races
  join/[code]/page.tsx      Short link / typed code → the race
  manager/page.tsx          Start a race: drink, target, prize (name + PIN tucked away)
  manager/[gameId]/page.tsx Manager console: race code + share, stats, track, till check
  game/[gameId]/page.tsx    Bartender view: track, ticker, Sold one, leaderboard
  specs/page.tsx            The specs test (+ specs.css, its house style)
  bests/page.tsx            My personal bests
components/
  race/RaceTrack.tsx        Chalkboard track, one box per drink, animated pieces
  race/Leaderboard.tsx      Ranked racers with progress bars (+ manager controls)
  race/EventTicker.tsx      Play-by-play
  race/PrizeModal.tsx       Full-screen prize poster
  bartender/TallyPad.tsx    The drink, your count, Sold one / undo
  bartender/JoinCard.tsx    Name + piece picker (live mode)
  specs/SpecsGame.tsx       The specs test: rounds, timers, final tab, save
lib/
  race.ts                   Pure race rules (mirrored in SQL) + ticker lines
  useRace.ts                One API, two engines (demo / live)
  useDemoRace.ts            Local race with a seeded crew that keeps pouring
  useLiveRace.ts            Auth + optimistic taps + Realtime reconciliation
  demoSetup.ts              Carries the demo race setup in the URL
  myRaces.ts                Races this phone opened or joined (front door list)
  recipes.ts                The venue's 25-drink menu — drives both games
  specs.ts                  Specs test rules + personal-best maths
  specsStore.ts             Saving/loading games (Supabase, offline queue, demo)
  profile.ts                This phone's name + piece, shared by both games
  supabase/                 client, auth, db (rows/RPCs), realtime
supabase/
  migrations/0001_drink_race.sql  The schema, RLS, RPCs
  migrations/0002_go_live.sql     Supabase fixes + five-letter race codes
  migrations/0003_specs_bests.sql Specs test games + record_specs_run
  tests/                    Platform stub + RPC behavioral tests
```

## Testing

- `npm run test:db` — throwaway local Postgres, the migrations, and 14
  behavioral tests: create/join, PIN hash kept private, ±1 taps and undo,
  no tapping for someone else, first-to-target wins and locks, PIN-gated
  corrections, a correction reopening the race with a paper trail, the
  win moving on a correction, idempotent rejoin, RLS blocking direct writes,
  short codes with case-insensitive lookup; specs games recorded with
  server-checked totals, impossible games refused, and games private to
  their player.
- `npm run test:specs` — the specs test's rules and personal-best maths:
  scoring unchanged, the house's lock-in, bests per opponent, what counts
  as a new best, and what lands on "Specs to study".
- `npm run test:e2e` — Playwright smoke test of Demo Mode at phone size
  (setup → manager console → bar view carries the race → taps/undo → prize
  → finish → manager correction hands out the win → a full specs test,
  the new-best stamp, the bests page, old /training links). Needs
  `npm run build && npm start` and a Chromium binary (`CHROMIUM_BIN`).
- `npm run test:e2e:live` — two phones (separate anonymous sessions)
  against a real Supabase: manager opens a race, bartender joins by typed
  code, fast taps to the win, the manager sees it over Realtime, a till
  check reopens it on both phones, refresh keeps the racer, front-door
  lists, polite bad codes/links, the demo still working, and a specs game
  saved to Supabase and read back on that phone only. Needs a build
  made with the Supabase env vars (`npx supabase start` works locally with
  anonymous sign-ins enabled in `supabase/config.toml`).
- `npm run typecheck` / `npm run build` — strict TypeScript.

## Known limits

- Anonymous sessions are per-browser; clearing site data means rejoining
  as a new racer and starting a fresh book of personal bests. Real
  accounts (e.g. an email sign-in link) would carry bests across phones.
- Counts are trusted until the till check — by design, for speed behind a
  busy bar.
- One race per link; start another race for the next night.

## Cut for the MVP (in git history)

The v0.5 "Monthly Marathon" — a 20–40 tile quest board, Board Builder,
setbacks, checkpoints, event-card deck, templates, photo-verified
sign-off queue, and the square Monopoly-style board — lives in git history
before this commit if any of it earns its way back.
