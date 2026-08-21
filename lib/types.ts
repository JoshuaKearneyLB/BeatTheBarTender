// Core domain types shared by the board engine, UI, and (later) Supabase rows.

export type TileType =
  | "start"
  | "progress"
  | "challenge"
  | "setback"
  | "bonus"
  | "checkpoint"
  | "finish";

export interface Tile {
  position: number;
  type: TileType;
  title: string;
  description?: string;
  /** Board-effect on landing: +n skip ahead, -n move back. */
  move?: number;
  /** Landing here parks the player until a manager approves (PIN / toggle). */
  requiresApproval?: boolean;
}

export type ActionType = "cocktail" | "premium_draft" | "upsell";

export interface ActionDef {
  type: ActionType;
  label: string;
  emoji: string;
  /** Tally units one tap is worth (upsells can count extra). */
  units: number;
}

export const DEFAULT_ACTIONS: ActionDef[] = [
  { type: "cocktail", label: "Cocktail", emoji: "🍸", units: 1 },
  { type: "premium_draft", label: "Premium Draft", emoji: "🍺", units: 1 },
  { type: "upsell", label: "Upsell", emoji: "⭐", units: 2 },
];

export type GameStatus = "lobby" | "active" | "paused" | "finished";

export interface Player {
  id: string;
  /** Supabase profile id in live mode; absent in Demo Mode. */
  profileId?: string;
  name: string;
  token: string; // emoji game piece
  position: number; // tile index
  progress: number; // tally units toward the next tile (0..actionsPerTile-1)
  tally: Record<ActionType, number>;
  awaitingApproval: boolean;
  finished: boolean;
}

export interface LoggedAction {
  id: string;
  playerId: string;
  actionType: ActionType;
  units: number;
  /** Demo Mode: local object URL for the captured photo. */
  receiptUrl?: string;
  /** Live mode: path in the private 'receipts' storage bucket. */
  receiptPath?: string;
  createdAt: string;
  voided?: boolean;
}

export interface Game {
  id: string;
  name: string;
  status: GameStatus;
  boardLength: number;
  /** Tally units required to advance one tile. */
  actionsPerTile: number;
  tiles: Tile[];
  players: Player[];
  winnerId?: string;
}

/** A human-readable thing that just happened, for toasts / the event ticker. */
export interface BoardEvent {
  playerId: string;
  message: string;
  kind: "advance" | "bonus" | "setback" | "checkpoint" | "win" | "override" | "join";
}
