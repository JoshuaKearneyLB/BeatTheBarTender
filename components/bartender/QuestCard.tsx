"use client";

// The bartender's till pad: today's shift goal printed like a kitchen
// ticket, a mechanical counter you punch like a door-clicker (haptics +
// register click), one till photo, and send-for-sign-off. No soft progress
// bars — big honest numbers and pips.

import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
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
  const audioRef = useRef<AudioContext | null>(null);

  const tile = game.tiles[player.position];
  const goal = tile.goal;
  const isTask = goal.type === "task";
  const done = player.progress >= goal.target;

  /** Register click: short square-wave blip, pitched up for +, down for −. */
  function click(freq: number, gain = 0.07) {
    try {
      type AudioWindow = Window & { webkitAudioContext?: typeof AudioContext };
      const Ctor = window.AudioContext ?? (window as AudioWindow).webkitAudioContext;
      if (!Ctor) return;
      const ctx = (audioRef.current ??= new Ctor());
      if (ctx.state === "suspended") void ctx.resume();
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "square";
      osc.frequency.value = freq;
      g.gain.setValueAtTime(gain, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.07);
    } catch {
      // no audio? the counter still counts
    }
  }

  function punch(delta: number) {
    onBumpProgress(delta);
    if (navigator.vibrate) navigator.vibrate(delta > 0 ? 12 : 6);
    click(delta > 0 ? 1400 : 620);
  }

  function submit() {
    onSubmit({ photo: photo ?? undefined, note: note.trim() || undefined });
    setPhoto(null);
    setNote("");
    if (navigator.vibrate) navigator.vibrate([15, 40, 15]);
    click(880, 0.09);
    setTimeout(() => click(1760, 0.09), 90);
  }

  if (player.finished) {
    return (
      <section className="slab rounded-lg border-2 border-brass-400 bg-bar-800 p-6 text-center">
        <Trophy className="mx-auto size-10 text-brass-400" />
        <h2 className="ticket mt-3 text-xl font-black text-brass-400">Last call. You won.</h2>
        <p className="mt-1 text-sm text-cream-400">The board&apos;s yours. So&apos;s the bragging.</p>
      </section>
    );
  }

  if (player.awaitingApproval) {
    return (
      <section className="slab rounded-lg border-2 border-bar-600 bg-bar-800 p-6 text-center">
        <Hourglass className="mx-auto size-8 animate-pulse text-brass-400" />
        <h2 className="ticket mt-3 font-black text-brass-400">Waiting on manager sign-off</h2>
        <p className="mt-2 text-sm text-cream-400">
          “{goal.label}” is on the manager&apos;s spike. You move the second they sign it.
        </p>
      </section>
    );
  }

  return (
    <section className="slab space-y-3 rounded-lg border-2 border-bar-600 bg-bar-800 p-4">
      {/* the ticket: today's goal */}
      <div className="border-b-2 border-dashed border-bar-600 pb-3">
        <p className="ticket text-[11px] text-cream-400">
          Tile {player.position + 1} — {tile.title}
          {tile.moveValue > 1 && (
            <span className="ml-2 bg-brass-400 px-1.5 py-0.5 font-black text-bar-900">
              WORTH {tile.moveValue} TILES
            </span>
          )}
        </p>
        <h2 data-testid="goal-label" className="mt-1.5 text-xl font-black leading-tight">
          {goal.label}
        </h2>
      </div>

      {/* the clicker */}
      {isTask ? (
        <button
          onClick={() => punch(done ? -goal.target : goal.target)}
          aria-pressed={done}
          className={`pos-key flex w-full items-center justify-center gap-2 border-2 px-4 py-4 font-black uppercase tracking-wide transition-colors ${
            done
              ? "border-mint-400 bg-mint-400/15 text-mint-400"
              : "border-bar-600 bg-bar-700 text-cream-400"
          }`}
        >
          <CheckCircle2 className="size-5" />
          {done ? "Job's done" : "Job done? Punch it"}
        </button>
      ) : (
        <div className="flex items-stretch gap-3">
          <button
            aria-label="Decrease progress"
            onClick={() => punch(-1)}
            className="pos-key flex w-16 items-center justify-center border-2 border-bar-600 bg-bar-700 text-cream-400"
          >
            <Minus className="size-5" />
          </button>
          <div className="flex-1 rounded-md border-2 border-bar-600 bg-bar-950 px-3 py-2 text-center">
            <div className="ticket flex items-baseline justify-center gap-2 text-cream-400">
              <span className="relative h-11 w-16 overflow-hidden">
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span
                    key={player.progress}
                    data-testid="goal-count"
                    initial={{ y: -30, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 30, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 700, damping: 40 }}
                    className={`absolute inset-0 text-4xl font-black tabular-nums ${done ? "text-mint-400" : "text-brass-400"}`}
                  >
                    {player.progress}
                  </motion.span>
                </AnimatePresence>
              </span>
              <span className="text-sm">of {goal.target}</span>
            </div>
            {goal.target <= 14 && (
              <div className="mt-1 flex flex-wrap justify-center gap-1">
                {Array.from({ length: goal.target }).map((_, i) => (
                  <span
                    key={i}
                    className={`size-2 ${
                      i < player.progress ? (done ? "bg-mint-400" : "bg-brass-400") : "bg-bar-600"
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
          <button
            aria-label="Increase progress"
            onClick={() => punch(1)}
            className="pos-key flex w-20 items-center justify-center border-2 border-brass-500 bg-brass-500/20 text-brass-400"
          >
            <Plus className="size-7" />
          </button>
        </div>
      )}

      {/* till photo + note */}
      <button
        onClick={() => (photo ? setPhoto(null) : fileRef.current?.click())}
        className={`pos-key flex w-full items-center justify-center gap-2 border-2 px-3 py-3 text-sm font-bold uppercase tracking-wide transition-colors ${
          photo
            ? "border-mint-400 bg-mint-400/10 text-mint-400"
            : "border-bar-600 bg-bar-700 text-cream-400"
        }`}
      >
        <Camera className="size-4" />
        {photo ? "Till shot attached — tap to bin" : "Snap the till"}
      </button>
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Anything the manager should know?"
        maxLength={140}
        className="w-full rounded-md border-2 border-bar-600 bg-bar-950 px-3 py-2.5 text-sm text-cream-100 outline-none placeholder:text-cream-400 focus:border-brass-500"
      />

      {/* send it */}
      <button
        disabled={player.progress === 0}
        onClick={submit}
        className="pos-key flex w-full items-center justify-center gap-2 border-2 border-brass-400 bg-brass-500 px-4 py-3.5 font-black uppercase tracking-wide text-bar-950 disabled:opacity-40"
      >
        <Send className="size-4" />
        Send for sign-off
        {!done && player.progress > 0 && (
          <span className="text-xs font-bold normal-case opacity-70">(under count — they&apos;ll clock it)</span>
        )}
      </button>

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
