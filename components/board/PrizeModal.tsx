"use client";

// What they're playing for. Full-screen, high contrast, one job: make the
// prize feel worth chasing. Rendered as a prize poster pinned over the bar.

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import type { Prize } from "@/lib/types";

interface PrizeModalProps {
  prize: Prize;
  boardLength: number;
  open: boolean;
  onClose: () => void;
}

export default function PrizeModal({ prize, boardLength, open, onClose }: PrizeModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label="The prize"
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-bar-950/95 p-5"
        >
          <motion.div
            initial={{ scale: 0.94, y: 18, rotate: -1.5 }}
            animate={{ scale: 1, y: 0, rotate: -1 }}
            exit={{ scale: 0.96, y: 12 }}
            transition={{ type: "spring", stiffness: 300, damping: 26 }}
            onClick={(e) => e.stopPropagation()}
            className="slab my-auto w-full max-w-md border-4 border-brass-400 bg-bar-800 p-6 text-center"
          >
            <div className="flex items-start justify-between">
              <p className="ticket text-[10px] text-brass-400">★ on the wall ★</p>
              <button
                aria-label="Close the prize"
                onClick={onClose}
                className="rounded border-2 border-bar-600 p-1.5 text-cream-400"
              >
                <X className="size-4" />
              </button>
            </div>

            <motion.div
              animate={{ scale: [1, 1.06, 1] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
              className="mx-auto mt-2 text-7xl drop-shadow-[0_0_22px_rgba(255,185,46,0.5)]"
            >
              {prize.badge}
            </motion.div>

            <h2
              data-testid="prize-title"
              className="display mt-3 text-4xl leading-[0.95] text-brass-400 [text-shadow:3px_3px_0_rgba(0,0,0,0.6)]"
            >
              {prize.title}
            </h2>

            {prize.description && (
              <p className="chalk mx-auto mt-3 max-w-sm text-xl leading-snug text-cream-100">
                {prize.description}
              </p>
            )}

            <div className="mt-5 border-t-2 border-dashed border-bar-600 pt-4">
              <p className="ticket text-[10px] text-cream-400">How you take it</p>
              <p className="chalk mt-1 text-lg leading-snug text-cream-400">
                clear all {boardLength} tiles, be first to Last Call, and get the
                gaffer&apos;s sign-off. no sign-off, no prize.
              </p>
            </div>

            <button
              onClick={onClose}
              className="pos-key display mt-5 w-full border-2 border-brass-400 bg-brass-500 py-3 text-2xl text-bar-950"
            >
              Back to the board
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
