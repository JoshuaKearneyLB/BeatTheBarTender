"use client";

// Manager console: live board, player roster with totals, audit feed of
// logged actions (receipt photos open via short-lived signed URLs), and
// override controls. In live mode every override/approval sends the PIN,
// which is verified server-side in the database.

import { use, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BadgeCheck,
  ChevronDown,
  ChevronUp,
  KeyRound,
  Loader2,
  ReceiptText,
  WifiOff,
} from "lucide-react";
import BoardStrip from "@/components/board/BoardStrip";
import EventTicker from "@/components/board/EventTicker";
import { useGame } from "@/lib/useGame";
import type { LoggedAction } from "@/lib/types";

const PIN_KEY = "baropoly.manager-pin";

function ReceiptButton({
  entry,
  resolve,
}: {
  entry: LoggedAction;
  resolve: (entry: LoggedAction) => Promise<string | null>;
}) {
  const [busy, setBusy] = useState(false);
  if (!entry.receiptPath && !entry.receiptUrl) {
    return <span className="text-xs text-cream-400">no receipt</span>;
  }
  return (
    <button
      aria-label="View receipt"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const url = await resolve(entry);
          if (url) window.open(url, "_blank", "noopener");
        } finally {
          setBusy(false);
        }
      }}
      className="text-brass-400 disabled:opacity-50"
    >
      {busy ? <Loader2 className="size-4 animate-spin" /> : <ReceiptText className="size-4" />}
    </button>
  );
}

export default function ManagerConsole({ params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = use(params);
  const { mode, error, game, log, events, override, approve, receiptUrl } = useGame(gameId);
  const [pin, setPin] = useState("");

  // Remember the PIN for this browser session so it's typed once per shift.
  useEffect(() => {
    try {
      setPin(sessionStorage.getItem(PIN_KEY) ?? "");
    } catch {}
  }, []);
  function updatePin(value: string) {
    setPin(value);
    try {
      sessionStorage.setItem(PIN_KEY, value);
    } catch {}
  }

  if (mode === "connecting") {
    return (
      <main className="flex min-h-dvh items-center justify-center gap-2 text-cream-400">
        <Loader2 className="size-5 animate-spin" /> Connecting to the shift…
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
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-4 px-4 py-4">
      <header className="flex items-center justify-between gap-3">
        <Link href="/" className="flex items-center gap-1 text-sm text-cream-400">
          <ArrowLeft className="size-4" /> {game.name} · Manager
        </Link>
        <div className="flex items-center gap-2">
          {mode === "live" && (
            <label className="flex items-center gap-1 rounded-full border border-bar-600 bg-bar-800 px-2 py-1">
              <KeyRound className="size-3.5 text-brass-400" />
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={pin}
                onChange={(e) => updatePin(e.target.value)}
                placeholder="PIN"
                aria-label="Manager PIN"
                className="w-14 bg-transparent text-xs text-cream-100 outline-none placeholder:text-cream-400"
              />
            </label>
          )}
          <span className="rounded-full border border-brass-500/50 px-2 py-0.5 text-xs text-brass-400">
            {mode === "demo" ? "Demo Mode" : "Live"}
          </span>
        </div>
      </header>

      <BoardStrip game={game} />

      <section className="rounded-xl border border-bar-600 bg-bar-800 p-3">
        <EventTicker events={events} />
      </section>

      {/* roster + overrides */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-brass-400">Players</h2>
        {game.players.length === 0 && (
          <p className="text-sm text-cream-400">
            No players yet — bartenders join at <span className="text-cream-100">/game/{gameId}</span>
          </p>
        )}
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
                  {p.finished && <span className="ml-2 text-xs text-brass-400">🏆 winner</span>}
                </p>
                <p className="text-xs text-cream-400">
                  Tile {p.position + 1}/{game.boardLength} · {total} logged
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  aria-label={`Advance ${p.name}`}
                  onClick={() => override(p.id, 1, "Manual advance", pin)}
                  className="rounded-lg border border-bar-600 p-2 text-mint-400"
                >
                  <ChevronUp className="size-4" />
                </button>
                <button
                  aria-label={`Set back ${p.name}`}
                  onClick={() => override(p.id, -2, "Failed Audit", pin)}
                  className="rounded-lg border border-bar-600 p-2 text-danger-400"
                >
                  <ChevronDown className="size-4" />
                </button>
                {p.awaitingApproval && (
                  <button
                    aria-label={`Approve ${p.name}`}
                    onClick={() => approve(p.id, pin)}
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
                <ReceiptButton entry={entry} resolve={receiptUrl} />
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
