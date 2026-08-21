"use client";

// Live engine: Supabase Auth (anonymous) + server-authoritative RPCs.
// Moves are applied optimistically with the same pure board engine the
// server runs, then reconciled against the authoritative row the RPC
// returns; Realtime delivers every other device's changes as row patches.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { applyUnits } from "./board";
import { ensureSignedIn } from "./supabase/auth";
import { getSupabaseBrowser } from "./supabase/client";
import {
  fetchGame,
  joinGame,
  logAction,
  managerApprove,
  managerOverride,
  rowToLog,
  rowToPlayer,
  signedReceiptUrl,
  uploadReceipt,
  voidLastAction,
  type GameRow,
  type LogRow,
  type PlayerRow,
} from "./supabase/db";
import { subscribeToGame, type GameChange } from "./supabase/realtime";
import type { ActionDef, BoardEvent, Game, LoggedAction, Player } from "./types";
import { DEFAULT_ACTIONS } from "./types";
import type { GameApi } from "./useGame";

interface LiveState {
  status: "connecting" | "live" | "error";
  error: string | null;
  userId: string | null;
  game: Game | null;
  log: LoggedAction[];
  events: BoardEvent[];
}

const INITIAL: LiveState = {
  status: "connecting",
  error: null,
  userId: null,
  game: null,
  log: [],
  events: [],
};

function pushEvents(events: BoardEvent[], incoming: BoardEvent[]): BoardEvent[] {
  return incoming.length ? [...incoming, ...events].slice(0, 30) : events;
}

/** Diff an incoming player row against local state and describe what changed. */
function diffPlayerEvents(prev: Player | undefined, next: Player, game: Game): BoardEvent[] {
  const events: BoardEvent[] = [];
  if (!prev) {
    events.push({ playerId: next.id, kind: "join", message: `${next.name} joined the shift` });
    return events;
  }
  if (next.position !== prev.position) {
    const tile = game.tiles[next.position];
    events.push({
      playerId: next.id,
      kind: next.position > prev.position ? "advance" : "setback",
      message:
        next.position > prev.position
          ? `${next.name} advances to “${tile?.title ?? `tile ${next.position + 1}`}”`
          : `${next.name} moves back to tile ${next.position + 1}`,
    });
  }
  if (next.awaitingApproval && !prev.awaitingApproval) {
    const tile = game.tiles[next.position];
    events.push({
      playerId: next.id,
      kind: tile?.type === "finish" ? "win" : "checkpoint",
      message:
        tile?.type === "finish"
          ? `${next.name} reached LAST CALL — awaiting manager approval! 🏆`
          : `${next.name} hit “${tile?.title}” — manager check required`,
    });
  }
  if (next.finished && !prev.finished) {
    events.push({ playerId: next.id, kind: "win", message: `🏆 ${next.name} WINS the shift!` });
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
    ? state.game.players.with(idx, { ...next, tally: prev.tally })
    : [...state.game.players, next];
  return {
    ...state,
    game: { ...state.game, players },
    events: pushEvents(state.events, diffPlayerEvents(prev, next, state.game)),
  };
}

function patchLog(state: LiveState, row: LogRow, eventType: "INSERT" | "UPDATE"): LiveState {
  const entry = rowToLog(row);
  if (eventType === "INSERT") {
    if (state.log.some((l) => l.id === entry.id)) return state;
    return { ...state, log: [entry, ...state.log].slice(0, 500) };
  }
  return { ...state, log: state.log.map((l) => (l.id === entry.id ? entry : l)) };
}

function patchGame(state: LiveState, row: GameRow): LiveState {
  if (!state.game) return state;
  return {
    ...state,
    game: {
      ...state.game,
      status: row.status,
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
      const { game, log } = await fetchGame(supabase, gameId);
      setState((s) => ({ ...s, game, log }));
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
      const { game, log } = await fetchGame(supabase, gameId);
      if (cancelled) return;
      setState({ status: "live", error: null, userId, game, log, events: [] });
      unsubscribe = subscribeToGame(supabase, gameId, (change: GameChange) => {
        if (!change.new) return;
        setState((s) => {
          switch (change.table) {
            case "game_players":
              return patchPlayer(s, change.new as unknown as PlayerRow);
            case "action_logs":
              return change.eventType === "DELETE"
                ? s
                : patchLog(s, change.new as unknown as LogRow, change.eventType);
            case "games":
              return patchGame(s, change.new as unknown as GameRow);
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
  }, [gameId, enabled]);

  // Live tallies per player are derived from the log feed.
  const game = useMemo(() => {
    if (!state.game) return null;
    const counts = new Map<string, Player["tally"]>();
    for (const l of state.log) {
      if (l.voided) continue;
      const t = counts.get(l.playerId) ?? { cocktail: 0, premium_draft: 0, upsell: 0 };
      t[l.actionType] += 1;
      counts.set(l.playerId, t);
    }
    return {
      ...state.game,
      players: state.game.players.map((p) => ({
        ...p,
        tally: counts.get(p.id) ?? p.tally,
      })),
    };
  }, [state.game, state.log]);

  const me = useMemo(
    () => game?.players.find((p) => p.profileId === state.userId) ?? null,
    [game, state.userId],
  );

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

  const tally = useCallback(
    (action: ActionDef, receipt?: File) => {
      const supabase = supabaseRef.current;
      const s = stateRef.current;
      const current = s.game?.players.find((p) => p.profileId === s.userId);
      if (!supabase || !s.game || !current) return;

      // Optimistic: run the same engine the server runs.
      const { player: optimistic, events } = applyUnits(s.game, current, action.units);
      setState((prev) =>
        prev.game
          ? {
              ...prev,
              game: {
                ...prev.game,
                players: prev.game.players.map((p) => (p.id === optimistic.id ? optimistic : p)),
              },
              events: pushEvents(prev.events, events),
            }
          : prev,
      );

      (async () => {
        const path = receipt
          ? await uploadReceipt(supabase, s.game!.id, current.id, receipt)
          : undefined;
        const row = await logAction(supabase, current.id, action.type, action.units, path);
        setState((prev) => patchPlayer(prev, row));
      })().catch((err: Error) => {
        warn(`Tally failed: ${err.message}`);
        void resync();
      });
    },
    [resync, warn],
  );

  const undo = useCallback(() => {
    const supabase = supabaseRef.current;
    const s = stateRef.current;
    const current = s.game?.players.find((p) => p.profileId === s.userId);
    if (!supabase || !current) return;
    voidLastAction(supabase, current.id)
      .then((row) => {
        setState((prev) => patchPlayer(prev, row));
        void resync(); // pick up the voided log row even if realtime lags
      })
      .catch((err: Error) => warn(`Undo failed: ${err.message}`));
  }, [resync, warn]);

  const override = useCallback(
    (playerId: string, delta: number, reason: string, pin?: string) => {
      const supabase = supabaseRef.current;
      if (!supabase) return;
      managerOverride(supabase, gameId, playerId, delta, reason, pin ?? "")
        .then((row) => setState((prev) => patchPlayer(prev, row)))
        .catch((err: Error) => warn(`Override failed: ${err.message}`));
    },
    [gameId, warn],
  );

  const approve = useCallback(
    (playerId: string, pin?: string) => {
      const supabase = supabaseRef.current;
      if (!supabase) return;
      managerApprove(supabase, gameId, playerId, pin ?? "")
        .then((row) => setState((prev) => patchPlayer(prev, row)))
        .catch((err: Error) => warn(`Approval failed: ${err.message}`));
    },
    [gameId, warn],
  );

  const receiptUrl = useCallback(async (entry: LoggedAction) => {
    const supabase = supabaseRef.current;
    if (!supabase || !entry.receiptPath) return entry.receiptUrl ?? null;
    try {
      return await signedReceiptUrl(supabase, entry.receiptPath);
    } catch {
      return null;
    }
  }, []);

  const actions = useMemo(() => DEFAULT_ACTIONS, []);

  return {
    mode: state.status === "live" ? "live" : state.status,
    error: state.error,
    game,
    log: state.log,
    events: state.events,
    actions,
    me,
    join,
    tally,
    undo,
    override,
    approve,
    receiptUrl,
  };
}
