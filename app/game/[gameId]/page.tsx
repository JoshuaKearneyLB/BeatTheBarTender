"use client";

// Bartender mobile view: the board (as a strip or the full square), the
// chalk ticker, and the till pad within thumb reach. The trophy in the
// header opens what they're playing for.

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Trophy, WifiOff } from "lucide-react";
import { motion } from "framer-motion";
import BoardStrip from "@/components/board/BoardStrip";
import EventTicker from "@/components/board/EventTicker";
import PrizeModal from "@/components/board/PrizeModal";
import SquareBoard, { type BoardStats } from "@/components/board/SquareBoard";
import JoinCard from "@/components/bartender/JoinCard";
import QuestCard from "@/components/bartender/QuestCard";
import { useGame } from "@/lib/useGame";
import type { Game, QuestSubmission } from "@/lib/types";

const VIEW_KEY = "baropoly.board-view";

function boardStats(game: Game, submissions: QuestSubmission[]): BoardStats {
  const leader = game.players.reduce<(typeof game.players)[number] | null>(
    (best, p) => (!best || p.position > best.position ? p : best),
    null,
  );
  const elapsedDays = game.startedAt
    ? Math.floor((Date.now() - new Date(game.startedAt).getTime()) / 86_400_000)
    : 0;
  return {
    leaderName: leader?.name ?? "—",
    leaderTile: (leader?.position ?? 0) + 1,
    daysLeft: Math.max(0, game.campaignDays - elapsedDays),
    drinksSold: submissions
      .filter((s) => s.status === "approved")
      .reduce((sum, s) => sum + s.claimedValue, 0),
  };
}

export default function GamePage({ params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = use(params);
  const { mode, error, game, submissions, events, me, join, bumpProgress, submitQuest } =
    useGame(gameId);
  const [view, setView] = useState<"strip" | "square">("strip");
  const [prizeOpen, setPrizeOpen] = useState(false);

  // Remember which board the bartender prefers.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(VIEW_KEY);
      if (saved === "square" || saved === "strip") setView(saved);
    } catch {}
  }, []);
  function pickView(next: "strip" | "square") {
    setView(next);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {}
  }

  const stats = useMemo(
    () => (game ? boardStats(game, submissions) : null),
    [game, submissions],
  );

  if (mode === "connecting") {
    return (
      <main className="chalk flex min-h-dvh items-center justify-center gap-2 text-2xl text-cream-400">
        <Loader2 className="size-5 animate-spin" /> clocking you in…
      </main>
    );
  }
  if (mode === "error" || !game || !stats) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
        <WifiOff className="size-8 text-danger-400" />
        <p className="text-danger-400">{error ?? "Board's down. Check the wifi behind the till."}</p>
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
          <span className="display truncate text-xl">{game.name}</span>
        </Link>
        <div className="flex shrink-0 items-center gap-2">
          <motion.button
            data-testid="prize-trophy"
            aria-label="What you're playing for"
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
            className="rounded border-2 border-brass-400/60 bg-brass-500/15 p-1.5 text-brass-400"
          >
            <Trophy className="size-5" />
          </motion.button>
          <span className="stamp text-xs text-brass-400">
            {mode === "demo" ? "Demo Mode" : game.autoApprove ? "Live · honor system" : "Live"}
          </span>
        </div>
      </header>

      {/* which board are we looking at */}
      <nav className="flex gap-1 border-b-2 border-bar-600">
        {(
          [
            ["strip", "The rail"],
            ["square", "Full board"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => pickView(key)}
            aria-pressed={view === key}
            className={`display -mb-0.5 border-b-4 px-3 py-1.5 text-lg transition-colors ${
              view === key ? "border-brass-400 text-brass-400" : "border-transparent text-cream-400"
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      {view === "square" ? (
        <SquareBoard game={game} meId={me?.id} events={events} stats={stats} />
      ) : (
        <>
          <BoardStrip game={game} meId={me?.id} />
          <section className="min-h-16 px-1">
            <EventTicker events={events} />
          </section>
        </>
      )}

      <div className="mt-auto pb-2">
        {me ? (
          <QuestCard game={game} player={me} onBumpProgress={bumpProgress} onSubmit={submitQuest} />
        ) : (
          <JoinCard gameName={game.name} onJoin={join} />
        )}
      </div>

      <PrizeModal
        prize={game.prize}
        boardLength={game.boardLength}
        open={prizeOpen}
        onClose={() => setPrizeOpen(false)}
      />
    </main>
  );
}
