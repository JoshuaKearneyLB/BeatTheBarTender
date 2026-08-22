"use client";

// The board: a chalkboard behind the bar, one chalk-drawn box per shift.
// Specials get colored chalk and a scrawled mark; every player's piece
// layout-animates between boxes as positions change.

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import type { Game, Tile } from "@/lib/types";

const KIND_CHALK: Record<Tile["kind"], { border: string; text: string; mark: string }> = {
  standard: { border: "border-cream-100/30", text: "text-cream-100/80", mark: "" },
  goal: { border: "border-cream-100/30", text: "text-cream-100/80", mark: "" },
  setback: { border: "border-danger-400/80", text: "text-danger-400", mark: "!!" },
  event_card: { border: "border-brass-400/70", text: "text-brass-400", mark: "?" },
  checkpoint: { border: "border-mint-400/80", text: "text-mint-400", mark: "✓" },
  boss: { border: "border-brass-400", text: "text-brass-400", mark: "★" },
};

/** A tile's chalk styling, with bonus/penalty movement taking precedence. */
function chalkFor(tile: Tile) {
  if (tile.kind === "standard" && tile.movementEffect > 0) {
    return { border: "border-mint-400/80", text: "text-mint-400", mark: "++" };
  }
  if (tile.movementEffect < 0 && tile.kind !== "setback") {
    return { border: "border-danger-400/80", text: "text-danger-400", mark: "!!" };
  }
  return KIND_CHALK[tile.kind];
}

// Chalk boxes drawn in a hurry: deterministic tilt.
const TILTS = [-1.4, 0.8, -0.6, 1.2, -1.0, 0.5];

export default function BoardStrip({ game, meId }: { game: Game; meId?: string }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const me = game.players.find((p) => p.id === meId);

  // Keep my piece in view as I move.
  useEffect(() => {
    if (!me || !scrollerRef.current) return;
    const el = scrollerRef.current.querySelector<HTMLElement>(`[data-pos="${me.position}"]`);
    el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [me, me?.position]);

  return (
    <div className="chalkboard px-2 py-3">
      <div ref={scrollerRef} className="overflow-x-auto" role="img" aria-label="The board">
        <div className="flex w-max items-stretch gap-2.5 px-1 py-1">
          {game.tiles.map((tile) => {
            const here = game.players.filter((p) => p.position === tile.position);
            const chalk = chalkFor(tile);
            const mine = me?.position === tile.position;
            return (
              <div
                key={tile.position}
                data-pos={tile.position}
                style={{ transform: `rotate(${TILTS[tile.position % TILTS.length]}deg)` }}
                className={`relative flex h-[6.4rem] w-[5.4rem] shrink-0 flex-col justify-between border-2 border-dashed p-1.5 ${chalk.border} ${
                  mine ? "bg-cream-100/10 shadow-[0_0_16px_rgba(255,185,46,0.25)]" : ""
                }`}
              >
                <div className={`chalk flex items-start justify-between text-base leading-none ${chalk.text}`}>
                  <span>
                    {tile.position + 1}
                    {tile.moveValue > 1 && <span className="ml-1">×{tile.moveValue}</span>}
                  </span>
                  <span>{chalk.mark}</span>
                </div>
                <p className={`chalk text-sm leading-[1.05] ${chalk.text}`}>{tile.name}</p>
                <div className="flex h-6 items-end gap-0.5">
                  {here.map((p) => (
                    <motion.span
                      key={p.id}
                      layoutId={`token-${p.id}`}
                      transition={{ type: "spring", stiffness: 250, damping: 22 }}
                      className={`text-lg leading-none ${p.id === meId ? "drop-shadow-[0_0_7px_#ffb92e]" : ""}`}
                      title={p.name}
                    >
                      {p.token}
                    </motion.span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
