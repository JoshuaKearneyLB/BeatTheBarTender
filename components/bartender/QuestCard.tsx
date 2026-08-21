"use client";

// The primary bartender surface: the active quest for the current tile,
// a big progress stepper toward its target (or a done-toggle for tasks),
// a single shift-summary/till photo, and submit-for-verification.

import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { Camera, CheckCircle2, Hourglass, Minus, Plus, Send, Trophy } from "lucide-react";
import type { Game, Player } from "@/lib/types";

interface QuestCardProps {
  game: Game;
  player: Player;
  onBumpProgress: (delta: number) => void;
  onSubmit: (opts?: { photo?: File; note?: string }) => void;
}

export default function QuestCard({ game, player, onBumpProgress, onSubmit }: QuestCardProps) {
  const [photo, setPhoto] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const tile = game.tiles[player.position];
  const goal = tile.goal;
  const isTask = goal.type === "task";
  const done = player.progress >= goal.target;

  if (player.finished) {
    return (
      <section className="rounded-2xl border border-brass-500 bg-brass-500/10 p-6 text-center">
        <Trophy className="mx-auto size-10 text-brass-400" />
        <h2 className="mt-2 text-xl font-bold text-brass-400">You won the marathon!</h2>
        <p className="text-sm text-cream-400">Take a bow — and maybe the tip jar.</p>
      </section>
    );
  }

  if (player.awaitingApproval) {
    return (
      <section className="rounded-2xl border border-bar-600 bg-bar-800 p-6 text-center">
        <Hourglass className="mx-auto size-8 animate-pulse text-brass-400" />
        <h2 className="mt-2 font-semibold text-brass-400">Pending approval</h2>
        <p className="mt-1 text-sm text-cream-400">
          “{goal.label}” is with the manager. You&apos;ll move the moment it&apos;s approved.
        </p>
      </section>
    );
  }

  function submit() {
    onSubmit({ photo: photo ?? undefined, note: note.trim() || undefined });
    setPhoto(null);
    setNote("");
  }

  return (
    <section className="space-y-3 rounded-2xl border border-bar-600 bg-bar-800 p-4 shadow-lg shadow-black/30">
      {/* active quest */}
      <div>
        <p className="text-xs uppercase tracking-wider text-cream-400">
          Tile {player.position + 1} · {tile.title}
          {tile.moveValue > 1 && (
            <span className="ml-2 rounded-full border border-brass-500/60 px-1.5 text-brass-400">
              worth {tile.moveValue} tiles
            </span>
          )}
        </p>
        <h2 className="mt-1 text-lg font-semibold text-cream-100">{goal.label}</h2>
      </div>

      {/* progress stepper / task toggle */}
      {isTask ? (
        <button
          onClick={() => onBumpProgress(done ? -goal.target : goal.target)}
          aria-pressed={done}
          className={`flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-4 font-medium transition-colors ${
            done
              ? "border-mint-400 bg-mint-400/10 text-mint-400"
              : "border-bar-600 bg-bar-900 text-cream-400"
          }`}
        >
          <CheckCircle2 className="size-5" />
          {done ? "Done — ready to submit" : "Mark task complete"}
        </button>
      ) : (
        <div className="flex items-center gap-3">
          <motion.button
            whileTap={{ scale: 0.9 }}
            aria-label="Decrease progress"
            onClick={() => onBumpProgress(-1)}
            className="flex size-14 items-center justify-center rounded-xl border border-bar-600 bg-bar-900 text-cream-400"
          >
            <Minus className="size-5" />
          </motion.button>
          <div className="flex-1 text-center">
            <p className="text-3xl font-bold text-brass-400">
              {player.progress}
              <span className="text-lg text-cream-400"> / {goal.target}</span>
            </p>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-bar-700">
              <motion.div
                className={`h-full rounded-full ${done ? "bg-mint-400" : "bg-brass-500"}`}
                animate={{ width: `${Math.min(100, (player.progress / goal.target) * 100)}%` }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              />
            </div>
          </div>
          <motion.button
            whileTap={{ scale: 0.9 }}
            aria-label="Increase progress"
            onClick={() => onBumpProgress(1)}
            className="flex size-14 items-center justify-center rounded-xl border border-brass-500 bg-brass-500/15 text-brass-400"
          >
            <Plus className="size-6" />
          </motion.button>
        </div>
      )}

      {/* photo + note */}
      <div className="flex gap-2">
        <button
          onClick={() => (photo ? setPhoto(null) : fileRef.current?.click())}
          className={`flex flex-1 items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-medium transition-colors ${
            photo
              ? "border-mint-400 bg-mint-400/10 text-mint-400"
              : "border-bar-600 bg-bar-900 text-cream-400"
          }`}
        >
          <Camera className="size-4" />
          {photo ? "Photo attached ✓ (tap to remove)" : "Add till / shift photo"}
        </button>
      </div>
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Note for the manager (optional)"
        maxLength={140}
        className="w-full rounded-xl border border-bar-600 bg-bar-900 px-3 py-2.5 text-sm text-cream-100 outline-none placeholder:text-cream-400 focus:border-brass-500"
      />

      {/* submit */}
      <motion.button
        whileTap={{ scale: 0.97 }}
        disabled={player.progress === 0}
        onClick={submit}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-brass-500 px-4 py-3.5 font-semibold text-bar-900 transition-colors hover:bg-brass-400 disabled:opacity-40"
      >
        <Send className="size-4" />
        Submit for verification
        {!done && player.progress > 0 && (
          <span className="text-xs font-normal opacity-70">(short of target)</span>
        )}
      </motion.button>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          setPhoto(e.target.files?.[0] ?? null);
          e.target.value = "";
        }}
      />
    </section>
  );
}
