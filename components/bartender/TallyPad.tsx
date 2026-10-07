"use client";

// The bartender's surface: tonight's drink on a thermal receipt with the
// count, and one big till key under the thumb. Register-click audio and
// haptics on every punch; a small undo key for mis-taps.

import { useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Minus, Plus } from "lucide-react";
import type { Race, Racer } from "@/lib/types";

interface TallyPadProps {
  race: Race;
  racer: Racer;
  onRingIn: (delta: 1 | -1) => void;
}

export default function TallyPad({ race, racer, onRingIn }: TallyPadProps) {
  const audioRef = useRef<AudioContext | null>(null);
  const toGo = race.target - racer.count;
  const winner = race.racers.find((r) => r.id === race.winnerId);

  /** Register click: short square-wave blip, pitched up for +, down for −. */
  function click(freq: number) {
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
      g.gain.setValueAtTime(0.07, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.07);
    } catch {
      // no audio? the counter still counts
    }
  }

  function punch(delta: 1 | -1) {
    onRingIn(delta);
    if (navigator.vibrate) navigator.vibrate(delta > 0 ? 12 : 6);
    click(delta > 0 ? 1400 : 620);
  }

  if (race.status === "finished") {
    const iWon = winner?.id === racer.id;
    return (
      <section className="receipt receipt-edge px-5 pb-6 pt-5 text-center" data-testid="race-over">
        <p className="ticket text-[10px] text-ink-900/60">★ final receipt ★</p>
        <span className={`stamp mt-3 text-2xl ${iWon ? "[color:#177a3e]" : "[color:#a3540e]"}`}>
          {iWon ? "Winner" : "Race over"}
        </span>
        <h2 className="display mt-3 text-4xl leading-none text-ink-900">
          {iWon ? "You sold it first." : `${winner?.name ?? "Someone"} took it.`}
        </h2>
        <p className="chalk mt-1 text-xl text-ink-900/70">
          {iWon
            ? "the manager checks the till at close — then it's yours."
            : `you finished on ${racer.count}. next race, eh.`}
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      {/* the receipt */}
      <div className="receipt receipt-edge px-4 pb-5 pt-4">
        <p className="ticket text-center text-[10px] tracking-[0.25em] text-ink-900/60">
          ★ tonight&apos;s race ★
        </p>
        <div className="mt-1.5 border-t-4 border-double border-ink-900/50" />
        <p className="ticket mt-2 text-[10px] text-ink-900/60">First to {race.target} wins</p>
        <h2 data-testid="race-drink" className="display mt-1 text-4xl leading-[0.95] text-ink-900">
          {race.drinkName}
        </h2>

        <div className="mt-3 flex items-end justify-between border-t border-dashed border-ink-900/40 pt-2">
          <div className="flex items-baseline gap-2">
            <span className="relative h-12 w-20 overflow-hidden">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={racer.count}
                  data-testid="my-count"
                  initial={{ y: -34, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 34, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 700, damping: 40 }}
                  className="display absolute inset-0 text-5xl tabular-nums text-ink-900"
                >
                  {racer.count}
                </motion.span>
              </AnimatePresence>
            </span>
            <span className="ticket text-xs text-ink-900/60">of {race.target}</span>
          </div>
          <p className="ticket pb-1.5 text-[10px] text-ink-900/70">{toGo} to go</p>
        </div>
      </div>

      {/* the keys */}
      <div className="flex items-stretch gap-3">
        <button
          aria-label="Undo one"
          onClick={() => punch(-1)}
          disabled={racer.count === 0}
          className="pos-key flex w-16 items-center justify-center border-2 border-bar-600 bg-bar-700 text-cream-400 disabled:opacity-40"
        >
          <Minus className="size-5" />
        </button>
        <button
          aria-label="Sold one"
          onClick={() => punch(1)}
          className="pos-key display flex flex-1 items-center justify-center gap-2 border-2 border-brass-400 bg-brass-500 py-5 text-3xl text-bar-950"
        >
          <Plus className="size-7" /> Sold one
        </button>
      </div>
      <p className="chalk text-center text-lg text-cream-400">
        honest counts — they get checked against the till at close
      </p>
    </section>
  );
}
