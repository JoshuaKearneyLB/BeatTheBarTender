import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";

export type GameTable = "games" | "game_players" | "quest_submissions";

export interface GameChange {
  table: GameTable;
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: Record<string, unknown> | null;
}

/**
 * Subscribe to live changes for one game: player movement, tally inserts and
 * voids, and game status (win) updates. Fires `onChange` per row change; the
 * caller patches local state. Returns an unsubscribe function.
 *
 * Requires these tables in the `supabase_realtime` publication
 * (see supabase/migrations/0001_init.sql).
 */
export function subscribeToGame(
  supabase: SupabaseClient,
  gameId: string,
  onChange: (change: GameChange) => void,
): () => void {
  const forward = (table: GameTable) => (payload: {
    eventType: "INSERT" | "UPDATE" | "DELETE";
    new: Record<string, unknown> | null;
  }) => onChange({ table, eventType: payload.eventType, new: payload.new ?? null });

  const channel: RealtimeChannel = supabase
    .channel(`game:${gameId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "game_players", filter: `game_id=eq.${gameId}` },
      forward("game_players"),
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "quest_submissions", filter: `game_id=eq.${gameId}` },
      forward("quest_submissions"),
    )
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "games", filter: `id=eq.${gameId}` },
      forward("games"),
    )
    .subscribe();

  return () => {
    void channel.unsubscribe();
  };
}
