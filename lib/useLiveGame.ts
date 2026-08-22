"use client";

// Live engine: Supabase Auth (anonymous) + server-authoritative RPCs.
// Progress bumps and quest submissions are applied optimistically with the
// same pure board engine the server runs, then reconciled against the
// authoritative rows the RPCs return; Realtime delivers every other
// device's changes as row patches.

import { useCallback, useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { generateCampaignBoard, templateDeck } from "./board";
import { ensureSignedIn } from "./supabase/auth";
import { getSupabaseBrowser } from "./supabase/client";
import {
  fetchGame,
  joinGame,
  managerOverride,
  reviewSubmissions,
  rowToPlayer,
  rowToSubmission,
  signedReceiptUrl,
  submitQuest as rpcSubmitQuest,
  updateProgress,
  updateTile as rpcUpdateTile,
  applyBoardTemplate,
  replaceEventDeck,
  upsertEventCard,
  deleteEventCard as rpcDeleteEventCard,
  updatePrize as rpcUpdatePrize,
  uploadReceipt,
  type GameRow,
  type PlayerRow,
  type SubmissionRow,
} from "./supabase/db";
import { subscribeToGame, type GameChange } from "./supabase/realtime";
import type {
  BoardEvent,
  EventCard,
  Game,
  Player,
  Prize,
  QuestSubmission,
  TilePatch,
} from "./types";
import type { GameApi } from "./useGame";

interface LiveState {
  status: "connecting" | "live" | "error";
  error: string | null;
  userId: string | null;
  game: Game | null;
  submissions: QuestSubmission[];
  events: BoardEvent[];
}

const INITIAL: LiveState = {
  status: "connecting",
  error: null,
  userId: null,
  game: null,
  submissions: [],
  events: [],
};

function pushEvents(events: BoardEvent[], incoming: BoardEvent[]): BoardEvent[] {
  return incoming.length ? [...incoming, ...events].slice(0, 30) : events;
}

/** Diff an incoming player row against local state and describe what changed. */
function diffPlayerEvents(prev: Player | undefined, next: Player, game: Game): BoardEvent[] {
  const events: BoardEvent[] = [];
  if (!prev) {
    events.push({ playerId: next.id, kind: "join", message: `${next.name} clocked in` });
    return events;
  }
  if (next.position !== prev.position) {
    const tile = game.tiles[next.position];
    events.push({
      playerId: next.id,
      kind: next.position > prev.position ? "advance" : "setback",
      message:
        next.position > prev.position
          ? `${next.name} moves up to “${tile?.name ?? `tile ${next.position + 1}`}”`
          : `${next.name} knocked back to tile ${next.position + 1}`,
    });
  }
  if (next.awaitingApproval && !prev.awaitingApproval) {
    events.push({
      playerId: next.id,
      kind: "checkpoint",
      message: `${next.name} is waiting on manager sign-off`,
    });
  }
  if (next.finished && !prev.finished) {
    events.push({
      playerId: next.id,
      kind: "win",
      message: `🏆 ${next.name} rang Last Call. Drinks are on them.`,
    });
  }
  return events;
}

/** Merge an authoritative player row into state, deriving ticker events. */
function patchPlayer(state: LiveState, row: PlayerRow): LiveState {
  if (!state.game) return state;
  const next = rowToPlayer(row);
  const idx = state.game.players.findIndex((p) => p.id === next.id);
  const prev = idx === -1 ? undefined : state.game.players[idx];
  if (
    prev &&
    prev.position === next.position &&
    prev.progress === next.progress &&
    prev.awaitingApproval === next.awaitingApproval &&
    prev.finished === next.finished
  ) {
    return state; // echo of a change we already applied optimistically
  }
  const players = prev
    ? state.game.players.with(idx, next)
    : [...state.game.players, next];
  return {
    ...state,
    game: { ...state.game, players },
    events: pushEvents(state.events, diffPlayerEvents(prev, next, state.game)),
  };
}

function patchSubmission(state: LiveState, row: SubmissionRow): LiveState {
  const entry = rowToSubmission(row);
  const existing = state.submissions.find((s) => s.id === entry.id);
  return {
    ...state,
    submissions: existing
      ? state.submissions.map((s) => (s.id === entry.id ? entry : s))
      : [entry, ...state.submissions].slice(0, 200),
  };
}

function patchGame(state: LiveState, row: GameRow): LiveState {
  if (!state.game) return state;
  return {
    ...state,
    game: {
      ...state.game,
      status: row.status,
      autoApprove: row.auto_approve,
      prize: {
        title: row.prize_title,
        description: row.prize_description ?? undefined,
        badge: row.prize_badge,
      },
      campaignDays: row.campaign_days,
      winnerId: row.winner_player_id ?? undefined,
    },
  };
}

export function useLiveGame(gameId: string, enabled: boolean): GameApi {
  const [state, setState] = useState<LiveState>(INITIAL);
  const supabaseRef = useRef<SupabaseClient | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  const warn = useCallback((message: string) => {
    setState((s) => ({
      ...s,
      events: pushEvents(s.events, [{ playerId: "", kind: "setback", message: `⚠️ ${message}` }]),
    }));
  }, []);

  const resync = useCallback(async () => {
    const supabase = supabaseRef.current;
    if (!supabase) return;
    try {
      const { game, submissions } = await fetchGame(supabase, gameId);
      setState((s) => ({ ...s, game, submissions }));
    } catch {
      // transient; the next realtime change or user action retries
    }
  }, [gameId]);

  useEffect(() => {
    if (!enabled) return;
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      const supabase = getSupabaseBrowser();
      if (!supabase) throw new Error("Supabase is not configured");
      supabaseRef.current = supabase;
      const userId = await ensureSignedIn(supabase);
      const { game, submissions } = await fetchGame(supabase, gameId);
      if (cancelled) return;
      setState({ status: "live", error: null, userId, game, submissions, events: [] });
      unsubscribe = subscribeToGame(supabase, gameId, (change: GameChange) => {
        if (!change.new) return;
        setState((s) => {
          switch (change.table) {
            case "game_players":
              return patchPlayer(s, change.new as unknown as PlayerRow);
            case "quest_submissions":
              return patchSubmission(s, change.new as unknown as SubmissionRow);
            case "games":
              return patchGame(s, change.new as unknown as GameRow);
            case "game_tiles":
            case "event_cards":
              // Board edits are rare and cross-cutting; refetch rather than
              // reconcile tile-by-tile.
              void resync();
              return s;
          }
        });
      });
    })().catch((err: Error) => {
      if (!cancelled) setState((s) => ({ ...s, status: "error", error: err.message }));
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [gameId, enabled, resync]);

  const findMe = useCallback((s: LiveState) => {
    return s.game?.players.find((p) => p.profileId === s.userId) ?? null;
  }, []);

  const me = findMe(state);

  const join = useCallback(
    async (name: string, token: string) => {
      const supabase = supabaseRef.current;
      if (!supabase) return;
      try {
        const row = await joinGame(supabase, gameId, name, token);
        setState((s) => patchPlayer(s, row));
      } catch (err) {
        warn((err as Error).message);
        throw err;
      }
    },
    [gameId, warn],
  );

  const bumpProgress = useCallback(
    (delta: number) => {
      const supabase = supabaseRef.current;
      const s = stateRef.current;
      const current = findMe(s);
      if (!supabase || !s.game || !current || current.awaitingApproval || current.finished) return;
      const target = s.game.tiles[current.position]?.goal.target ?? 1;
      const progress = Math.max(0, Math.min(current.progress + delta, Math.max(target * 3, 99)));
      if (progress === current.progress) return;

      // Optimistic; the returned row reconciles, realtime informs others.
      setState((prev) =>
        prev.game
          ? { ...prev, game: { ...prev.game, players: prev.game.players.map((p) => (p.id === current.id ? { ...p, progress } : p)) } }
          : prev,
      );
      updateProgress(supabase, current.id, progress)
        .then((row) => setState((prev) => patchPlayer(prev, row)))
        .catch((err: Error) => {
          warn(`Progress sync failed: ${err.message}`);
          void resync();
        });
    },
    [findMe, resync, warn],
  );

  const submitQuest = useCallback(
    (opts?: { photo?: File; note?: string }) => {
      const supabase = supabaseRef.current;
      const s = stateRef.current;
      const current = findMe(s);
      if (!supabase || !s.game || !current || current.awaitingApproval || current.finished) return;

      // Optimistic lock; if auto-trust applies, the realtime patches move us.
      setState((prev) =>
        prev.game
          ? {
              ...prev,
              game: {
                ...prev.game,
                players: prev.game.players.map((p) =>
                  p.id === current.id ? { ...p, awaitingApproval: true } : p,
                ),
              },
              events: pushEvents(prev.events, [
                {
                  playerId: current.id,
                  kind: "checkpoint",
                  message: `${current.name} sent “${s.game!.tiles[current.position].goal.label}” for sign-off`,
                },
              ]),
            }
          : prev,
      );

      (async () => {
        const path = opts?.photo
          ? await uploadReceipt(supabase, s.game!.id, current.id, opts.photo)
          : undefined;
        const row = await rpcSubmitQuest(supabase, current.id, current.progress, opts?.note, path);
        setState((prev) => patchSubmission(prev, row));
        void resync(); // auto-trust may have moved the player already
      })().catch((err: Error) => {
        warn(`Submission failed: ${err.message}`);
        void resync();
      });
    },
    [findMe, resync, warn],
  );

  const review = useCallback(
    (submissionIds: string[], approve: boolean, pin?: string) => {
      const supabase = supabaseRef.current;
      if (!supabase || submissionIds.length === 0) return;
      reviewSubmissions(supabase, gameId, submissionIds, approve, undefined, pin ?? "")
        .then(() => resync())
        .catch((err: Error) => warn(`Review failed: ${err.message}`));
    },
    [gameId, resync, warn],
  );

  const override = useCallback(
    (playerId: string, delta: number, reason: string, pin?: string) => {
      const supabase = supabaseRef.current;
      if (!supabase) return;
      managerOverride(supabase, gameId, playerId, delta, reason, pin ?? "")
        .then((row) => {
          setState((prev) => patchPlayer(prev, row));
          void resync(); // superseded submissions changed too
        })
        .catch((err: Error) => warn(`Override failed: ${err.message}`));
    },
    [gameId, resync, warn],
  );

  const updateTile = useCallback(
    (position: number, patch: TilePatch, pin?: string) => {
      const supabase = supabaseRef.current;
      if (!supabase) return;
      // Optimistic: the editor should feel instant under the manager's thumb.
      setState((prev) =>
        prev.game
          ? {
              ...prev,
              game: {
                ...prev.game,
                tiles: prev.game.tiles.map((t) =>
                  t.position === position
                    ? { ...t, ...patch, goal: { ...t.goal, ...patch.goal } }
                    : t,
                ),
              },
            }
          : prev,
      );
      rpcUpdateTile(supabase, gameId, position, patch, pin ?? "")
        .catch((err: Error) => {
          warn(`Tile edit failed: ${err.message}`);
          void resync();
        });
    },
    [gameId, resync, warn],
  );

  const applyTemplate = useCallback(
    (templateKey: string, pin?: string) => {
      const supabase = supabaseRef.current;
      const s = stateRef.current;
      if (!supabase || !s.game) return;
      const tiles = generateCampaignBoard(
        s.game.boardLength,
        templateKey,
        Math.floor(Math.random() * 2 ** 31),
      );
      (async () => {
        await applyBoardTemplate(supabase, gameId, tiles, templateKey, pin ?? "");
        await replaceEventDeck(supabase, gameId, templateDeck(templateKey), pin ?? "");
        await resync();
      })().catch((err: Error) => {
        warn(`Template failed: ${err.message}`);
        void resync();
      });
    },
    [gameId, resync, warn],
  );

  const saveCard = useCallback(
    (card: Partial<EventCard> & { name: string }, pin?: string) => {
      const supabase = supabaseRef.current;
      if (!supabase) return;
      upsertEventCard(supabase, gameId, card, pin ?? "")
        .then(() => resync())
        .catch((err: Error) => warn(`Card save failed: ${err.message}`));
    },
    [gameId, resync, warn],
  );

  const deleteCard = useCallback(
    (cardId: string, pin?: string) => {
      const supabase = supabaseRef.current;
      if (!supabase) return;
      rpcDeleteEventCard(supabase, gameId, cardId, pin ?? "")
        .then(() => resync())
        .catch((err: Error) => warn(`Card delete failed: ${err.message}`));
    },
    [gameId, resync, warn],
  );

  const updatePrize = useCallback(
    (prize: Prize & { campaignDays?: number }, pin?: string) => {
      const supabase = supabaseRef.current;
      if (!supabase) return;
      setState((prev) =>
        prev.game
          ? {
              ...prev,
              game: {
                ...prev.game,
                prize: { title: prize.title, description: prize.description, badge: prize.badge },
                campaignDays: prize.campaignDays ?? prev.game.campaignDays,
              },
            }
          : prev,
      );
      rpcUpdatePrize(supabase, gameId, prize, pin ?? "").catch((err: Error) => {
        warn(`Prize update failed: ${err.message}`);
        void resync();
      });
    },
    [gameId, resync, warn],
  );

  const photoUrl = useCallback(async (sub: QuestSubmission) => {
    const supabase = supabaseRef.current;
    if (!supabase || !sub.photoPath) return sub.photoUrl ?? null;
    try {
      return await signedReceiptUrl(supabase, sub.photoPath);
    } catch {
      return null;
    }
  }, []);

  return {
    mode: state.status === "live" ? "live" : state.status,
    error: state.error,
    game: state.game,
    submissions: state.submissions,
    events: state.events,
    me,
    join,
    bumpProgress,
    submitQuest,
    review,
    override,
    photoUrl,
    updateTile,
    applyTemplate,
    saveCard,
    deleteCard,
    updatePrize,
  };
}
