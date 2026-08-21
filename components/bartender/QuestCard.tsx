"use client";

// The bartender's surface: tonight's goal printed on a thermal receipt
// (torn edge and all), with physical till keys underneath — clicker punch
// for the count, one till photo, send for sign-off. Register-click audio
// and haptics on every punch.

import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Camera, Minus, Plus, Send } from "lucide-react";
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
      <section className="receipt receipt-edge px-5 pb-6 pt-5 text-center">
        <p className="ticket text-[10px] text-ink-900/60">★ final receipt ★</p>
        <span className="stamp mt-3 text-2xl text-mint-400 [color:#177a3e]">Paid in full</span>
        <h2 className="display mt-3 text-4xl leading-none text-ink-900">Last call. You won.</h2>
        <p className="chalk mt-1 text-xl text-ink-900/70">the board&apos;s yours. so&apos;s the bragging.</p>
      </section>
    );
  }

  if (player.awaitingApproval) {
    return (
      <section className="receipt receipt-edge px-5 pb-6 pt-5 text-center">
        <p className="ticket text-[10px] text-ink-900/60">★ order of the day ★</p>
        <span className="stamp mt-3 text-xl [color:#a3540e]">On the spike</span>
        <h2 className="display mt-3 text-2xl leading-none text-ink-900">
          Waiting on manager sign-off
        </h2>
        <p className="chalk mt-2 text-xl leading-tight text-ink-900/70">
          “{goal.label}” — you move the second they sign it
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      {/* the receipt */}
      <div className="receipt receipt-edge px-4 pb-5 pt-4">
        <p className="ticket text-center text-[10px] tracking-[0.25em] text-ink-900/60">
          ★ order of the day ★
        </p>
        <div className="mt-1.5 border-t-4 border-double border-ink-900/50" />
        <p className="ticket mt-2 text-[10px] text-ink-900/60">
          Tile {player.position + 1} — {tile.title}
          {tile.moveValue > 1 && <span className="font-bold"> · worth {tile.moveValue} tiles</span>}
        </p>
        <h2 data-testid="goal-label" className="display mt-1 text-4xl leading-[0.95] text-ink-900">
          {goal.label}
        </h2>

        <div className="mt-3 flex items-end justify-between border-t border-dashed border-ink-900/40 pt-2">
          {isTask ? (
            <p className="ticket text-xs text-ink-900/80">
              {done ? "[x] job done" : "[ ] job not done yet"}
            </p>
          ) : (
            <>
              <div className="flex items-baseline gap-2">
                <span className="relative h-12 w-16 overflow-hidden">
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.span
                      key={player.progress}
                      data-testid="goal-count"
                      initial={{ y: -34, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: 34, opacity: 0 }}
                      transition={{ type: "spring", stiffness: 700, damping: 40 }}
                      className={`display absolute inset-0 text-5xl tabular-nums ${done ? "[color:#177a3e]" : "text-ink-900"}`}
                    >
                      {player.progress}
                    </motion.span>
                  </AnimatePresence>
                </span>
                <span className="ticket text-xs text-ink-900/60">of {goal.target}</span>
              </div>
              {goal.target <= 14 && (
                <div className="flex max-w-28 flex-wrap justify-end gap-1 pb-1.5">
                  {Array.from({ length: goal.target }).map((_, i) => (
                    <span
                      key={i}
                      className={`size-2 ${i < player.progress ? (done ? "bg-[#177a3e]" : "bg-ink-900") : "border border-ink-900/40"}`}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
        {!done && player.progress > 0 && (
          <p className="ticket mt-1 text-[10px] text-[#a02c2c]">
            !! under count — they&apos;ll clock it !!
          </p>
        )}
      </div>

      {/* the keys */}
      {isTask ? (
        <button
          onClick={() => punch(done ? -goal.target : goal.target)}
          aria-pressed={done}
          className={`pos-key display flex w-full items-center justify-center gap-2 border-2 px-4 py-4 text-2xl transition-colors ${
            done
              ? "border-mint-400 bg-mint-400/15 text-mint-400"
              : "border-bar-600 bg-bar-700 text-cream-400"
          }`}
        >
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
          <button
            aria-label="Increase progress"
            onClick={() => punch(1)}
            className="pos-key display flex flex-1 items-center justify-center gap-2 border-2 border-brass-400 bg-brass-500/20 py-4 text-3xl text-brass-400"
          >
            <Plus className="size-7" /> Ring one in
          </button>
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={() => (photo ? setPhoto(null) : fileRef.current?.click())}
          className={`pos-key display flex flex-1 items-center justify-center gap-2 border-2 px-3 py-3 text-xl transition-colors ${
            photo
              ? "border-mint-400 bg-mint-400/10 text-mint-400"
              : "border-bar-600 bg-bar-700 text-cream-400"
          }`}
        >
          <Camera className="size-4" />
          {photo ? "Till shot on — tap to bin" : "Snap the till"}
        </button>
      </div>
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Anything the manager should know?"
        maxLength={140}
        className="w-full rounded-md border-2 border-bar-600 bg-bar-950 px-3 py-2.5 text-sm text-cream-100 outline-none placeholder:text-cream-400 focus:border-brass-500"
      />
      <button
        disabled={player.progress === 0}
        onClick={submit}
        className="pos-key display flex w-full items-center justify-center gap-2 border-2 border-brass-400 bg-brass-500 px-4 py-3.5 text-2xl text-bar-950 disabled:opacity-40"
      >
        <Send className="size-5" />
        Send for sign-off
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
