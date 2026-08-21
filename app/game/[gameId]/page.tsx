"use client";

// Bartender mobile view: live board on top, event ticker, and the active
// quest card pinned within thumb reach at the bottom. In live mode a join
// card appears until this device has a player in the game.

import { use } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, WifiOff } from "lucide-react";
import BoardStrip from "@/components/board/BoardStrip";
import EventTicker from "@/components/board/EventTicker";
import JoinCard from "@/components/bartender/JoinCard";
import QuestCard from "@/components/bartender/QuestCard";
import { useGame } from "@/lib/useGame";

export default function GamePage({ params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = use(params);
  const { mode, error, game, events, me, join, bumpProgress, submitQuest } = useGame(gameId);

  if (mode === "connecting") {
    return (
      <main className="flex min-h-dvh items-center justify-center gap-2 text-cream-400">
        <Loader2 className="size-5 animate-spin" /> Connecting to the marathon…
      </main>
    );
  }
  if (mode === "error" || !game) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
        <WifiOff className="size-8 text-danger-400" />
        <p className="text-danger-400">{error ?? "Could not load the game."}</p>
        <Link href="/" className="text-sm text-cream-400 underline">
          Back home
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-4 py-4">
      <header className="flex items-center justify-between">
        <Link href="/" className="flex items-center gap-1 text-sm text-cream-400">
          <ArrowLeft className="size-4" /> {game.name}
        </Link>
        <span className="rounded-full border border-brass-500/50 px-2 py-0.5 text-xs text-brass-400">
          {mode === "demo" ? "Demo Mode" : game.autoApprove ? "Live · auto-trust" : "Live"}
        </span>
      </header>

      <section>
        <BoardStrip game={game} meId={me?.id} />
      </section>

      <section className="min-h-20 rounded-xl border border-bar-600 bg-bar-800 p-3">
        <EventTicker events={events} />
      </section>

      <div className="mt-auto pb-2">
        {me ? (
          <QuestCard game={game} player={me} onBumpProgress={bumpProgress} onSubmit={submitQuest} />
        ) : (
          <JoinCard gameName={game.name} onJoin={join} />
        )}
      </div>
    </main>
  );
}
