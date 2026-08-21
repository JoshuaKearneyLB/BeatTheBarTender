"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { BoardEvent } from "@/lib/types";

const KIND_COLOR: Record<BoardEvent["kind"], string> = {
  advance: "text-cream-100",
  bonus: "text-mint-400",
  setback: "text-danger-400",
  checkpoint: "text-brass-400",
  win: "text-brass-400",
  override: "text-cream-400",
  join: "text-cream-400",
};

/** The last few board events, newest on top — the bar's play-by-play. */
export default function EventTicker({ events }: { events: BoardEvent[] }) {
  return (
    <ul className="space-y-1 text-sm">
      <AnimatePresence initial={false}>
        {events.slice(0, 4).map((e, i) => (
          <motion.li
            key={`${e.message}-${events.length - i}`}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: i === 0 ? 1 : 0.55 }}
            exit={{ opacity: 0 }}
            className={KIND_COLOR[e.kind]}
          >
            {e.message}
          </motion.li>
        ))}
      </AnimatePresence>
      {events.length === 0 && (
        <li className="text-cream-400">Board&apos;s open. Get pouring.</li>
      )}
    </ul>
  );
}
