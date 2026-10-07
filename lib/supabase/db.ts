// Row types, mappers, and data access for live (Supabase) mode. All writes
// go through the RPCs in supabase/migrations/0001_drink_race.sql — the
// database is the referee.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Race, RaceStatus, Racer } from "@/lib/types";
import { ensureSignedIn } from "./auth";
import { getSupabaseBrowser } from "./client";

// ---------- row shapes (as returned by supabase-js) ----------

export interface RaceRow {
  id: string;
  code: string;
  name: string;
  drink_name: string;
  target: number;
  prize_title: string;
  prize_description: string | null;
  prize_badge: string;
  status: RaceStatus;
  winner_racer_id: string | null;
}

export interface RacerRow {
  id: string;
  race_id: string;
  profile_id: string;
  display_name: string;
  token: string;
  count: number;
  finished_at: string | null;
}

// ---------- mappers ----------

export function rowToRacer(r: RacerRow): Racer {
  return {
    id: r.id,
    profileId: r.profile_id,
    name: r.display_name,
    token: r.token,
    count: r.count,
    finishedAt: r.finished_at ?? undefined,
  };
}

export function applyRaceRow(race: Race, r: RaceRow): Race {
  return {
    ...race,
    code: r.code,
    name: r.name,
    drinkName: r.drink_name,
    target: r.target,
    prize: {
      title: r.prize_title,
      description: r.prize_description ?? undefined,
      badge: r.prize_badge,
    },
    status: r.status,
    winnerId: r.winner_racer_id ?? undefined,
  };
}

// ---------- reads ----------

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function fetchRace(supabase: SupabaseClient, raceId: string): Promise<Race> {
  if (!UUID.test(raceId)) throw new Error("There's no race at this link. Ask your manager for the code.");
  const [raceRes, racersRes] = await Promise.all([
    supabase.from("races").select("*").eq("id", raceId).single(),
    supabase.from("racers").select("*").eq("race_id", raceId).order("joined_at"),
  ]);
  if (raceRes.error?.code === "PGRST116") {
    throw new Error("There's no race at this link. Ask your manager for the code.");
  }
  const firstError = raceRes.error ?? racersRes.error;
  if (firstError) throw new Error(`Couldn't load the race: ${firstError.message}`);

  const empty: Race = {
    id: raceId,
    name: "",
    drinkName: "",
    target: 1,
    prize: { title: "", badge: "trophy" },
    status: "active",
    racers: [],
  };
  return {
    ...applyRaceRow(empty, raceRes.data as RaceRow),
    racers: (racersRes.data as RacerRow[]).map(rowToRacer),
  };
}

// ---------- RPC wrappers ----------

async function rpc<T>(supabase: SupabaseClient, fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export async function createRaceLive(opts: {
  name: string;
  drinkName: string;
  target: number;
  prizeTitle: string;
  prizeDescription?: string;
  prizeBadge: string;
  pin: string;
}): Promise<string> {
  const supabase = getSupabaseBrowser();
  if (!supabase) throw new Error("Supabase is not configured (Demo Mode)");
  await ensureSignedIn(supabase);
  return rpc<string>(supabase, "create_race", {
    p_name: opts.name,
    p_drink_name: opts.drinkName,
    p_target: opts.target,
    p_prize_title: opts.prizeTitle,
    p_prize_description: opts.prizeDescription ?? null,
    p_prize_badge: opts.prizeBadge,
    p_pin: opts.pin || null,
  });
}

/** Resolve a typed race code to its id, or null if there's no such race. */
export async function raceIdForCode(code: string): Promise<string | null> {
  const supabase = getSupabaseBrowser();
  if (!supabase) throw new Error("Supabase is not configured");
  await ensureSignedIn(supabase);
  return rpc<string | null>(supabase, "race_id_for_code", { p_code: code });
}

export const joinRace = (supabase: SupabaseClient, raceId: string, name: string, token: string) =>
  rpc<RacerRow>(supabase, "join_race", {
    p_race_id: raceId,
    p_display_name: name,
    p_token: token,
  });

export const ringIn = (supabase: SupabaseClient, racerId: string, delta: 1 | -1) =>
  rpc<RacerRow>(supabase, "ring_in", { p_racer_id: racerId, p_delta: delta });

export const adjustCount = (
  supabase: SupabaseClient,
  raceId: string,
  racerId: string,
  count: number,
  pin: string,
) =>
  rpc<RacerRow>(supabase, "adjust_count", {
    p_race_id: raceId,
    p_racer_id: racerId,
    p_count: count,
    p_pin: pin || null,
  });
