"use client";

// Manager console: live board, the 1-tap batch approval queue (submissions
// with their till photos via short-lived signed URLs), player roster with
// overrides, and review history. In live mode every review/override sends
// the PIN, verified server-side in the database.

import { use, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronUp,
  ImageIcon,
  KeyRound,
  Loader2,
  WifiOff,
  X,
} from "lucide-react";
import BoardStrip from "@/components/board/BoardStrip";
import EventTicker from "@/components/board/EventTicker";
import { useGame } from "@/lib/useGame";
import type { QuestSubmission } from "@/lib/types";

const PIN_KEY = "baropoly.manager-pin";

function PhotoButton({
  submission,
  resolve,
}: {
  submission: QuestSubmission;
  resolve: (s: QuestSubmission) => Promise<string | null>;
}) {
  const [busy, setBusy] = useState(false);
  if (!submission.photoPath && !submission.photoUrl) {
    return <span className="text-xs text-cream-400">no photo</span>;
  }
  return (
    <button
      aria-label="View photo"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const url = await resolve(submission);
          if (url) window.open(url, "_blank", "noopener");
        } finally {
          setBusy(false);
        }
      }}
      className="flex items-center gap-1 rounded-lg border border-brass-500/50 px-2 py-1 text-xs text-brass-400 disabled:opacity-50"
    >
      {busy ? <Loader2 className="size-3.5 animate-spin" /> : <ImageIcon className="size-3.5" />}
      photo
    </button>
  );
}

export default function ManagerConsole({ params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = use(params);
  const { mode, error, game, submissions, events, review, override, photoUrl } = useGame(gameId);
  const [pin, setPin] = useState("");
  const [deselected, setDeselected] = useState<Set<string>>(new Set());

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

  const pending = submissions.filter((s) => s.status === "pending");
  const selectedIds = pending.filter((s) => !deselected.has(s.id)).map((s) => s.id);
  const history = submissions.filter((s) => s.status !== "pending").slice(0, 12);

  function toggle(id: string) {
    setDeselected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function runReview(approve: boolean) {
    review(selectedIds, approve, pin);
    setDeselected(new Set());
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
            {mode === "demo" ? "Demo Mode" : game.autoApprove ? "Live · auto-trust" : "Live"}
          </span>
        </div>
      </header>

      <BoardStrip game={game} />

      <section className="rounded-xl border border-bar-600 bg-bar-800 p-3">
        <EventTicker events={events} />
      </section>

      {/* approval queue */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-brass-400">
            Approval queue{pending.length > 0 && ` · ${pending.length}`}
          </h2>
          {pending.length > 0 && (
            <div className="flex gap-2">
              <button
                onClick={() => runReview(true)}
                disabled={selectedIds.length === 0}
                className="flex items-center gap-1 rounded-lg border border-mint-400 bg-mint-400/10 px-3 py-1.5 text-sm font-medium text-mint-400 disabled:opacity-40"
              >
                <Check className="size-4" /> Approve {selectedIds.length}
              </button>
              <button
                onClick={() => runReview(false)}
                disabled={selectedIds.length === 0}
                className="flex items-center gap-1 rounded-lg border border-danger-400 bg-danger-400/10 px-3 py-1.5 text-sm font-medium text-danger-400 disabled:opacity-40"
              >
                <X className="size-4" /> Reject
              </button>
            </div>
          )}
        </div>
        {pending.length === 0 && (
          <p className="text-sm text-cream-400">
            Queue is clear. {game.autoApprove ? "Auto-trust is handling non-winning quests." : ""}
          </p>
        )}
        <ul className="space-y-1">
          {pending.map((s) => {
            const player = game.players.find((p) => p.id === s.playerId);
            const tile = game.tiles[s.tilePosition];
            const short = tile && s.claimedValue < tile.goal.target;
            return (
              <li
                key={s.id}
                className="flex items-center gap-3 rounded-lg border border-bar-600 bg-bar-800 px-3 py-2"
              >
                <input
                  type="checkbox"
                  checked={!deselected.has(s.id)}
                  onChange={() => toggle(s.id)}
                  aria-label={`Select submission from ${player?.name}`}
                  className="size-4 accent-brass-500"
                />
                <span className="text-xl">{player?.token}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">
                    <span className="font-medium">{player?.name}</span>
                    <span className="text-cream-400"> · {tile?.goal.label}</span>
                  </p>
                  <p className="text-xs text-cream-400">
                    claims{" "}
                    <span className={short ? "text-danger-400" : "text-mint-400"}>
                      {s.claimedValue}/{tile?.goal.target}
                    </span>
                    {s.note && <span> · “{s.note}”</span>}
                  </p>
                </div>
                <PhotoButton submission={s} resolve={photoUrl} />
              </li>
            );
          })}
        </ul>
      </section>

      {/* roster + overrides */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-brass-400">Players</h2>
        {game.players.length === 0 && (
          <p className="text-sm text-cream-400">
            No players yet — bartenders join at <span className="text-cream-100">/game/{gameId}</span>
          </p>
        )}
        {game.players.map((p) => (
          <div
            key={p.id}
            className="flex items-center gap-3 rounded-xl border border-bar-600 bg-bar-800 px-3 py-2"
          >
            <span className="text-2xl">{p.token}</span>
            <div className="flex-1">
              <p className="font-medium">
                {p.name}
                {p.awaitingApproval && (
                  <span className="ml-2 text-xs text-brass-400">in queue</span>
                )}
                {p.finished && <span className="ml-2 text-xs text-brass-400">🏆 winner</span>}
              </p>
              <p className="text-xs text-cream-400">
                Tile {p.position + 1}/{game.boardLength} ·{" "}
                {game.tiles[p.position]?.goal.label ?? ""}
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
            </div>
          </div>
        ))}
      </section>

      {/* review history */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-brass-400">History</h2>
        {history.length === 0 && (
          <p className="text-sm text-cream-400">No reviewed submissions yet.</p>
        )}
        <ul className="space-y-1">
          {history.map((s) => {
            const player = game.players.find((p) => p.id === s.playerId);
            return (
              <li
                key={s.id}
                className="flex items-center gap-2 rounded-lg border border-bar-600 bg-bar-800 px-3 py-2 text-sm"
              >
                <span>{player?.token}</span>
                <span className="min-w-0 flex-1 truncate text-cream-400">
                  {player?.name} · tile {s.tilePosition + 1} · claimed {s.claimedValue}
                </span>
                <span className={s.status === "approved" ? "text-mint-400" : "text-danger-400"}>
                  {s.status}
                </span>
                <time className="text-xs text-cream-400">
                  {new Date(s.submittedAt).toLocaleTimeString([], {
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
