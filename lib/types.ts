// Core domain types for the Drink Race: one drink, one number, first
// behind the bar to sell that many wins.

export type RaceStatus = "active" | "finished";

/** What the crew are actually playing for. */
export interface Prize {
  title: string;
  description?: string;
  /** Pixel badge id from lib/tokens.ts. */
  badge: string;
}

export interface Racer {
  id: string;
  /** Supabase auth user id in live mode; absent in Demo Mode. */
  profileId?: string;
  name: string;
  /** Pixel sprite id from lib/tokens.ts. */
  token: string;
  /** Drinks rung in so far — also their square on the track. */
  count: number;
  /** When they reached the target; the earliest one wins. */
  finishedAt?: string;
}

export interface Race {
  id: string;
  name: string;
  /** The drink being raced, e.g. "Hacien Pineapple Spritz". */
  drinkName: string;
  /** Sales needed to win — also the length of the track. */
  target: number;
  prize: Prize;
  status: RaceStatus;
  racers: Racer[];
  winnerId?: string;
}

/** A human-readable thing that just happened, for the ticker. */
export interface RaceEvent {
  /** Stable key for the ticker; stamped by pushEvents. */
  id?: number;
  racerId: string;
  message: string;
  kind: "sale" | "undo" | "win" | "correction" | "join";
}
