// Shared chalk styling for tiles, so the strip and the square board agree.

import type { Tile } from "@/lib/types";

export interface TileChalk {
  border: string;
  text: string;
  mark: string;
}

export const KIND_CHALK: Record<Tile["kind"], TileChalk> = {
  standard: { border: "border-cream-100/30", text: "text-cream-100/80", mark: "" },
  goal: { border: "border-cream-100/30", text: "text-cream-100/80", mark: "" },
  setback: { border: "border-danger-400/80", text: "text-danger-400", mark: "!!" },
  event_card: { border: "border-brass-400/70", text: "text-brass-400", mark: "?" },
  checkpoint: { border: "border-mint-400/80", text: "text-mint-400", mark: "✓" },
  boss: { border: "border-brass-400", text: "text-brass-400", mark: "★" },
};

/** A tile's chalk styling, with bonus/penalty movement taking precedence. */
export function chalkFor(tile: Tile): TileChalk {
  if (tile.kind === "standard" && tile.movementEffect > 0) {
    return { border: "border-mint-400/80", text: "text-mint-400", mark: "++" };
  }
  if (tile.movementEffect < 0 && tile.kind !== "setback") {
    return { border: "border-danger-400/80", text: "text-danger-400", mark: "!!" };
  }
  return KIND_CHALK[tile.kind];
}
