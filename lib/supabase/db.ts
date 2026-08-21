// Row types, mappers, and data access for live (Supabase) mode. All game
// state mutations go through the RPCs defined in
// supabase/migrations/0002_engine_rpcs.sql — the database is the referee.

import type { SupabaseClient } from "@supabase/supabase-js";
import { generateBoard } from "@/lib/board";
import type {
  ActionType,
  Game,
  GameStatus,
  LoggedAction,
  Player,
  Tile,
  TileType,
} from "@/lib/types";
import { ensureSignedIn } from "./auth";
import { getSupabaseBrowser } from "./client";

// ---------- row shapes (as returned by supabase-js) ----------

export interface GameRow {
  id: string;
  name: string;
  status: GameStatus;
  board_length: number;
  actions_per_tile: number;
  board_seed: number;
  winner_player_id: string | null;
}

export interface TileRow {
  position: number;
  tile_type: TileType;
  title: string;
  description: string | null;
  move_delta: number;
  requires_approval: boolean;
}

export interface PlayerRow {
  id: string;
  game_id: string;
  profile_id: string;
  display_name: string;
  token_emoji: string;
  position: number;
  progress: number;
  awaiting_approval: boolean;
  finished: boolean;
}

export interface LogRow {
  id: string;
  game_id: string;
  player_id: string;
  action_type: ActionType;
  units: number;
  receipt_path: string | null;
  voided: boolean;
  created_at: string;
}

// ---------- mappers ----------

export function rowToTile(r: TileRow): Tile {
  return {
    position: r.position,
    type: r.tile_type,
    title: r.title,
    description: r.description ?? undefined,
    move: r.move_delta !== 0 ? r.move_delta : undefined,
    requiresApproval: r.requires_approval || undefined,
  };
}

export function rowToPlayer(r: PlayerRow): Player {
  return {
    id: r.id,
    profileId: r.profile_id,
    name: r.display_name,
    token: r.token_emoji,
    position: r.position,
    progress: r.progress,
    // Per-action tallies live in action_logs; the live UI shows totals from
    // the log feed instead of a per-player breakdown.
    tally: { cocktail: 0, premium_draft: 0, upsell: 0 },
    awaitingApproval: r.awaiting_approval,
    finished: r.finished,
  };
}

export function rowToLog(r: LogRow): LoggedAction {
  return {
    id: r.id,
    playerId: r.player_id,
    actionType: r.action_type,
    units: r.units,
    receiptPath: r.receipt_path ?? undefined,
    createdAt: r.created_at,
    voided: r.voided,
  };
}

// ---------- reads ----------

export async function fetchGame(
  supabase: SupabaseClient,
  gameId: string,
): Promise<{ game: Game; log: LoggedAction[] }> {
  const [gameRes, tilesRes, playersRes, logsRes] = await Promise.all([
    supabase.from("games").select("*").eq("id", gameId).single(),
    supabase.from("game_tiles").select("*").eq("game_id", gameId).order("position"),
    supabase.from("game_players").select("*").eq("game_id", gameId).order("joined_at"),
    supabase
      .from("action_logs")
      .select("*")
      .eq("game_id", gameId)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);
  const firstError = gameRes.error ?? tilesRes.error ?? playersRes.error ?? logsRes.error;
  if (firstError) throw new Error(`Failed to load game: ${firstError.message}`);

  const row = gameRes.data as GameRow;
  return {
    game: {
      id: row.id,
      name: row.name,
      status: row.status,
      boardLength: row.board_length,
      actionsPerTile: row.actions_per_tile,
      tiles: (tilesRes.data as TileRow[]).map(rowToTile),
      players: (playersRes.data as PlayerRow[]).map(rowToPlayer),
      winnerId: row.winner_player_id ?? undefined,
    },
    log: (logsRes.data as LogRow[]).map(rowToLog),
  };
}

// ---------- RPC wrappers ----------

async function rpc<T>(supabase: SupabaseClient, fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export async function createGameLive(opts: {
  name: string;
  boardLength: number;
  actionsPerTile: number;
  pin: string;
}): Promise<string> {
  const supabase = mustClient();
  await ensureSignedIn(supabase);
  const seed = Math.floor(Math.random() * 2 ** 31);
  const tiles = generateBoard(opts.boardLength, seed);
  return rpc<string>(supabase, "create_game", {
    p_name: opts.name,
    p_board_length: opts.boardLength,
    p_actions_per_tile: opts.actionsPerTile,
    p_seed: seed,
    p_pin: opts.pin,
    p_tiles: tiles,
  });
}

export const joinGame = (
  supabase: SupabaseClient,
  gameId: string,
  displayName: string,
  tokenEmoji: string,
) =>
  rpc<PlayerRow>(supabase, "join_game", {
    p_game_id: gameId,
    p_display_name: displayName,
    p_token_emoji: tokenEmoji,
  });

export const logAction = (
  supabase: SupabaseClient,
  playerId: string,
  actionType: ActionType,
  units: number,
  receiptPath?: string,
) =>
  rpc<PlayerRow>(supabase, "log_action", {
    p_player_id: playerId,
    p_action_type: actionType,
    p_units: units,
    p_receipt_path: receiptPath ?? null,
  });

export const voidLastAction = (supabase: SupabaseClient, playerId: string) =>
  rpc<PlayerRow>(supabase, "void_last_action", { p_player_id: playerId });

export const managerOverride = (
  supabase: SupabaseClient,
  gameId: string,
  playerId: string,
  delta: number,
  reason: string,
  pin: string,
) =>
  rpc<PlayerRow>(supabase, "manager_override", {
    p_game_id: gameId,
    p_player_id: playerId,
    p_delta: delta,
    p_reason: reason,
    p_pin: pin || null,
  });

export const managerApprove = (
  supabase: SupabaseClient,
  gameId: string,
  playerId: string,
  pin: string,
) =>
  rpc<PlayerRow>(supabase, "manager_approve", {
    p_game_id: gameId,
    p_player_id: playerId,
    p_pin: pin || null,
  });

// ---------- receipt storage ----------

const RECEIPTS_BUCKET = "receipts";

/** Upload a receipt photo; returns the storage path for action_logs. */
export async function uploadReceipt(
  supabase: SupabaseClient,
  gameId: string,
  playerId: string,
  file: File,
): Promise<string> {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `${gameId}/${playerId}/${crypto.randomUUID()}.${ext || "jpg"}`;
  const { error } = await supabase.storage.from(RECEIPTS_BUCKET).upload(path, file, {
    contentType: file.type || "image/jpeg",
    upsert: false,
  });
  if (error) throw new Error(`Receipt upload failed: ${error.message}`);
  return path;
}

/** Short-lived signed URL so managers can view a receipt from the private bucket. */
export async function signedReceiptUrl(
  supabase: SupabaseClient,
  path: string,
  expiresInSeconds = 60,
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(RECEIPTS_BUCKET)
    .createSignedUrl(path, expiresInSeconds);
  if (error || !data) throw new Error(`Could not sign receipt URL: ${error?.message}`);
  return data.signedUrl;
}

// ---------- helpers ----------

function mustClient(): SupabaseClient {
  const client = getSupabaseBrowser();
  if (!client) throw new Error("Supabase is not configured (Demo Mode)");
  return client;
}
