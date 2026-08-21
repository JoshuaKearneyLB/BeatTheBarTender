// Row types, mappers, and data access for live (Supabase) mode. All game
// state mutations go through the RPCs defined in
// supabase/migrations/0003_campaign_quests.sql — the database is the referee.

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Game,
  GameStatus,
  GoalType,
  Player,
  QuestSubmission,
  SubmissionStatus,
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
  auto_approve: boolean;
  campaign_preset: string | null;
  winner_player_id: string | null;
}

export interface TileRow {
  position: number;
  tile_type: TileType;
  title: string;
  description: string | null;
  move_delta: number;
  goal_type: GoalType;
  goal_target: number;
  goal_label: string;
  move_value: number;
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

export interface SubmissionRow {
  id: string;
  game_id: string;
  player_id: string;
  tile_position: number;
  claimed_value: number;
  note: string | null;
  photo_path: string | null;
  status: SubmissionStatus;
  review_note: string | null;
  submitted_at: string;
}

// ---------- mappers ----------

export function rowToTile(r: TileRow): Tile {
  return {
    position: r.position,
    type: r.tile_type,
    title: r.title,
    description: r.description ?? undefined,
    move: r.move_delta !== 0 ? r.move_delta : undefined,
    goal: { type: r.goal_type, label: r.goal_label, target: r.goal_target },
    moveValue: r.move_value,
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
    awaitingApproval: r.awaiting_approval,
    finished: r.finished,
  };
}

export function rowToSubmission(r: SubmissionRow): QuestSubmission {
  return {
    id: r.id,
    playerId: r.player_id,
    tilePosition: r.tile_position,
    claimedValue: r.claimed_value,
    note: r.note ?? undefined,
    photoPath: r.photo_path ?? undefined,
    status: r.status,
    reviewNote: r.review_note ?? undefined,
    submittedAt: r.submitted_at,
  };
}

// ---------- reads ----------

export async function fetchGame(
  supabase: SupabaseClient,
  gameId: string,
): Promise<{ game: Game; submissions: QuestSubmission[] }> {
  const [gameRes, tilesRes, playersRes, subsRes] = await Promise.all([
    supabase.from("games").select("*").eq("id", gameId).single(),
    supabase.from("game_tiles").select("*").eq("game_id", gameId).order("position"),
    supabase.from("game_players").select("*").eq("game_id", gameId).order("joined_at"),
    supabase
      .from("quest_submissions")
      .select("*")
      .eq("game_id", gameId)
      .order("submitted_at", { ascending: false })
      .limit(200),
  ]);
  const firstError = gameRes.error ?? tilesRes.error ?? playersRes.error ?? subsRes.error;
  if (firstError) throw new Error(`Failed to load game: ${firstError.message}`);

  const row = gameRes.data as GameRow;
  return {
    game: {
      id: row.id,
      name: row.name,
      status: row.status,
      boardLength: row.board_length,
      autoApprove: row.auto_approve,
      campaignPreset: row.campaign_preset ?? undefined,
      tiles: (tilesRes.data as TileRow[]).map(rowToTile),
      players: (playersRes.data as PlayerRow[]).map(rowToPlayer),
      winnerId: row.winner_player_id ?? undefined,
    },
    submissions: (subsRes.data as SubmissionRow[]).map(rowToSubmission),
  };
}

// ---------- RPC wrappers ----------

async function rpc<T>(supabase: SupabaseClient, fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export async function createCampaignLive(opts: {
  name: string;
  boardLength: number;
  preset: string;
  autoApprove: boolean;
  pin: string;
  tiles: Tile[];
}): Promise<string> {
  const supabase = mustClient();
  await ensureSignedIn(supabase);
  return rpc<string>(supabase, "create_campaign", {
    p_name: opts.name,
    p_board_length: opts.boardLength,
    p_preset: opts.preset,
    p_auto_approve: opts.autoApprove,
    p_pin: opts.pin,
    p_tiles: opts.tiles,
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

export const updateProgress = (supabase: SupabaseClient, playerId: string, progress: number) =>
  rpc<PlayerRow>(supabase, "update_progress", {
    p_player_id: playerId,
    p_progress: progress,
  });

export const submitQuest = (
  supabase: SupabaseClient,
  playerId: string,
  claimedValue: number,
  note?: string,
  photoPath?: string,
) =>
  rpc<SubmissionRow>(supabase, "submit_quest", {
    p_player_id: playerId,
    p_claimed_value: claimedValue,
    p_note: note ?? null,
    p_photo_path: photoPath ?? null,
  });

export const reviewSubmissions = (
  supabase: SupabaseClient,
  gameId: string,
  submissionIds: string[],
  approve: boolean,
  note: string | undefined,
  pin: string,
) =>
  rpc<number>(supabase, "review_submissions", {
    p_game_id: gameId,
    p_submission_ids: submissionIds,
    p_approve: approve,
    p_note: note ?? null,
    p_pin: pin || null,
  });

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

// ---------- photo storage (shift summary / till report) ----------

const RECEIPTS_BUCKET = "receipts";

/** Upload a quest photo; returns the storage path for quest_submissions. */
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
  if (error) throw new Error(`Photo upload failed: ${error.message}`);
  return path;
}

/** Short-lived signed URL so managers can view a photo from the private bucket. */
export async function signedReceiptUrl(
  supabase: SupabaseClient,
  path: string,
  expiresInSeconds = 60,
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(RECEIPTS_BUCKET)
    .createSignedUrl(path, expiresInSeconds);
  if (error || !data) throw new Error(`Could not sign photo URL: ${error?.message}`);
  return data.signedUrl;
}

// ---------- helpers ----------

function mustClient(): SupabaseClient {
  const client = getSupabaseBrowser();
  if (!client) throw new Error("Supabase is not configured (Demo Mode)");
  return client;
}
