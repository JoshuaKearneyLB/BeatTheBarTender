"use client";

// The board: a rail of index cards taped up behind the bar, one per shift.
// Cards sit slightly crooked, specials get colored edges, and every
// player's piece layout-animates between cards as positions change.

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Flag, Gift, Martini, ShieldCheck, Sparkles, TriangleAlert } from "lucide-react";
import type { Game, TileType } from "@/lib/types";

const TILE_STYLE: Record<TileType, { icon: React.ReactNode; ring: string }> = {
  start: { icon: <Martini className="size-4" />, ring: "border-cream-400/50" },
  progress: { icon: null, ring: "border-bar-600" },
  challenge: { icon: <Sparkles className="size-4 text-brass-400" />, ring: "border-brass-500" },
  setback: { icon: <TriangleAlert className="size-4 text-danger-400" />, ring: "border-danger-400" },
  bonus: { icon: <Gift className="size-4 text-mint-400" />, ring: "border-mint-400" },
  checkpoint: { icon: <ShieldCheck className="size-4 text-brass-400" />, ring: "border-brass-400" },
  finish: { icon: <Flag className="size-4 text-brass-400" />, ring: "border-brass-400" },
};

// Deterministic "taped up in a hurry" tilt.
const TILTS = [-1.6, 0.9, -0.7, 1.4, -1.1, 0.5];

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
    <div ref={scrollerRef} className="overflow-x-auto pb-2 pt-1" role="img" aria-label="The board">
      <div className="flex w-max items-stretch gap-2.5 px-1">
        {game.tiles.map((tile) => {
          const here = game.players.filter((p) => p.position === tile.position);
          const style = TILE_STYLE[tile.type];
          const mine = me?.position === tile.position;
          return (
            <div
              key={tile.position}
              data-pos={tile.position}
              style={{ transform: `rotate(${TILTS[tile.position % TILTS.length]}deg)` }}
              className={`relative flex h-[6.5rem] w-[5.25rem] shrink-0 flex-col justify-between border-2 bg-bar-800 p-1.5 ${style.ring} ${
                mine ? "shadow-[0_0_14px_rgba(255,185,46,0.35)]" : "shadow-[3px_3px_0_rgba(0,0,0,0.5)]"
              }`}
            >
              {/* tape */}
              <span className="absolute -top-1.5 left-1/2 h-2.5 w-8 -translate-x-1/2 rotate-2 bg-cream-100/15" />
              <div className="ticket flex items-center justify-between text-[10px] text-cream-400">
                <span>
                  {tile.position + 1}
                  {tile.moveValue > 1 && (
                    <span className="ml-1 bg-brass-400 px-0.5 font-black text-bar-900">
                      ×{tile.moveValue}
                    </span>
                  )}
                </span>
                {style.icon}
              </div>
              <p className="ticket text-[9px] leading-tight text-cream-100">{tile.title}</p>
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
  );
}
