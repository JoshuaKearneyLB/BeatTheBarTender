"use client";

// Who's ahead: one row per racer, winner first, with a chalk progress bar
// toward the target. The manager console passes `controls` to put the
// till-check keys on each row.

import type { ReactNode } from "react";
import PixelToken from "@/components/PixelToken";
import { standings } from "@/lib/race";
import type { Race, Racer } from "@/lib/types";

export default function Leaderboard({
  race,
  meId,
  controls,
}: {
  race: Race;
  meId?: string;
  controls?: (racer: Racer) => ReactNode;
}) {
  const rows = standings(race);
  if (rows.length === 0) {
    return <p className="chalk text-xl text-cream-400">nobody&apos;s in yet. send them the link.</p>;
  }
  return (
    <ol className="space-y-1.5" data-testid="leaderboard">
      {rows.map((r, i) => {
        const won = r.id === race.winnerId;
        const pct = Math.round((r.count / race.target) * 100);
        return (
          <li
            key={r.id}
            className={`flex items-center gap-3 border-2 bg-black px-3 py-2 shadow-[3px_3px_0_rgba(0,0,0,0.85)] ${
              won ? "border-brass-400" : r.id === meId ? "border-cream-400" : "border-bar-600"
            }`}
          >
            <span className="numerals w-5 text-center text-sm text-cream-400">{won ? "★" : i + 1}</span>
            <span className={`chip size-8 shrink-0 ${r.id === meId ? "chip-mine" : ""}`}>
              <PixelToken id={r.token} size={20} title={r.name} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex items-baseline justify-between gap-2">
                <span className="display truncate text-xl">
                  {r.name}
                  {won && <span className="chalk ml-2 text-base text-brass-400">winner</span>}
                </span>
                <span className="numerals shrink-0 text-sm">
                  {r.count}
                  <span className="text-cream-400">/{race.target}</span>
                </span>
              </p>
              <div className="mt-1 h-1.5 bg-bar-700" aria-hidden>
                <div
                  className={`h-full transition-[width] duration-500 ${won ? "bg-brass-400" : "bg-cream-100/70"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
            {controls?.(r)}
          </li>
        );
      })}
    </ol>
  );
}
