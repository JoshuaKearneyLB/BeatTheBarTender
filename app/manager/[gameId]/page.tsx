"use client";

// Manager console: live board, player roster with totals, audit feed of
// logged actions (with receipt thumbnails when attached), and override
// controls — manual advance, "Failed Audit" setback, win approval.

import { use } from "react";
import Link from "next/link";
import { ArrowLeft, BadgeCheck, ChevronDown, ChevronUp, ReceiptText } from "lucide-react";
import BoardStrip from "@/components/board/BoardStrip";
import EventTicker from "@/components/board/EventTicker";
import { useGame } from "@/lib/useGame";
import { isDemoMode } from "@/lib/supabase/client";

export default function ManagerConsole({ params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = use(params);
  const { game, log, events, override, approve } = useGame(gameId);

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-4 px-4 py-4">
      <header className="flex items-center justify-between">
        <Link href="/" className="flex items-center gap-1 text-sm text-cream-400">
          <ArrowLeft className="size-4" /> {game.name} · Manager
        </Link>
        {isDemoMode() && (
          <span className="rounded-full border border-brass-500/50 px-2 py-0.5 text-xs text-brass-400">
            Demo Mode
          </span>
        )}
      </header>

      <BoardStrip game={game} />

      <section className="rounded-xl border border-bar-600 bg-bar-800 p-3">
        <EventTicker events={events} />
      </section>

      {/* roster + overrides */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-brass-400">Players</h2>
        {game.players.map((p) => {
          const total = Object.values(p.tally).reduce((a, b) => a + b, 0);
          return (
            <div
              key={p.id}
              className="flex items-center gap-3 rounded-xl border border-bar-600 bg-bar-800 px-3 py-2"
            >
              <span className="text-2xl">{p.token}</span>
              <div className="flex-1">
                <p className="font-medium">
                  {p.name}
                  {p.awaitingApproval && (
                    <span className="ml-2 text-xs text-brass-400">awaiting approval</span>
                  )}
                </p>
                <p className="text-xs text-cream-400">
                  Tile {p.position + 1}/{game.boardLength} · {total} logged
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  aria-label={`Advance ${p.name}`}
                  onClick={() => override(p.id, 1, "Manual advance")}
                  className="rounded-lg border border-bar-600 p-2 text-mint-400"
                >
                  <ChevronUp className="size-4" />
                </button>
                <button
                  aria-label={`Set back ${p.name}`}
                  onClick={() => override(p.id, -2, "Failed Audit")}
                  className="rounded-lg border border-bar-600 p-2 text-danger-400"
                >
                  <ChevronDown className="size-4" />
                </button>
                {p.awaitingApproval && (
                  <button
                    aria-label={`Approve ${p.name}`}
                    onClick={() => approve(p.id)}
                    className="rounded-lg border border-brass-500 bg-brass-500/15 p-2 text-brass-400"
                  >
                    <BadgeCheck className="size-4" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </section>

      {/* audit feed */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-brass-400">Audit feed</h2>
        {log.length === 0 && (
          <p className="text-sm text-cream-400">No actions logged yet this shift.</p>
        )}
        <ul className="space-y-1">
          {log.slice(0, 20).map((entry) => {
            const player = game.players.find((p) => p.id === entry.playerId);
            return (
              <li
                key={entry.id}
                className={`flex items-center gap-2 rounded-lg border border-bar-600 bg-bar-800 px-3 py-2 text-sm ${entry.voided ? "opacity-40 line-through" : ""}`}
              >
                <span>{player?.token}</span>
                <span className="flex-1">
                  {player?.name} · +{entry.units} {entry.actionType.replace("_", " ")}
                </span>
                {entry.receiptUrl ? (
                  <a href={entry.receiptUrl} target="_blank" className="text-brass-400">
                    <ReceiptText className="size-4" />
                  </a>
                ) : (
                  <span className="text-xs text-cream-400">no receipt</span>
                )}
                <time className="text-xs text-cream-400">
                  {new Date(entry.createdAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </time>
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}
