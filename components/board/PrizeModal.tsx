"use client";

// What they're playing for. A golden ticket pinned over a black room —
// heavy amber rule, perforated edges, nothing soft anywhere.

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import PixelToken from "@/components/PixelToken";
import { PRIZE_BADGES } from "@/lib/tokens";
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
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/97 p-4"
        >
          <motion.div
            initial={{ scale: 0.95, y: 16 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.97, y: 10 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            className="my-auto w-full max-w-md border-4 border-brass-400 bg-black shadow-[6px_6px_0_rgba(255,185,46,0.28)]"
          >
            {/* stamped header rail */}
            <div className="flex items-center justify-between bg-brass-400 px-3 py-1.5">
              <span className="ticket text-[10px] font-bold text-bar-950">★ the prize ★</span>
              <button
                aria-label="Close the prize"
                onClick={onClose}
                className="pos-key border-2 border-bar-950/40 bg-bar-950 p-1 text-brass-400"
              >
                <X className="size-3.5" />
              </button>
            </div>

            <div className="px-6 py-6 text-center">
              <motion.div
                animate={{ scale: [1, 1.07, 1] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                className="mx-auto w-fit drop-shadow-[0_0_26px_rgba(255,185,46,0.65)]"
              >
                <PixelToken id={prize.badge} pool={PRIZE_BADGES} size={88} />
              </motion.div>

              <h2
                data-testid="prize-title"
                className="display mt-4 text-[2.6rem] leading-[0.9] text-brass-400 [text-shadow:4px_4px_0_rgba(0,0,0,1)]"
              >
                {prize.title}
              </h2>

              {prize.description && (
                <p className="chalk mx-auto mt-3 max-w-sm text-xl leading-snug text-cream-100">
                  {prize.description}
                </p>
              )}
            </div>

            {/* perforation */}
            <div className="border-t-4 border-dashed border-brass-400/60" />

            <div className="bg-bar-950 px-6 py-4 text-center">
              <p className="ticket text-[10px] text-brass-400">How you take it</p>
              <p className="numerals mt-2 text-sm leading-relaxed text-cream-100">
                {boardLength} TILES · FIRST TO LAST CALL · MANAGER SIGN-OFF
              </p>
              <p className="chalk mt-1 text-lg text-cream-400">no sign-off, no prize.</p>
              <button
                onClick={onClose}
                className="pos-key display mt-4 w-full border-2 border-brass-400 bg-brass-500 py-3 text-2xl text-bar-950"
              >
                Back to the board
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
