// Core domain types shared by the board engine, UI, and Supabase rows.
// v0.3 "Monthly Marathon": movement is quest-based — every tile carries a
// manager-configured goal, and completing it (with manager verification)
// moves the player by the tile's move value.

export type TileType =
  | "start"
  | "progress"
  | "challenge"
  | "setback"
  | "bonus"
  | "checkpoint"
  | "finish";

export type GoalType = "volume" | "upsell" | "task";

export interface TileGoal {
  type: GoalType;
  /** What the bartender reads, e.g. "Sell 10 Espresso Martinis". */
  label: string;
  /** Numeric target; 1 for boolean tasks. */
  target: number;
}

export interface Tile {
  position: number;
  type: TileType;
  title: string;
  description?: string;
  /** Landing effect: +n skip ahead, -n move back (never chains). */
  move?: number;
  /** The quest that must be completed (and verified) to leave this tile. */
  goal: TileGoal;
  /** Tiles moved forward when the quest is approved: 1 standard, 2-3 hard/boss. */
  moveValue: number;
}

export type GameStatus = "lobby" | "active" | "paused" | "finished";

export interface Player {
  id: string;
  /** Supabase profile id in live mode; absent in Demo Mode. */
  profileId?: string;
  name: string;
  token: string; // emoji game piece
  position: number; // tile index = which quest is active
  /** Self-reported progress toward the current tile's goal target. */
  progress: number;
  /** True while a quest submission is pending manager review. */
  awaitingApproval: boolean;
  finished: boolean;
}

export type SubmissionStatus = "pending" | "approved" | "rejected";

export interface QuestSubmission {
  id: string;
  playerId: string;
  tilePosition: number;
  claimedValue: number;
  note?: string;
  /** Demo Mode: local object URL for the captured photo. */
  photoUrl?: string;
  /** Live mode: path in the private 'receipts' storage bucket. */
  photoPath?: string;
  status: SubmissionStatus;
  submittedAt: string;
  reviewNote?: string;
}

export interface Game {
  id: string;
  name: string;
  status: GameStatus;
  boardLength: number;
  /** Manager toggle: approve non-winning quests automatically on submit. */
  autoApprove: boolean;
  campaignPreset?: string;
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
