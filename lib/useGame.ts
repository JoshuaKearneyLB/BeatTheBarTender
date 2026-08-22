"use client";

// Game state entry point. One API, two engines:
//  - Demo Mode (no Supabase env vars): local reducer with seeded players.
//  - Live mode: Supabase Auth (anonymous) + server-authoritative RPCs, with
//    optimistic local moves and Realtime reconciliation across devices.

import { isDemoMode } from "./supabase/client";
import type {
  BoardEvent,
  EventCard,
  Game,
  Player,
  Prize,
  QuestSubmission,
  TilePatch,
} from "./types";
import { useDemoGame } from "./useDemoGame";
import { useLiveGame } from "./useLiveGame";

export interface GameApi {
  mode: "demo" | "connecting" | "live" | "error";
  /** Fatal connection/setup problem (live mode only). */
  error: string | null;
  /** Null while connecting or on error (live mode). */
  game: Game | null;
  /** Quest submissions, newest first (the manager review queue + history). */
  submissions: QuestSubmission[];
  events: BoardEvent[];
  /** The player belonging to this device/session; null until joined (live). */
  me: Player | null;
  join: (name: string, token: string) => Promise<void>;
  /** Nudge my progress counter toward the current tile's goal (±delta). */
  bumpProgress: (delta: number) => void;
  /** Submit the current quest for verification, with an optional photo/note. */
  submitQuest: (opts?: { photo?: File; note?: string }) => void;
  /** Manager: batch approve/reject pending submissions (PIN in live mode). */
  review: (submissionIds: string[], approve: boolean, pin?: string) => void;
  override: (playerId: string, delta: number, reason: string, pin?: string) => void;
  /** Resolve a viewable URL for a submission's photo (signed URL in live mode). */
  photoUrl: (submission: QuestSubmission) => Promise<string | null>;
  /** Manager: edit one tile in place; only the keys in the patch change. */
  updateTile: (position: number, patch: TilePatch, pin?: string) => void;
  /** Manager: swap the whole board (and its deck) for a template. */
  applyTemplate: (templateKey: string, pin?: string) => void;
  /** Manager: add or edit an event card. */
  saveCard: (card: Partial<EventCard> & { name: string }, pin?: string) => void;
  /** Manager: remove an event card. */
  deleteCard: (cardId: string, pin?: string) => void;
  /** Manager: set what the crew are playing for. */
  updatePrize: (prize: Prize & { campaignDays?: number }, pin?: string) => void;
}

export function useGame(gameId: string): GameApi {
  // Both hooks are called unconditionally (rules of hooks); the inactive one
  // is inert. Which one is active is fixed for the process lifetime because
  // it depends only on build-time env vars.
  const demoApi = useDemoGame(gameId);
  const liveApi = useLiveGame(gameId, !isDemoMode());
  return isDemoMode() ? demoApi : liveApi;
}
