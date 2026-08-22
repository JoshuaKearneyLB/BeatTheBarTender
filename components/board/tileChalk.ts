// Shared chalk styling for tiles, so the strip and the square board agree.

import type { Tile } from "@/lib/types";

export interface TileChalk {
  border: string;
  text: string;
  mark: string;
  /** Solid fill for the stamped colour bar on the square board. */
  bar: string;
}

export const KIND_CHALK: Record<Tile["kind"], TileChalk> = {
  standard: { border: "border-cream-100/30", text: "text-cream-100/80", mark: "", bar: "bg-bar-600" },
  goal: { border: "border-cream-100/30", text: "text-cream-100/80", mark: "", bar: "bg-bar-600" },
  setback: { border: "border-danger-400/80", text: "text-danger-400", mark: "!!", bar: "bg-danger-400" },
  event_card: { border: "border-brass-400/70", text: "text-brass-400", mark: "?", bar: "bg-brass-400" },
  checkpoint: { border: "border-mint-400/80", text: "text-mint-400", mark: "✓", bar: "bg-mint-400" },
  boss: { border: "border-brass-400", text: "text-brass-400", mark: "★", bar: "bg-brass-400" },
};

/** A tile's chalk styling, with bonus/penalty movement taking precedence. */
export function chalkFor(tile: Tile): TileChalk {
  if (tile.kind === "standard" && tile.movementEffect > 0) {
    return { border: "border-mint-400/80", text: "text-mint-400", mark: "++", bar: "bg-mint-400" };
  }
  if (tile.movementEffect < 0 && tile.kind !== "setback") {
    return { border: "border-danger-400/80", text: "text-danger-400", mark: "!!", bar: "bg-danger-400" };
  }
  return KIND_CHALK[tile.kind];
}
