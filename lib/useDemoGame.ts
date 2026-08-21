"use client";

// Demo Mode engine: the full quest loop on local seeded state, so every
// screen works with zero setup. You are always player 1; the seeded bots
// come with a pending submission and mid-quest progress so the manager
// console has something to review immediately.

import { useCallback, useReducer } from "react";
import { applyOverride, applyQuestApproval, generateCampaignBoard } from "./board";
import type { BoardEvent, Game, Player, QuestSubmission } from "./types";
import type { GameApi } from "./useGame";

function seedState(id: string): State {
  const boardLength = 30;
  const game: Game = {
    id,
    name: "Monthly Marathon",
    status: "active",
    boardLength,
    autoApprove: false,
    campaignPreset: "balanced",
    tiles: generateCampaignBoard(boardLength, "balanced", 42),
    players: [
      { id: "p1", name: "You", token: "🦊", position: 0, progress: 0, awaitingApproval: false, finished: false },
      { id: "p2", name: "Marco", token: "🐙", position: 2, progress: 0, awaitingApproval: true, finished: false },
      { id: "p3", name: "Dee", token: "🦉", position: 1, progress: 3, awaitingApproval: false, finished: false },
    ],
  };
  return {
    game,
    submissions: [
      {
        id: "demo-sub-marco",
        playerId: "p2",
        tilePosition: 2,
        claimedValue: game.tiles[2].goal.target,
        note: "Till receipt from close-down",
        status: "pending",
        submittedAt: new Date(Date.now() - 40 * 60_000).toISOString(),
      },
    ],
    events: [],
  };
}

interface State {
  game: Game;
  submissions: QuestSubmission[];
  events: BoardEvent[];
}

type Action =
  | { type: "PROGRESS"; playerId: string; delta: number }
  | { type: "SUBMIT"; playerId: string; photoUrl?: string; note?: string }
  | { type: "REVIEW"; ids: string[]; approve: boolean }
  | { type: "OVERRIDE"; playerId: string; delta: number; reason: string };

function withPlayer(game: Game, next: Player): Game {
  return { ...game, players: game.players.map((p) => (p.id === next.id ? next : p)) };
}

function reducer(state: State, action: Action): State {
  const { game } = state;

  switch (action.type) {
    case "PROGRESS": {
      const p = game.players.find((x) => x.id === action.playerId);
      if (!p || p.awaitingApproval || p.finished) return state;
      const target = game.tiles[p.position].goal.target;
      const progress = Math.max(0, Math.min(p.progress + action.delta, Math.max(target * 3, 99)));
      return { ...state, game: withPlayer(game, { ...p, progress }) };
    }
    case "SUBMIT": {
      const p = game.players.find((x) => x.id === action.playerId);
      if (!p || p.awaitingApproval || p.finished) return state;
      const sub: QuestSubmission = {
        id: crypto.randomUUID(),
        playerId: p.id,
        tilePosition: p.position,
        claimedValue: p.progress,
        note: action.note,
        photoUrl: action.photoUrl,
        status: "pending",
        submittedAt: new Date().toISOString(),
      };
      return {
        ...state,
        game: withPlayer(game, { ...p, awaitingApproval: true }),
        submissions: [sub, ...state.submissions].slice(0, 200),
        events: [
          {
            playerId: p.id,
            kind: "checkpoint",
            message: `${p.name} sent “${game.tiles[p.position].goal.label}” for sign-off`,
          } satisfies BoardEvent,
          ...state.events,
        ].slice(0, 30),
      };
    }
    case "REVIEW": {
      let next = state;
      for (const id of action.ids) {
        const sub = next.submissions.find((s) => s.id === id && s.status === "pending");
        if (!sub) continue;
        const player = next.game.players.find((p) => p.id === sub.playerId);
        if (!player) continue;
        if (action.approve) {
          const { player: moved, events } = applyQuestApproval(next.game, player);
          next = {
            game: {
              ...withPlayer(next.game, moved),
              status: moved.finished ? "finished" : next.game.status,
              winnerId: moved.finished ? moved.id : next.game.winnerId,
            },
            submissions: next.submissions.map((s) =>
              s.id === id ? { ...s, status: "approved" as const } : s,
            ),
            events: [...events, ...next.events].slice(0, 30),
          };
        } else {
          next = {
            game: withPlayer(next.game, { ...player, awaitingApproval: false }),
            submissions: next.submissions.map((s) =>
              s.id === id ? { ...s, status: "rejected" as const, reviewNote: "Binned by manager" } : s,
            ),
            events: [
              {
                playerId: player.id,
                kind: "setback",
                message: `Manager binned ${player.name}'s count — ring it in again`,
              } satisfies BoardEvent,
              ...next.events,
            ].slice(0, 30),
          };
        }
      }
      return next;
    }
    case "OVERRIDE": {
      const p = game.players.find((x) => x.id === action.playerId);
      if (!p) return state;
      const { player: moved, events } = applyOverride(game, p, action.delta, action.reason);
      return {
        ...state,
        game: withPlayer(game, { ...moved, awaitingApproval: false }),
        submissions: state.submissions.map((s) =>
          s.playerId === p.id && s.status === "pending"
            ? { ...s, status: "rejected" as const, reviewNote: "Superseded by manager override" }
            : s,
        ),
        events: [...events, ...state.events].slice(0, 30),
      };
    }
  }
}

export function useDemoGame(gameId: string): GameApi {
  const [state, dispatch] = useReducer(reducer, gameId, seedState);
  const me = state.game.players[0];

  const bumpProgress = useCallback(
    (delta: number) => dispatch({ type: "PROGRESS", playerId: "p1", delta }),
    [],
  );
  const submitQuest = useCallback((opts?: { photo?: File; note?: string }) => {
    dispatch({
      type: "SUBMIT",
      playerId: "p1",
      photoUrl: opts?.photo ? URL.createObjectURL(opts.photo) : undefined,
      note: opts?.note,
    });
  }, []);
  const review = useCallback(
    (ids: string[], approve: boolean) => dispatch({ type: "REVIEW", ids, approve }),
    [],
  );
  const override = useCallback(
    (playerId: string, delta: number, reason: string) =>
      dispatch({ type: "OVERRIDE", playerId, delta, reason }),
    [],
  );
  const join = useCallback(async () => {}, []);
  const photoUrl = useCallback(async (sub: QuestSubmission) => sub.photoUrl ?? null, []);

  return {
    mode: "demo",
    error: null,
    ...state,
    me,
    join,
    bumpProgress,
    submitQuest,
    review,
    override,
    photoUrl,
  };
}
