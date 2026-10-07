"use client";

// Demo Mode engine: a seeded Friday-night race on local state. You are
// always the first racer; the rest of the crew ring drinks in on their own
// every few seconds, so a venue can feel the race without anyone else
// holding a phone.

import { useCallback, useEffect, useReducer } from "react";
import { clampCount, describeCount, pushEvents, settle, winEvent } from "./race";
import type { DemoSetup } from "./demoSetup";
import type { Race, RaceEvent } from "./types";
import type { RaceApi } from "./useRace";

const RIVAL_TICK_MS = 6500;

interface State {
  race: Race;
  events: RaceEvent[];
}

function seedState({ id, setup }: { id: string; setup: DemoSetup }): State {
  const target = setup.target ?? 20;
  // The crew start part-way up the track, scaled to the target.
  const head = (share: number) => Math.min(target - 2, Math.round(target * share));
  return {
    race: {
      id,
      name: setup.name ?? "Friday Night Race",
      drinkName: setup.drinkName ?? "Hacien Pineapple Spritz",
      target,
      prize: {
        title: setup.prizeTitle ?? "£50 bar tab",
        description: `First to ring in ${target} takes it. Counts get checked against the till at close.`,
        badge: setup.badge ?? "cash",
      },
      status: "active",
      racers: [
        { id: "p1", name: "You", token: "martini", count: 0 },
        { id: "p2", name: "Marco", token: "flame", count: head(0.35) },
        { id: "p3", name: "Dee", token: "lime", count: head(0.2) },
        { id: "p4", name: "Sam", token: "pint", count: head(0.1) },
      ],
    },
    events: [],
  };
}

type Action =
  | { type: "COUNT"; racerId: string; delta: number }
  | { type: "ADJUST"; racerId: string; count: number };

function reducer(state: State, action: Action): State {
  const { race } = state;
  const racer = race.racers.find((r) => r.id === action.racerId);
  if (!racer) return state;

  const byManager = action.type === "ADJUST";
  if (!byManager && race.status !== "active") return state;
  const count = clampCount(
    byManager ? action.count : racer.count + action.delta,
    race.target,
  );
  if (count === racer.count) return state;

  const next = settle({
    ...race,
    racers: race.racers.map((r) => (r.id === racer.id ? { ...r, count } : r)),
  });
  return {
    race: next,
    events: pushEvents(state.events, [
      next.winnerId && next.winnerId !== race.winnerId ? winEvent(next) : null,
      describeCount(next, racer.name, racer.id, racer.count, count, byManager),
    ]),
  };
}

export function useDemoRace(raceId: string, enabled: boolean, setup: DemoSetup = {}): RaceApi {
  const [state, dispatch] = useReducer(reducer, { id: raceId, setup }, seedState);

  // The rest of the crew keep pouring while the race is open.
  const open = state.race.status === "active";
  useEffect(() => {
    if (!enabled || !open) return;
    const timer = setInterval(() => {
      if (Math.random() < 0.4) return; // a quiet moment at the bar
      const rivals = ["p2", "p3", "p4"];
      const racerId = rivals[Math.floor(Math.random() * rivals.length)];
      dispatch({ type: "COUNT", racerId, delta: 1 });
    }, RIVAL_TICK_MS);
    return () => clearInterval(timer);
  }, [enabled, open]);

  const ringIn = useCallback(
    (delta: 1 | -1) => dispatch({ type: "COUNT", racerId: "p1", delta }),
    [],
  );
  const adjust = useCallback(
    (racerId: string, count: number) => dispatch({ type: "ADJUST", racerId, count }),
    [],
  );
  const join = useCallback(async () => {}, []);

  return {
    mode: "demo",
    error: null,
    race: state.race,
    events: state.events,
    me: state.race.racers[0],
    join,
    ringIn,
    adjust,
  };
}
