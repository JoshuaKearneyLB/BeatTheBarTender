// Unit tests for the specs test's rules and personal-best maths (lib/specs.ts).
// Run: npm run test:specs

import assert from "node:assert/strict";
import { MENU } from "../lib/recipes";
import {
  DIFFICULTIES,
  bestsFor,
  isNewBest,
  pointsFor,
  resolveRound,
  revealNext,
  specsToStudy,
  startRound,
  summariseRun,
  type RoundRecord,
  type SpecsRun,
} from "../lib/specs";

let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`PASS ${name}`);
}

const drink = (name: string) => MENU.find((d) => d.name === name)!;
const rec = (name: string, correct: boolean, linesShown: number): RoundRecord => {
  const total = drink(name).clues.length;
  return { drink: name, correct, linesShown, totalLines: total, points: correct ? pointsFor(total, linesShown) : 0, housePoints: 0 };
};
const run = (difficulty: SpecsRun["difficulty"], rounds: RoundRecord[], playedAt: string, streak = 0): SpecsRun => ({
  ...summariseRun(difficulty, rounds, streak),
  playedAt,
});

test("every drink has its clues as a reordering of its spec", () => {
  for (const d of MENU) assert.deepEqual([...d.clues].sort(), [...d.ingredients].sort(), d.name);
});

test("scoring is unchanged: 50 + 50 per hidden line, nothing for a miss", () => {
  const r0 = startRound(drink("Aperol Spritz"), DIFFICULTIES[0]); // 3 lines
  const after1 = revealNext(r0);
  assert.equal(resolveRound(after1, "Aperol Spritz").outcome!.playerPoints, 150);
  assert.equal(resolveRound(r0, "Aperol Spritz").outcome!.playerPoints, 200); // before line 1
  assert.equal(resolveRound(after1, "Cosmopolitan").outcome!.playerPoints, 0);
  assert.equal(resolveRound(after1, null).outcome!.playerPoints, 0); // too slow
});

test("the house only scores once it has locked in, at its own lock-in line", () => {
  let r = { ...startRound(drink("Aperol Spritz"), DIFFICULTIES[2]), houseLockIn: 2, houseCorrect: true };
  r = revealNext(r);
  assert.equal(resolveRound(r, null).outcome!.houseScored, false); // only 1 line out
  r = revealNext(r);
  const o = resolveRound(r, null).outcome!;
  assert.equal(o.houseScored, true);
  assert.equal(o.housePoints, 100); // 3 lines, locked on 2
});

test("summary totals, fastest call and correct count", () => {
  const s = summariseRun("barback", [rec("Aperol Spritz", true, 2), rec("Cosmopolitan", false, 4), rec("Gin Tiki", true, 1)], 1);
  assert.equal(s.correct, 2);
  assert.equal(s.fastestLines, 1);
  assert.equal(s.playerScore, pointsFor(3, 2) + pointsFor(drink("Gin Tiki").clues.length, 1));
});

test("bests are per opponent; a new best must beat the old one", () => {
  const a = run("barback", [rec("Aperol Spritz", true, 1)], "2026-10-01T20:00:00Z", 1); // 150
  const b = run("barback", [rec("Aperol Spritz", true, 2)], "2026-10-02T20:00:00Z", 1); // 100
  const c = run("mixologist", [rec("Aperol Spritz", false, 3)], "2026-10-03T20:00:00Z");
  const bests = bestsFor([a, b, c], "barback");
  assert.equal(bests.bestScore, 150);
  assert.equal(bests.bestScoreAt, a.playedAt);
  assert.equal(bests.played, 2);
  assert.equal(isNewBest(b, [a]).isBest, false);
  assert.equal(isNewBest(a, [b]).isBest, true);
  assert.equal(isNewBest(a, []).isBest, true); // first game counts
  assert.equal(isNewBest(c, []).isBest, false); // a zero is never a "best"
  assert.equal(bestsFor([a], "bartender").bestScore, null);
});

test("specs to study: misses first, line-1 calls never listed", () => {
  const runs = [
    run("barback", [rec("Chambord Royale", true, 1), rec("Cosmopolitan", false, 4), rec("Gin Tiki", true, drink("Gin Tiki").clues.length)], "2026-10-01T20:00:00Z"),
  ];
  const study = specsToStudy(runs).map((s) => s.drink.name);
  assert.deepEqual(study, ["Cosmopolitan", "Gin Tiki"]);
});

console.log(`ALL ${passed} SPECS TESTS PASSED`);
