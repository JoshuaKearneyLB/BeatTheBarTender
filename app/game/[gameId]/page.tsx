"use client";

// Bartender view: the track, the leaderboard, the ticker, and the till key
// within thumb reach. The trophy in the header opens what they're racing for.

import { use, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Trophy, WifiOff } from "lucide-react";
import { motion } from "framer-motion";
import EventTicker from "@/components/race/EventTicker";
import Leaderboard from "@/components/race/Leaderboard";
import PrizeModal from "@/components/race/PrizeModal";
import RaceTrack from "@/components/race/RaceTrack";
import JoinCard from "@/components/bartender/JoinCard";
import TallyPad from "@/components/bartender/TallyPad";
import { demoSetupFromParams } from "@/lib/demoSetup";
import { useRace } from "@/lib/useRace";

export default function RacePage({
  params,
  searchParams,
}: {
  params: Promise<{ gameId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { gameId } = use(params);
  const demoSetup = demoSetupFromParams(use(searchParams));
  const { mode, error, race, events, me, join, ringIn } = useRace(gameId, demoSetup);
  const [prizeOpen, setPrizeOpen] = useState(false);

  if (mode === "connecting") {
    return (
      <main className="chalk flex min-h-dvh items-center justify-center gap-2 text-2xl text-cream-400">
        <Loader2 className="size-5 animate-spin" /> getting you on the bar…
      </main>
    );
  }
  if (mode === "error" || !race) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
        <WifiOff className="size-8 text-danger-400" />
        <p className="text-danger-400">{error ?? "Race is down. Check the wifi behind the till."}</p>
        <Link href="/" className="text-sm text-cream-400 underline">
          Back to the front door
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-3 px-4 py-4">
      <header className="flex items-center justify-between gap-2">
        <Link href="/" className="flex min-w-0 items-center gap-1.5 text-cream-400">
          <ArrowLeft className="size-4 shrink-0" />
          <span className="display truncate text-xl">{race.name}</span>
        </Link>
        <div className="flex shrink-0 items-center gap-2">
          <motion.button
            data-testid="prize-trophy"
            aria-label="What you're racing for"
            onClick={() => setPrizeOpen(true)}
            whileTap={{ scale: 0.9 }}
            animate={{
              filter: [
                "drop-shadow(0 0 3px rgba(255,185,46,0.5))",
                "drop-shadow(0 0 12px rgba(255,185,46,0.95))",
                "drop-shadow(0 0 3px rgba(255,185,46,0.5))",
              ],
            }}
            transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
            className="pos-key border-2 border-brass-400 bg-brass-500/20 p-1.5 text-brass-400"
          >
            <Trophy className="size-5" />
          </motion.button>
          <span className="stamp text-xs text-brass-400">{mode === "demo" ? "Demo" : "Live"}</span>
        </div>
      </header>

      <RaceTrack race={race} meId={me?.id} />

      <section className="min-h-12 px-1">
        <EventTicker events={events} lines={3} />
      </section>

      <div className="pb-1">
        {me ? (
          <TallyPad race={race} racer={me} onRingIn={ringIn} />
        ) : (
          <JoinCard gameName={race.name} onJoin={join} />
        )}
      </div>

      <section className="space-y-2 pb-4">
        <h2 className="display text-2xl text-brass-400">The board</h2>
        <Leaderboard race={race} meId={me?.id} />
      </section>

      <PrizeModal
        prize={race.prize}
        target={race.target}
        drinkName={race.drinkName}
        open={prizeOpen}
        onClose={() => setPrizeOpen(false)}
      />
    </main>
  );
}
