"use client";

// Live board: a horizontally scrolling strip of tiles with every player's
// token layout-animating between tiles as positions change.

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Flag, Gift, Martini, ShieldCheck, Sparkles, TriangleAlert } from "lucide-react";
import type { Game, TileType } from "@/lib/types";

const TILE_STYLE: Record<TileType, { icon: React.ReactNode; ring: string }> = {
  start: { icon: <Martini className="size-4" />, ring: "border-cream-400/50" },
  progress: { icon: null, ring: "border-bar-600" },
  challenge: { icon: <Sparkles className="size-4 text-brass-400" />, ring: "border-brass-500/60" },
  setback: { icon: <TriangleAlert className="size-4 text-danger-400" />, ring: "border-danger-400/60" },
  bonus: { icon: <Gift className="size-4 text-mint-400" />, ring: "border-mint-400/60" },
  checkpoint: { icon: <ShieldCheck className="size-4 text-brass-400" />, ring: "border-brass-400" },
  finish: { icon: <Flag className="size-4 text-brass-400" />, ring: "border-brass-400" },
};

export default function BoardStrip({ game, meId }: { game: Game; meId?: string }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const me = game.players.find((p) => p.id === meId);

  // Keep my token in view as I move.
  useEffect(() => {
    if (!me || !scrollerRef.current) return;
    const el = scrollerRef.current.querySelector<HTMLElement>(`[data-pos="${me.position}"]`);
    el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [me, me?.position]);

  return (
    <div ref={scrollerRef} className="overflow-x-auto pb-2" role="img" aria-label="Game board">
      <div className="flex w-max gap-2 px-1">
        {game.tiles.map((tile) => {
          const here = game.players.filter((p) => p.position === tile.position);
          const style = TILE_STYLE[tile.type];
          return (
            <div
              key={tile.position}
              data-pos={tile.position}
              className={`relative flex h-24 w-20 shrink-0 flex-col justify-between rounded-xl border bg-bar-800 p-1.5 ${style.ring}`}
            >
              <div className="flex items-center justify-between text-[10px] text-cream-400">
                <span>{tile.position + 1}</span>
                {style.icon}
              </div>
              <p className="text-[10px] leading-tight text-cream-100">{tile.title}</p>
              <div className="flex h-6 items-end gap-0.5">
                {here.map((p) => (
                  <motion.span
                    key={p.id}
                    layoutId={`token-${p.id}`}
                    transition={{ type: "spring", stiffness: 250, damping: 22 }}
                    className={`text-lg leading-none ${p.id === meId ? "drop-shadow-[0_0_6px_#f0c268]" : ""}`}
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
