"use client";

// The primary bartender surface: three thumb-sized speed-tally buttons,
// optional receipt attach for the next tap, one-tap undo, and progress
// toward the next tile. Built for one-handed use in a dark, loud bar.

import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Camera, CheckCircle2, Undo2 } from "lucide-react";
import type { ActionDef, Game, Player } from "@/lib/types";

interface TallyPadProps {
  game: Game;
  player: Player;
  actions: ActionDef[];
  onTally: (action: ActionDef, receipt?: File) => void;
  onUndo: () => void;
}

interface Burst {
  id: number;
  label: string;
}

export default function TallyPad({ game, player, actions, onTally, onUndo }: TallyPadProps) {
  const [attachNext, setAttachNext] = useState(false);
  const [bursts, setBursts] = useState<Burst[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const pendingAction = useRef<ActionDef | null>(null);
  const burstId = useRef(0);

  const locked = player.awaitingApproval || player.finished;
  const toNext = game.actionsPerTile - player.progress;
  const totalTaps = Object.values(player.tally).reduce((a, b) => a + b, 0);

  function fire(action: ActionDef, receipt?: File) {
    onTally(action, receipt);
    if (navigator.vibrate) navigator.vibrate(12);
    const id = ++burstId.current;
    setBursts((b) => [...b, { id, label: `+${action.units} ${action.emoji}` }]);
    setTimeout(() => setBursts((b) => b.filter((x) => x.id !== id)), 900);
  }

  function handleTap(action: ActionDef) {
    if (locked) return;
    if (attachNext) {
      // Open the native camera; the tally logs when the photo lands.
      pendingAction.current = action;
      fileRef.current?.click();
      return;
    }
    fire(action);
  }

  function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const action = pendingAction.current;
    pendingAction.current = null;
    e.target.value = "";
    setAttachNext(false);
    if (action) fire(action, file ?? undefined);
  }

  return (
    <section className="relative">
      {/* floating +1 bursts */}
      <div className="pointer-events-none absolute inset-x-0 -top-2 z-10 flex justify-center">
        <AnimatePresence>
          {bursts.map((b) => (
            <motion.span
              key={b.id}
              initial={{ opacity: 0, y: 8, scale: 0.8 }}
              animate={{ opacity: 1, y: -22, scale: 1.1 }}
              exit={{ opacity: 0, y: -40 }}
              transition={{ duration: 0.5 }}
              className="absolute text-lg font-bold text-brass-400"
            >
              {b.label}
            </motion.span>
          ))}
        </AnimatePresence>
      </div>

      {/* progress to next tile */}
      <div className="mb-3 flex items-center justify-between text-sm text-cream-400">
        <span>
          {locked
            ? player.finished
              ? "Shift won — cash out! 🏆"
              : "Waiting on manager check…"
            : `${toNext} more to advance a tile`}
        </span>
        <span>{totalTaps} logged</span>
      </div>
      <div className="mb-4 h-2 overflow-hidden rounded-full bg-bar-700">
        <motion.div
          className="h-full rounded-full bg-brass-500"
          animate={{ width: `${(player.progress / game.actionsPerTile) * 100}%` }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        />
      </div>

      {/* speed-tally buttons */}
      <div className="grid grid-cols-3 gap-3">
        {actions.map((action) => (
          <motion.button
            key={action.type}
            whileTap={{ scale: 0.92 }}
            disabled={locked}
            onClick={() => handleTap(action)}
            className="flex min-h-28 flex-col items-center justify-center gap-1 rounded-2xl border border-bar-600 bg-bar-700 px-2 py-4 shadow-lg shadow-black/30 transition-colors active:border-brass-500 disabled:opacity-40"
          >
            <span className="text-3xl">{action.emoji}</span>
            <span className="text-sm font-semibold leading-tight">+{action.units} {action.label}</span>
            <span className="text-xs text-cream-400">{player.tally[action.type]} this shift</span>
          </motion.button>
        ))}
      </div>

      {/* receipt attach + undo */}
      <div className="mt-3 flex gap-3">
        <button
          onClick={() => setAttachNext((v) => !v)}
          className={`flex flex-1 items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-medium transition-colors ${
            attachNext
              ? "border-brass-500 bg-brass-500/15 text-brass-400"
              : "border-bar-600 bg-bar-800 text-cream-400"
          }`}
        >
          {attachNext ? <CheckCircle2 className="size-4" /> : <Camera className="size-4" />}
          {attachNext ? "Camera opens on next tap" : "Attach receipt to next tap"}
        </button>
        <button
          onClick={onUndo}
          className="flex items-center justify-center gap-2 rounded-xl border border-bar-600 bg-bar-800 px-4 py-3 text-sm font-medium text-cream-400"
        >
          <Undo2 className="size-4" /> Undo
        </button>
      </div>

      {/* native camera capture, hidden */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handlePhoto}
      />
    </section>
  );
}
