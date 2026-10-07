"use client";

// The live feed: an industrial LED marquee behind the bar. Mono, uppercase,
// glowing, newest line brightest — the older lines dim like a board that
// hasn't refreshed yet.

import { motion } from "framer-motion";
import type { RaceEvent } from "@/lib/types";

const KIND_COLOR: Record<RaceEvent["kind"], string> = {
  sale: "text-cream-100",
  undo: "text-danger-400",
  win: "text-brass-400",
  correction: "text-mint-400",
  join: "text-cream-400",
};

export default function EventTicker({
  events,
  lines = 4,
}: {
  events: RaceEvent[];
  lines?: number;
}) {
  return (
    <div className="feed px-2 py-1.5">
      <ul className="space-y-0.5 text-[10px] leading-[1.5]">
          {events.slice(0, lines).map((e, i) => (
            <motion.li
              key={e.id ?? `${e.message}-${i}`}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: i === 0 ? 1 : 0.42 }}
              className={`feed-line flex gap-1.5 ${KIND_COLOR[e.kind]}`}
            >
              <span aria-hidden className="shrink-0 opacity-60">
                {i === 0 ? "▶" : "·"}
              </span>
              <span className="min-w-0">{e.message}</span>
            </motion.li>
          ))}
        {events.length === 0 && (
          <li className="feed-line flex gap-1.5 text-cream-400">
            <span aria-hidden className="opacity-60">
              ▶
            </span>
            <span>race is on — get pouring</span>
          </li>
        )}
      </ul>
    </div>
  );
}
