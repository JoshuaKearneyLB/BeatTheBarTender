import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";

export interface RaceChange {
  table: "races" | "racers";
  new: Record<string, unknown> | null;
}

/**
 * Subscribe to live changes for one race: every racer's count and the race
 * row (status, winner). Fires `onChange` per row change; the caller patches
 * local state. Returns an unsubscribe function.
 *
 * Requires both tables in the `supabase_realtime` publication
 * (see supabase/migrations/0001_drink_race.sql).
 */
export function subscribeToRace(
  supabase: SupabaseClient,
  raceId: string,
  onChange: (change: RaceChange) => void,
): () => void {
  const forward =
    (table: RaceChange["table"]) => (payload: { new: Record<string, unknown> | null }) =>
      onChange({ table, new: payload.new ?? null });

  const channel: RealtimeChannel = supabase
    .channel(`race:${raceId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "racers", filter: `race_id=eq.${raceId}` },
      forward("racers"),
    )
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "races", filter: `id=eq.${raceId}` },
      forward("races"),
    )
    .subscribe();

  return () => {
    void channel.unsubscribe();
  };
}
