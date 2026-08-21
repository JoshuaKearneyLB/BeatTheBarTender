"use client";

// Bartender mobile view: live board on top, event ticker, speed-tally pad
// pinned within thumb reach at the bottom.

import { use } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import BoardStrip from "@/components/board/BoardStrip";
import EventTicker from "@/components/board/EventTicker";
import TallyPad from "@/components/bartender/TallyPad";
import { useGame } from "@/lib/useGame";
import { isDemoMode } from "@/lib/supabase/client";
import type { ActionDef } from "@/lib/types";

export default function GamePage({ params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = use(params);
  const { game, events, actions, tally, undo } = useGame(gameId);
  const me = game.players[0]; // demo: you are player 1; auth wires this in v0.2

  function handleTally(action: ActionDef, receipt?: File) {
    // Demo mode keeps the File local; Supabase mode uploads it to the
    // 'receipts' bucket and stores the path on the action_logs row.
    tally(me.id, action, receipt ? URL.createObjectURL(receipt) : undefined);
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-4 py-4">
      <header className="flex items-center justify-between">
        <Link href="/" className="flex items-center gap-1 text-sm text-cream-400">
          <ArrowLeft className="size-4" /> {game.name}
        </Link>
        {isDemoMode() && (
          <span className="rounded-full border border-brass-500/50 px-2 py-0.5 text-xs text-brass-400">
            Demo Mode
          </span>
        )}
      </header>

      <section>
        <BoardStrip game={game} meId={me.id} />
      </section>

      <section className="min-h-20 rounded-xl border border-bar-600 bg-bar-800 p-3">
        <EventTicker events={events} />
      </section>

      <div className="mt-auto pb-2">
        <TallyPad
          game={game}
          player={me}
          actions={actions}
          onTally={handleTally}
          onUndo={() => undo(me.id)}
        />
      </div>
    </main>
  );
}
