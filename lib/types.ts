// Core domain types shared by the board engine, UI, and Supabase rows.
// v0.4: every tile is a manager-editable object — its own kind, name, rule
// text, movement effect, optional target drink, and a checkpoint flag that
// acts as a floor no automatic setback can push a player below.

/** What a tile is, in the manager's vocabulary. */
export type TileKind =
  | "standard"
  | "goal"
  | "setback"
  | "event_card"
  | "checkpoint"
  | "boss";

export type GoalType = "volume" | "upsell" | "task";

export interface TileGoal {
  type: GoalType;
  /** What the bartender reads, e.g. "Sell 10 Espresso Martinis". */
  label: string;
  /** Numeric target; 1 for one-off jobs. */
  target: number;
}

export interface Tile {
  position: number;
  kind: TileKind;
  /** Manager-defined label, e.g. "Dirty Well Penalty". */
  name: string;
  /** What happens / what they must do when they land here. */
  ruleText?: string;
  /** Tiles moved on LANDING here: -2 back two, +3 ahead three, 0 neutral. */
  movementEffect: number;
  /** Safe zone: automatic setbacks can never push a player below this tile. */
  isCheckpoint: boolean;
  /** Optional link to a drink on the house menu (lib/recipes.ts). */
  targetDrinkId?: string;
  /** The goal that must be cleared (and signed off) to leave this tile. */
  goal: TileGoal;
  /** Tiles gained when this tile's goal is signed off. */
  moveValue: number;
}

/** A card in the manager's deck, drawn when a player lands on a card tile. */
export interface EventCard {
  id: string;
  /** Undefined = general deck, drawable from any card tile. */
  tilePosition?: number;
  name: string;
  ruleText?: string;
  movementEffect: number;
  /** Relative draw likelihood, 1–10. */
  weight: number;
}

export interface CardDraw {
  id: string;
  playerId: string;
  cardName: string;
  ruleText?: string;
  movementEffect: number;
  tilePosition: number;
  drawnAt: string;
}

export type GameStatus = "lobby" | "active" | "paused" | "finished";

export interface Player {
  id: string;
  /** Supabase profile id in live mode; absent in Demo Mode. */
  profileId?: string;
  name: string;
  token: string; // emoji game piece
  position: number; // tile index = which goal is live
  /** Self-reported count toward the current tile's target. */
  progress: number;
  /** Furthest checkpoint reached — automatic setbacks stop here. */
  checkpointFloor: number;
  /** True while a count is waiting on manager sign-off. */
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
  /** Manager toggle: sign off non-winning counts automatically. */
  autoApprove: boolean;
  campaignPreset?: string;
  tiles: Tile[];
  players: Player[];
  cards: EventCard[];
  winnerId?: string;
}

/** A human-readable thing that just happened, for the chalk ticker. */
export interface BoardEvent {
  playerId: string;
  message: string;
  kind:
    | "advance"
    | "bonus"
    | "setback"
    | "checkpoint"
    | "card"
    | "win"
    | "override"
    | "join";
}

/** Patch shape the tile editor sends; only present keys change. */
export interface TilePatch {
  kind?: TileKind;
  name?: string;
  ruleText?: string;
  movementEffect?: number;
  isCheckpoint?: boolean;
  targetDrinkId?: string;
  moveValue?: number;
  goal?: Partial<TileGoal>;
}
