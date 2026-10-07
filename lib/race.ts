// Pure race rules, shared by Demo Mode and the optimistic live client.
// Mirrored authoritatively in supabase/migrations/0001_drink_race.sql
// (_settle_race) — keep the two in step.

import type { Race, RaceEvent, Racer } from "./types";

/** Clamp a count to the track: never below 0, never past the finish. */
export function clampCount(count: number, target: number): number {
  return Math.max(0, Math.min(count, target));
}

/**
 * Re-derive finish times and the winner after any count change. A racer at
 * the target keeps their original finish time (or gets `now`); dropping
 * below it clears it. The earliest finisher wins, and the race is over
 * while anyone holds the finish.
 */
export function settle(race: Race, now = new Date().toISOString()): Race {
  const racers = race.racers.map((r): Racer => {
    if (r.count >= race.target) return r.finishedAt ? r : { ...r, finishedAt: now };
    return r.finishedAt ? { ...r, finishedAt: undefined } : r;
  });
  const winner = racers
    .filter((r) => r.finishedAt)
    .sort((a, b) => a.finishedAt!.localeCompare(b.finishedAt!))[0];
  return {
    ...race,
    racers,
    winnerId: winner?.id,
    status: winner ? "finished" : "active",
  };
}

/** Racers ordered for the leaderboard: winner first, then by count. */
export function standings(race: Race): Racer[] {
  return [...race.racers].sort((a, b) => {
    if (a.id === race.winnerId) return -1;
    if (b.id === race.winnerId) return 1;
    return b.count - a.count || a.name.localeCompare(b.name);
  });
}

/** Sum of every drink rung in across the crew. */
export function totalSold(race: Race): number {
  return race.racers.reduce((sum, r) => sum + r.count, 0);
}

// ---------- ticker lines ----------

/** Ticker line for a racer's count changing. */
export function describeCount(
  race: Race,
  name: string,
  racerId: string,
  from: number,
  to: number,
  byManager = false,
): RaceEvent {
  if (byManager) {
    return {
      racerId,
      kind: "correction",
      message: `Till check: ${name} ${from} → ${to}`,
    };
  }
  return to > from
    ? { racerId, kind: "sale", message: `${name} rang one in · ${to}/${race.target}` }
    : { racerId, kind: "undo", message: `${name} took one back · ${to}/${race.target}` };
}

export function winEvent(race: Race): RaceEvent | null {
  const winner = race.racers.find((r) => r.id === race.winnerId);
  return winner
    ? { racerId: winner.id, kind: "win", message: `*** ${winner.name} sold ${race.target} — race over ***` }
    : null;
}

let eventSeq = 0;

export function pushEvents(events: RaceEvent[], incoming: (RaceEvent | null)[]): RaceEvent[] {
  const fresh = incoming
    .filter((e): e is RaceEvent => e !== null)
    .map((e) => ({ ...e, id: ++eventSeq }));
  return fresh.length ? [...fresh, ...events].slice(0, 30) : events;
}
