"use client";

// Race state entry point. One API, two engines:
//  - Demo (the "demo" race, or any race when Supabase isn't configured): local state with a seeded crew whose
//    rivals keep ringing drinks in, so the race feels live with zero setup.
//  - Live mode: Supabase Auth (anonymous) + server-authoritative RPCs, with
//    optimistic taps and Realtime reconciliation across devices.

import type { DemoSetup } from "./demoSetup";
import { isDemoRace } from "./supabase/client";
import type { Race, RaceEvent, Racer } from "./types";
import { useDemoRace } from "./useDemoRace";
import { useLiveRace } from "./useLiveRace";

export interface RaceApi {
  mode: "demo" | "connecting" | "live" | "error";
  /** Fatal connection/setup problem (live mode only). */
  error: string | null;
  /** Null while connecting or on error (live mode). */
  race: Race | null;
  /** Newest first. */
  events: RaceEvent[];
  /** The racer belonging to this device; null until joined (live). */
  me: Racer | null;
  join: (name: string, token: string) => Promise<void>;
  /** +1 for a sale, -1 to undo a mis-tap. */
  ringIn: (delta: 1 | -1) => void;
  /** Manager: set a racer's count to what the till says (PIN in live mode). */
  adjust: (racerId: string, count: number, pin?: string) => void;
}

export function useRace(raceId: string, demoSetup?: DemoSetup): RaceApi {
  // Both hooks are called unconditionally (rules of hooks); the inactive one
  // is inert. The race id decides: "demo" is always local.
  const demo = isDemoRace(raceId);
  const demoApi = useDemoRace(raceId, demo, demoSetup);
  const liveApi = useLiveRace(raceId, !demo);
  return demo ? demoApi : liveApi;
}
