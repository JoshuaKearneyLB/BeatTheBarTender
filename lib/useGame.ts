"use client";

// Game state hook. In Demo Mode it runs the board engine locally with three
// seeded players so every screen is explorable with zero setup. With Supabase
// env vars present, the same hook is where realtime sync plugs in: optimistic
// local apply + insert into action_logs, with subscribeToGame() reconciling.

import { useCallback, useMemo, useReducer } from "react";
import { applyOverride, applyUnits, approvePlayer, generateBoard } from "./board";
import type { ActionDef, BoardEvent, Game, LoggedAction, Player } from "./types";
import { DEFAULT_ACTIONS } from "./types";

const DEMO_PLAYERS: Array<Pick<Player, "id" | "name" | "token">> = [
  { id: "p1", name: "You", token: "🦊" },
  { id: "p2", name: "Marco", token: "🐙" },
  { id: "p3", name: "Dee", token: "🦉" },
];

function seedGame(id: string): Game {
  const boardLength = 30;
  return {
    id,
    name: "Friday Night Shift",
    status: "active",
    boardLength,
    actionsPerTile: 3,
    tiles: generateBoard(boardLength, 42),
    players: DEMO_PLAYERS.map((p, i) => ({
      ...p,
      position: [0, 2, 1][i],
      progress: [0, 1, 2][i],
      tally: { cocktail: i * 2, premium_draft: i, upsell: 0 },
      awaitingApproval: false,
      finished: false,
    })),
  };
}

interface State {
  game: Game;
  log: LoggedAction[];
  events: BoardEvent[];
}

type Action =
  | { type: "TALLY"; playerId: string; action: ActionDef; receiptUrl?: string }
  | { type: "UNDO"; playerId: string }
  | { type: "OVERRIDE"; playerId: string; delta: number; reason: string }
  | { type: "APPROVE"; playerId: string };

function reducer(state: State, action: Action): State {
  const { game } = state;
  const idx = game.players.findIndex((p) => p.id === action.playerId);
  if (idx === -1) return state;
  const player = game.players[idx];

  switch (action.type) {
    case "TALLY": {
      const { player: next, events } = applyUnits(game, player, action.action.units);
      next.tally[action.action.type] += 1;
      const entry: LoggedAction = {
        id: crypto.randomUUID(),
        playerId: player.id,
        actionType: action.action.type,
        units: action.action.units,
        receiptUrl: action.receiptUrl,
        createdAt: new Date().toISOString(),
      };
      return {
        game: { ...game, players: game.players.with(idx, next) },
        log: [entry, ...state.log].slice(0, 200),
        events: [...events, ...state.events].slice(0, 30),
      };
    }
    case "UNDO": {
      // Void the most recent un-voided entry for this player and rebuild the
      // player's units total. Simple and honest for MVP: recompute position
      // from scratch through the engine.
      const target = state.log.find((l) => l.playerId === player.id && !l.voided);
      if (!target) return state;
      const log = state.log.map((l) => (l.id === target.id ? { ...l, voided: true } : l));
      const fresh: Player = {
        ...player,
        position: 0,
        progress: 0,
        awaitingApproval: false,
        finished: false,
        tally: { cocktail: 0, premium_draft: 0, upsell: 0 },
      };
      let rebuilt = fresh;
      for (const l of [...log].reverse()) {
        if (l.playerId !== player.id || l.voided) continue;
        rebuilt = applyUnits(game, rebuilt, l.units).player;
        rebuilt.tally[l.actionType] += 1;
      }
      return {
        game: { ...game, players: game.players.with(idx, rebuilt) },
        log,
        events: [
          {
            playerId: player.id,
            kind: "override",
            message: `${player.name} undid a tally`,
          } satisfies BoardEvent,
          ...state.events,
        ].slice(0, 30),
      };
    }
    case "OVERRIDE": {
      const { player: next, events } = applyOverride(game, player, action.delta, action.reason);
      return {
        game: { ...game, players: game.players.with(idx, next) },
        log: state.log,
        events: [...events, ...state.events].slice(0, 30),
      };
    }
    case "APPROVE": {
      const { player: next, won } = approvePlayer(game, player);
      return {
        game: {
          ...game,
          players: game.players.with(idx, next),
          status: won ? "finished" : game.status,
          winnerId: won ? next.id : game.winnerId,
        },
        log: state.log,
        events: [
          {
            playerId: next.id,
            kind: won ? "win" : "checkpoint",
            message: won ? `🏆 ${next.name} WINS the shift!` : `${next.name} cleared the check`,
          } satisfies BoardEvent,
          ...state.events,
        ].slice(0, 30),
      };
    }
  }
}

export function useGame(gameId: string) {
  const [state, dispatch] = useReducer(reducer, gameId, (id) => ({
    game: seedGame(id),
    log: [],
    events: [],
  }));

  const tally = useCallback(
    (playerId: string, action: ActionDef, receiptUrl?: string) =>
      dispatch({ type: "TALLY", playerId, action, receiptUrl }),
    [],
  );
  const undo = useCallback((playerId: string) => dispatch({ type: "UNDO", playerId }), []);
  const override = useCallback(
    (playerId: string, delta: number, reason: string) =>
      dispatch({ type: "OVERRIDE", playerId, delta, reason }),
    [],
  );
  const approve = useCallback((playerId: string) => dispatch({ type: "APPROVE", playerId }), []);

  const actions = useMemo(() => DEFAULT_ACTIONS, []);

  return { ...state, actions, tally, undo, override, approve };
}
