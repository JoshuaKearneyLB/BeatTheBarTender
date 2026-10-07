"use client";

// Live engine: Supabase Auth (anonymous) + server-authoritative RPCs. Taps
// apply optimistically with the same race rules the server runs, then
// reconcile against the row the RPC returns; Realtime delivers every other
// device's changes as row patches.

import { useCallback, useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { clampCount, describeCount, pushEvents, settle, winEvent } from "./race";
import { ensureSignedIn } from "./supabase/auth";
import { getSupabaseBrowser } from "./supabase/client";
import {
  adjustCount,
  applyRaceRow,
  fetchRace,
  joinRace,
  ringIn as rpcRingIn,
  rowToRacer,
  type RaceRow,
  type RacerRow,
} from "./supabase/db";
import { subscribeToRace } from "./supabase/realtime";
import type { Race, RaceEvent } from "./types";
import type { RaceApi } from "./useRace";

interface LiveState {
  status: "connecting" | "live" | "error";
  error: string | null;
  userId: string | null;
  race: Race | null;
  events: RaceEvent[];
}

const INITIAL: LiveState = {
  status: "connecting",
  error: null,
  userId: null,
  race: null,
  events: [],
};

/**
 * Merge an authoritative racer row into state, deriving ticker lines.
 * `holdId` names a racer with taps still in flight: their rows are stale
 * the moment they land, so we keep the optimistic count until the last
 * tap settles (otherwise fast tapping makes the number jump backwards).
 */
function patchRacer(state: LiveState, row: RacerRow, holdId?: string): LiveState {
  if (!state.race) return state;
  if (holdId && row.id === holdId) return state;
  const next = rowToRacer(row);
  const idx = state.race.racers.findIndex((r) => r.id === next.id);
  const prev = idx === -1 ? undefined : state.race.racers[idx];
  if (
    prev &&
    prev.count === next.count &&
    prev.finishedAt === next.finishedAt &&
    prev.name === next.name &&
    prev.token === next.token
  ) {
    return state; // echo of a change we already applied optimistically
  }
  const racers = prev ? state.race.racers.with(idx, next) : [...state.race.racers, next];
  const race = { ...state.race, racers };
  const line: RaceEvent | null = !prev
    ? { racerId: next.id, kind: "join", message: `${next.name} is in the race` }
    : prev.count !== next.count
      ? describeCount(race, next.name, next.id, prev.count, next.count)
      : null;
  return { ...state, race, events: pushEvents(state.events, [line]) };
}

function patchRace(state: LiveState, row: RaceRow): LiveState {
  if (!state.race) return state;
  const race = applyRaceRow(state.race, row);
  const won = race.winnerId && race.winnerId !== state.race.winnerId;
  return { ...state, race, events: won ? pushEvents(state.events, [winEvent(race)]) : state.events };
}

export function useLiveRace(raceId: string, enabled: boolean): RaceApi {
  const [state, setState] = useState<LiveState>(INITIAL);
  const supabaseRef = useRef<SupabaseClient | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  /** My taps sent but not yet answered. */
  const inFlightRef = useRef(0);
  const myIdRef = useRef<string | undefined>(undefined);
  const hold = () => (inFlightRef.current > 0 ? myIdRef.current : undefined);

  const warn = useCallback((message: string) => {
    setState((s) => ({
      ...s,
      events: pushEvents(s.events, [{ racerId: "", kind: "undo", message: `!! ${message}` }]),
    }));
  }, []);

  const resync = useCallback(async () => {
    const supabase = supabaseRef.current;
    if (!supabase) return;
    try {
      const race = await fetchRace(supabase, raceId);
      setState((s) => ({ ...s, race }));
    } catch {
      // transient; the next realtime change or tap retries
    }
  }, [raceId]);

  useEffect(() => {
    if (!enabled) return;
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      const supabase = getSupabaseBrowser();
      if (!supabase) throw new Error("Supabase is not configured");
      supabaseRef.current = supabase;
      const userId = await ensureSignedIn(supabase);
      const race = await fetchRace(supabase, raceId);
      if (cancelled) return;
      setState({ status: "live", error: null, userId, race, events: [] });
      unsubscribe = subscribeToRace(
        supabase,
        raceId,
        (change) => {
          if (!change.new) return;
          setState((s) =>
            change.table === "racers"
              ? patchRacer(s, change.new as unknown as RacerRow, hold())
              : patchRace(s, change.new as unknown as RaceRow),
          );
        },
        // Catch up on anything that happened while the feed wasn't listening.
        () => {
          if (inFlightRef.current === 0) void resync();
        },
      );
    })().catch((err: Error) => {
      if (!cancelled) setState((s) => ({ ...s, status: "error", error: err.message }));
    });

    // Phones sleep mid-shift; coming back, the board may be minutes stale.
    const onVisible = () => {
      if (document.visibilityState === "visible" && inFlightRef.current === 0) void resync();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      unsubscribe?.();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [raceId, enabled, resync]);

  const me = state.race?.racers.find((r) => r.profileId === state.userId) ?? null;
  myIdRef.current = me?.id;

  const join = useCallback(
    async (name: string, token: string) => {
      const supabase = supabaseRef.current;
      if (!supabase) return;
      try {
        const row = await joinRace(supabase, raceId, name, token);
        setState((s) => patchRacer(s, row));
      } catch (err) {
        warn((err as Error).message);
        throw err;
      }
    },
    [raceId, warn],
  );

  const ringIn = useCallback(
    (delta: 1 | -1) => {
      const supabase = supabaseRef.current;
      const s = stateRef.current;
      const current = s.race?.racers.find((r) => r.profileId === s.userId);
      if (!supabase || !s.race || !current || s.race.status !== "active") return;
      const count = clampCount(current.count + delta, s.race.target);
      if (count === current.count) return;

      // Optimistic; the returned row reconciles, realtime informs others.
      setState((prev) =>
        prev.race
          ? {
              ...prev,
              race: settle({
                ...prev.race,
                racers: prev.race.racers.map((r) => (r.id === current.id ? { ...r, count } : r)),
              }),
              events: pushEvents(prev.events, [
                describeCount(prev.race, current.name, current.id, current.count, count),
              ]),
            }
          : prev,
      );
      inFlightRef.current += 1;
      rpcRingIn(supabase, current.id, delta)
        .then((row) => {
          inFlightRef.current -= 1;
          // Only the last answer is current; earlier ones are already stale.
          if (inFlightRef.current === 0) setState((prev) => patchRacer(prev, row));
        })
        .catch((err: Error) => {
          inFlightRef.current -= 1;
          warn(`Didn't ring in: ${err.message}`);
          if (inFlightRef.current === 0) void resync();
        });
    },
    [resync, warn],
  );

  const adjust = useCallback(
    (racerId: string, count: number, pin?: string) => {
      const supabase = supabaseRef.current;
      if (!supabase) return;
      adjustCount(supabase, raceId, racerId, count, pin ?? "")
        .then(() => resync()) // a correction can move the win
        .catch((err: Error) => warn(`Correction failed: ${err.message}`));
    },
    [raceId, resync, warn],
  );

  return {
    mode: state.status === "live" ? "live" : state.status,
    error: state.error,
    race: state.race,
    events: state.events,
    me,
    join,
    ringIn,
    adjust,
  };
}
