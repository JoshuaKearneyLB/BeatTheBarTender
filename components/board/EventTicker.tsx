"use client";

// Shift banter, scrawled in chalk under the board — newest line brightest.

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

const TILT = ["-rotate-1", "rotate-0", "rotate-1"];

export default function EventTicker({ events }: { events: BoardEvent[] }) {
  return (
    <ul className="chalk space-y-0.5 text-xl leading-tight">
      <AnimatePresence initial={false}>
        {events.slice(0, 4).map((e, i) => (
          <motion.li
            key={`${e.message}-${events.length - i}`}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: i === 0 ? 1 : 0.45 }}
            exit={{ opacity: 0 }}
            className={`${KIND_COLOR[e.kind]} ${TILT[i % TILT.length]}`}
          >
            {e.message}
          </motion.li>
        ))}
      </AnimatePresence>
      {events.length === 0 && (
        <li className="-rotate-1 text-cream-400">board&apos;s open — get pouring!</li>
      )}
    </ul>
  );
}
