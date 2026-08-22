"use client";

// The live feed: an industrial LED marquee behind the bar. Mono, uppercase,
// glowing, newest line brightest — the older lines dim like a board that
// hasn't refreshed yet.

import { AnimatePresence, motion } from "framer-motion";
import type { BoardEvent } from "@/lib/types";

const KIND_COLOR: Record<BoardEvent["kind"], string> = {
  advance: "text-cream-100",
  bonus: "text-mint-400",
  setback: "text-danger-400",
  checkpoint: "text-brass-400",
  card: "text-brass-400",
  win: "text-brass-400",
  override: "text-cream-400",
  join: "text-cream-400",
};

export default function EventTicker({
  events,
  lines = 4,
}: {
  events: BoardEvent[];
  lines?: number;
}) {
  return (
    <div className="feed px-2 py-1.5">
      <ul className="space-y-0.5 text-[10px] leading-[1.5]">
        <AnimatePresence initial={false}>
          {events.slice(0, lines).map((e, i) => (
            <motion.li
              key={`${e.message}-${events.length - i}`}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: i === 0 ? 1 : 0.42 }}
              exit={{ opacity: 0 }}
              className={`feed-line flex gap-1.5 ${KIND_COLOR[e.kind]}`}
            >
              <span aria-hidden className="shrink-0 opacity-60">
                {i === 0 ? "▶" : "·"}
              </span>
              <span className="min-w-0">{e.message}</span>
            </motion.li>
          ))}
        </AnimatePresence>
        {events.length === 0 && (
          <li className="feed-line flex gap-1.5 text-cream-400">
            <span aria-hidden className="opacity-60">
              ▶
            </span>
            <span>board open — get pouring</span>
          </li>
        )}
      </ul>
    </div>
  );
}
