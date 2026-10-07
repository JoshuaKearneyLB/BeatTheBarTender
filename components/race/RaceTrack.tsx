"use client";

// The track: a chalkboard behind the bar with one box per drink. Every
// racer's piece sits on the box matching their count and layout-animates
// forward as they ring drinks in. The last box is Last Call.

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import PixelToken from "@/components/PixelToken";
import type { Race } from "@/lib/types";

// Chalk boxes drawn in a hurry: deterministic tilt.
const TILTS = [-1.4, 0.8, -0.6, 1.2, -1.0, 0.5];

export default function RaceTrack({ race, meId }: { race: Race; meId?: string }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const me = race.racers.find((r) => r.id === meId);

  // Keep my piece in view as I move.
  useEffect(() => {
    if (!me || !scrollerRef.current) return;
    const el = scrollerRef.current.querySelector<HTMLElement>(`[data-pos="${me.count}"]`);
    el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [me, me?.count]);

  const squares = Array.from({ length: race.target + 1 }, (_, i) => i);

  return (
    <div className="chalkboard px-2 py-3">
      <div
        ref={scrollerRef}
        className="overflow-x-auto"
        role="img"
        aria-label={`Race track: ${race.racers.map((r) => `${r.name} on ${r.count}`).join(", ")}`}
      >
        <div className="flex w-max items-stretch gap-2 px-1 py-1">
          {squares.map((pos) => {
            const here = race.racers.filter((r) => r.count === pos);
            const finish = pos === race.target;
            const start = pos === 0;
            const mine = me?.count === pos;
            return (
              <div
                key={pos}
                data-pos={pos}
                style={{ transform: `rotate(${TILTS[pos % TILTS.length]}deg)` }}
                className={`relative flex h-[5.2rem] shrink-0 flex-col justify-between border-2 border-dashed p-1.5 ${
                  finish
                    ? "w-[5.6rem] border-brass-400 text-brass-400"
                    : start
                      ? "w-[4.2rem] border-cream-100/30 text-cream-400"
                      : "w-[3.6rem] border-cream-100/30 text-cream-100/80"
                } ${mine ? "bg-cream-100/10 shadow-[0_0_16px_rgba(255,185,46,0.25)]" : ""}`}
              >
                <span className="chalk text-base leading-none">
                  {finish ? `★ ${pos}` : start ? "start" : pos}
                </span>
                {finish && <span className="chalk text-sm leading-none">last call</span>}
                <div className="flex min-h-6 flex-wrap items-end gap-0.5">
                  {here.map((r) => (
                    <motion.span
                      key={r.id}
                      layoutId={`token-${r.id}`}
                      transition={{ type: "spring", stiffness: 250, damping: 22 }}
                      className={`chip size-6 ${r.id === meId ? "chip-mine" : ""}`}
                      title={r.name}
                    >
                      <PixelToken id={r.token} size={16} title={r.name} />
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
