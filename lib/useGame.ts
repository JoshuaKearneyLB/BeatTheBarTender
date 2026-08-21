"use client";

// Game state entry point. One API, two engines:
//  - Demo Mode (no Supabase env vars): local reducer with seeded players.
//  - Live mode: Supabase Auth (anonymous) + server-authoritative RPCs, with
//    optimistic local moves and Realtime reconciliation across devices.

import { isDemoMode } from "./supabase/client";
import type { ActionDef, BoardEvent, Game, LoggedAction, Player } from "./types";
import { useDemoGame } from "./useDemoGame";
import { useLiveGame } from "./useLiveGame";

export interface GameApi {
  mode: "demo" | "connecting" | "live" | "error";
  /** Fatal connection/setup problem (live mode only). */
  error: string | null;
  /** Null while connecting or on error (live mode). */
  game: Game | null;
  log: LoggedAction[];
  events: BoardEvent[];
  actions: ActionDef[];
  /** The player belonging to this device/session; null until joined (live). */
  me: Player | null;
  join: (name: string, token: string) => Promise<void>;
  tally: (action: ActionDef, receipt?: File) => void;
  undo: () => void;
  override: (playerId: string, delta: number, reason: string, pin?: string) => void;
  approve: (playerId: string, pin?: string) => void;
  /** Resolve a viewable URL for a log entry's receipt (signed URL in live mode). */
  receiptUrl: (entry: LoggedAction) => Promise<string | null>;
}

export function useGame(gameId: string): GameApi {
  // Both hooks are called unconditionally (rules of hooks); the inactive one
  // is inert. Which one is active is fixed for the process lifetime because
  // it depends only on build-time env vars.
  const demoApi = useDemoGame(gameId);
  const liveApi = useLiveGame(gameId, !isDemoMode());
  return isDemoMode() ? demoApi : liveApi;
}
