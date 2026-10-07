// Where specs-test games are kept.
//
// Live (Supabase configured): every finished game goes to specs_runs through
// record_specs_run, tied to the phone's anonymous sign-in. A game finished
// offline waits in a local queue and is sent the next time we can.
// Demo (no Supabase): games live on the phone itself.

"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { DifficultyKey, RoundRecord, SpecsRun } from "./specs";
import { ensureSignedIn } from "./supabase/auth";
import { getSupabaseBrowser, isLiveConfigured } from "./supabase/client";

const LOCAL_KEY = "baropoly.specs-runs";
const PENDING_KEY = "baropoly.specs-pending";
const LOCAL_LIMIT = 300;

interface SpecsRunRow {
  id: string;
  display_name: string | null;
  difficulty: DifficultyKey;
  player_score: number;
  house_score: number;
  best_streak: number;
  correct: number;
  fastest_lines: number | null;
  rounds: RoundRecord[];
  played_at: string;
}

function rowToRun(r: SpecsRunRow): SpecsRun {
  return {
    id: r.id,
    displayName: r.display_name ?? undefined,
    difficulty: r.difficulty,
    playerScore: r.player_score,
    houseScore: r.house_score,
    bestStreak: r.best_streak,
    correct: r.correct,
    fastestLines: r.fastest_lines,
    rounds: r.rounds,
    playedAt: r.played_at,
  };
}

function readList(key: string): SpecsRun[] {
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function writeList(key: string, runs: SpecsRun[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(runs.slice(0, LOCAL_LIMIT)));
  } catch {
    // storage full or blocked
  }
}

async function send(supabase: SupabaseClient, run: SpecsRun): Promise<SpecsRun> {
  const { data, error } = await supabase.rpc("record_specs_run", {
    p_display_name: run.displayName ?? null,
    p_difficulty: run.difficulty,
    p_best_streak: run.bestStreak,
    p_rounds: run.rounds,
  });
  if (error) throw new Error(error.message);
  return rowToRun(data as SpecsRunRow);
}

/** Send anything finished while offline. Quietly gives up for now on failure. */
async function flushPending(supabase: SupabaseClient): Promise<void> {
  const pending = readList(PENDING_KEY);
  if (!pending.length) return;
  const left: SpecsRun[] = [];
  for (const run of pending) {
    try {
      await send(supabase, run);
    } catch (err) {
      // A run the server refuses will never go through; drop it. Keep the rest.
      if (!/does not add up|malformed|exactly 10|check constraint/i.test((err as Error).message)) {
        left.push(run);
      }
    }
  }
  writeList(PENDING_KEY, left);
}

export type SaveResult = { where: "cloud" | "phone"; run: SpecsRun; error?: string };

export async function saveRun(run: SpecsRun): Promise<SaveResult> {
  const supabase = isLiveConfigured() ? getSupabaseBrowser() : null;
  if (!supabase) {
    writeList(LOCAL_KEY, [run, ...readList(LOCAL_KEY)]);
    return { where: "phone", run };
  }
  try {
    await ensureSignedIn(supabase);
    await flushPending(supabase);
    return { where: "cloud", run: await send(supabase, run) };
  } catch (err) {
    writeList(PENDING_KEY, [run, ...readList(PENDING_KEY)]);
    return { where: "phone", run, error: (err as Error).message };
  }
}

/** Every game this phone has played, newest first (unsent ones included). */
export async function loadRuns(): Promise<SpecsRun[]> {
  const supabase = isLiveConfigured() ? getSupabaseBrowser() : null;
  if (!supabase) return readList(LOCAL_KEY);
  await ensureSignedIn(supabase);
  await flushPending(supabase);
  const { data, error } = await supabase
    .from("specs_runs")
    .select("*")
    .order("played_at", { ascending: false })
    .limit(500);
  if (error) throw new Error(`Couldn't load your games: ${error.message}`);
  const pending = readList(PENDING_KEY);
  return [...pending, ...(data as SpecsRunRow[]).map(rowToRun)];
}
