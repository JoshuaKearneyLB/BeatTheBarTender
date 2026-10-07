// Beat the Bartender — the specs test's rules, and the personal-best maths.
//
// Each round, a mystery drink's build prints out one line at a time. The
// earlier you call it right, the more you score. The house bartender plays
// the same round and locks in an answer of their own. Outscore them over
// ten rounds to win the shift.
//
// The scoring constants are mirrored by record_specs_run in
// supabase/migrations/0003_specs_bests.sql, which refuses impossible runs —
// keep the two in step.

import { MENU, type Recipe } from "./recipes";

export const ROUNDS_PER_GAME = 10;
export const REVEAL_INTERVAL_MS = 3000;
export const FIRST_REVEAL_MS = 400;
export const POINTS_BASE = 50;
export const POINTS_PER_HIDDEN = 50;

export type DifficultyKey = "barback" | "bartender" | "mixologist";

export interface Difficulty {
  key: DifficultyKey;
  label: string;
  blurb: string;
  /** Chance the house's call is right. */
  accuracy: number;
  /** How many lines of the build they need before they call it (min, max). */
  lockIn: [number, number];
  name: string;
}

export const DIFFICULTIES: Difficulty[] = [
  {
    key: "barback",
    label: "The barback",
    blurb: "three weeks in, still checks the book",
    accuracy: 0.55,
    lockIn: [3, 5],
    name: "Sam",
  },
  {
    key: "bartender",
    label: "The closer",
    blurb: "knows the menu cold, never rushes",
    accuracy: 0.75,
    lockIn: [2, 4],
    name: "Rusty",
  },
  {
    key: "mixologist",
    label: "The mixologist",
    blurb: "hand-carves the ice. insufferable. correct.",
    accuracy: 0.92,
    lockIn: [1, 3],
    name: "Vesper",
  },
];

export const difficultyByKey = (key: string) => DIFFICULTIES.find((d) => d.key === key);

// ---------- one round ----------

export interface Round {
  drink: Recipe;
  options: string[];
  revealed: number;
  houseLockIn: number;
  houseLocked: boolean;
  houseCorrect: boolean;
  /** Set once the round is over: the player's pick, or null if they ran out of time. */
  outcome?: {
    choice: string | null;
    playerCorrect: boolean;
    playerPoints: number;
    houseScored: boolean;
    housePoints: number;
  };
}

export function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

export function dealDeck(): Recipe[] {
  return shuffle(MENU).slice(0, ROUNDS_PER_GAME);
}

export function startRound(drink: Recipe, difficulty: Difficulty): Round {
  const [lockMin, lockMax] = difficulty.lockIn;
  const decoys = shuffle(MENU.filter((r) => r.name !== drink.name))
    .slice(0, 3)
    .map((r) => r.name);
  return {
    drink,
    options: shuffle([drink.name, ...decoys]),
    revealed: 0,
    houseLockIn: Math.min(randInt(lockMin, lockMax), drink.clues.length),
    houseLocked: false,
    houseCorrect: Math.random() < difficulty.accuracy,
  };
}

/** Print the next line; the house locks in once enough is showing. */
export function revealNext(round: Round): Round {
  const revealed = Math.min(round.revealed + 1, round.drink.clues.length);
  return { ...round, revealed, houseLocked: round.houseLocked || revealed >= round.houseLockIn };
}

export function pointsFor(totalLines: number, linesShown: number): number {
  return POINTS_BASE + POINTS_PER_HIDDEN * (totalLines - linesShown);
}

/** Settle the round: a guess, or null when the build ran out. */
export function resolveRound(round: Round, choice: string | null): Round {
  const total = round.drink.clues.length;
  const playerCorrect = choice === round.drink.name;
  // The house only scores if they locked in before the round ended and
  // their knowledge check passed.
  const houseScored = round.houseLocked && round.houseCorrect;
  return {
    ...round,
    outcome: {
      choice,
      playerCorrect,
      playerPoints: playerCorrect ? pointsFor(total, round.revealed) : 0,
      houseScored,
      housePoints: houseScored ? pointsFor(total, round.houseLockIn) : 0,
    },
  };
}

// ---------- a finished game ----------

export interface RoundRecord {
  drink: string;
  correct: boolean;
  /** Lines of the build showing when the round ended. */
  linesShown: number;
  totalLines: number;
  points: number;
  housePoints: number;
}

export interface SpecsRun {
  id?: string;
  difficulty: DifficultyKey;
  playerScore: number;
  houseScore: number;
  bestStreak: number;
  correct: number;
  /** Fewest lines showing on a correct call; null if nothing was called right. */
  fastestLines: number | null;
  rounds: RoundRecord[];
  playedAt: string;
  displayName?: string;
}

export function toRoundRecord(round: Round): RoundRecord {
  const o = round.outcome!;
  return {
    drink: round.drink.name,
    correct: o.playerCorrect,
    linesShown: round.revealed,
    totalLines: round.drink.clues.length,
    points: o.playerPoints,
    housePoints: o.housePoints,
  };
}

export function summariseRun(
  difficulty: DifficultyKey,
  rounds: RoundRecord[],
  bestStreak: number,
  displayName?: string,
): SpecsRun {
  const right = rounds.filter((r) => r.correct);
  return {
    difficulty,
    playerScore: rounds.reduce((s, r) => s + r.points, 0),
    houseScore: rounds.reduce((s, r) => s + r.housePoints, 0),
    bestStreak,
    correct: right.length,
    fastestLines: right.length ? Math.min(...right.map((r) => r.linesShown)) : null,
    rounds,
    playedAt: new Date().toISOString(),
    displayName,
  };
}

export const wonRun = (run: SpecsRun) => run.playerScore > run.houseScore;

// ---------- personal bests ----------

export interface DifficultyBests {
  difficulty: DifficultyKey;
  played: number;
  won: number;
  bestScore: number | null;
  bestScoreAt: string | null;
  bestStreak: number;
  /** Fewest lines showing on any correct call. */
  fastestLines: number | null;
}

export function bestsFor(runs: SpecsRun[], difficulty: DifficultyKey): DifficultyBests {
  const mine = runs.filter((r) => r.difficulty === difficulty);
  const top = mine.reduce<SpecsRun | null>(
    (best, r) => (!best || r.playerScore > best.playerScore ? r : best),
    null,
  );
  const fastest = mine
    .map((r) => r.fastestLines)
    .filter((n): n is number => n !== null);
  return {
    difficulty,
    played: mine.length,
    won: mine.filter(wonRun).length,
    bestScore: top?.playerScore ?? null,
    bestScoreAt: top?.playedAt ?? null,
    bestStreak: mine.reduce((m, r) => Math.max(m, r.bestStreak), 0),
    fastestLines: fastest.length ? Math.min(...fastest) : null,
  };
}

/** Did this run beat every earlier run against the same opponent? */
export function isNewBest(run: SpecsRun, earlier: SpecsRun[]): { isBest: boolean; previous: number | null } {
  const previous = bestsFor(earlier, run.difficulty).bestScore;
  return { isBest: run.playerScore > 0 && (previous === null || run.playerScore > previous), previous };
}

export interface StudyItem {
  drink: Recipe;
  seen: number;
  missed: number;
  /** Average lines showing on correct calls; high = slow to recognise. */
  avgLinesWhenRight: number | null;
  /** 0 (nailed) .. 1 (never got it) — misses count most, slow calls some. */
  weakness: number;
}

/** Drinks worth another look, worst first. Only drinks you've actually seen. */
export function specsToStudy(runs: SpecsRun[], limit = 8): StudyItem[] {
  const tally = new Map<string, { seen: number; missed: number; lines: number[]; total: number }>();
  for (const run of runs) {
    for (const r of run.rounds) {
      const t = tally.get(r.drink) ?? { seen: 0, missed: 0, lines: [], total: r.totalLines };
      t.seen += 1;
      if (r.correct) t.lines.push(r.linesShown);
      else t.missed += 1;
      tally.set(r.drink, t);
    }
  }
  const items: StudyItem[] = [];
  for (const [name, t] of tally) {
    const drink = MENU.find((d) => d.name === name);
    if (!drink) continue; // dropped from the menu since
    const avg = t.lines.length ? t.lines.reduce((a, b) => a + b, 0) / t.lines.length : null;
    const missRate = t.missed / t.seen;
    // 0 = called on the first line (or before it), 1 = needed the whole build.
    const slowness = avg === null ? 1 : Math.max(0, avg - 1) / Math.max(1, t.total - 1);
    const weakness = 0.75 * missRate + 0.25 * slowness;
    if (missRate === 0 && slowness < 0.5) continue; // nailed it
    items.push({ drink, seen: t.seen, missed: t.missed, avgLinesWhenRight: avg, weakness });
  }
  return items.sort((a, b) => b.weakness - a.weakness).slice(0, limit);
}
