import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";

/**
 * Subscribe to live changes for one game. Fires `onChange` whenever a player
 * row or action log for this game mutates; the caller refetches or patches
 * local state. Returns an unsubscribe function.
 *
 * Requires `game_players` and `action_logs` to be in the `supabase_realtime`
 * publication (see supabase/migrations/0001_init.sql).
 */
export function subscribeToGame(
  supabase: SupabaseClient,
  gameId: string,
  onChange: (table: "game_players" | "action_logs", payload: unknown) => void,
): () => void {
  const channel: RealtimeChannel = supabase
    .channel(`game:${gameId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "game_players", filter: `game_id=eq.${gameId}` },
      (payload) => onChange("game_players", payload),
    )
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "action_logs", filter: `game_id=eq.${gameId}` },
      (payload) => onChange("action_logs", payload),
    )
    .subscribe();

  return () => {
    void channel.unsubscribe();
  };
}
