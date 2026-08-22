"use client";

// The manager's clipboard: the board, the sign-off queue (counts with till
// shots via short-lived signed URLs), the roster with bump/knock-back keys,
// and the book of settled counts. In live mode every sign-off and bump
// sends the PIN, checked server-side in the database.

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
import BoardBuilder from "@/components/manager/BoardBuilder";
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
    return <span className="ticket text-[10px] text-ink-900/50">no till shot</span>;
  }
  return (
    <button
      aria-label="View till shot"
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
      className="ticket flex items-center gap-1 border-2 border-ink-900/60 px-2 py-1 text-[10px] text-ink-900 disabled:opacity-50"
    >
      {busy ? <Loader2 className="size-3.5 animate-spin" /> : <ImageIcon className="size-3.5" />}
      till shot
    </button>
  );
}

export default function ManagerConsole({ params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = use(params);
  const {
    mode,
    error,
    game,
    submissions,
    events,
    review,
    override,
    photoUrl,
    updateTile,
    applyTemplate,
    saveCard,
    deleteCard,
    updatePrize,
  } = useGame(gameId);
  const [pin, setPin] = useState("");
  const [tab, setTab] = useState<"floor" | "builder">("floor");
  const [deselected, setDeselected] = useState<Set<string>>(new Set());

  // PIN sticks for the session so it's typed once per shift.
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
      <main className="chalk flex min-h-dvh items-center justify-center gap-2 text-2xl text-cream-400">
        <Loader2 className="size-5 animate-spin" /> clocking you in…
      </main>
    );
  }
  if (mode === "error" || !game) {
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
        <Link href="/" className="flex items-center gap-1.5 text-cream-400">
          <ArrowLeft className="size-4" />
          <span className="display text-xl">{game.name} · gaffer</span>
        </Link>
        <div className="flex items-center gap-2">
          {mode === "live" && (
            <label className="ticket flex items-center gap-1 border-2 border-bar-600 bg-black px-2 py-1">
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
          <span className="stamp text-xs text-brass-400">
            {mode === "demo" ? "Demo Mode" : game.autoApprove ? "Live · honor system" : "Live"}
          </span>
        </div>
      </header>

      {/* which side of the bar are we on */}
      <nav className="flex gap-1 border-b-2 border-bar-600">
        {(
          [
            ["floor", `The floor${pending.length ? ` · ${pending.length}` : ""}`],
            ["builder", "Board builder"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            aria-pressed={tab === key}
            className={`tab display px-3 py-1.5 text-xl ${tab === key ? "tab-on" : ""}`}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === "builder" ? (
        <BoardBuilder
          game={game}
          pin={pin}
          onUpdateTile={updateTile}
          onApplyTemplate={applyTemplate}
          onSaveCard={saveCard}
          onDeleteCard={deleteCard}
          onUpdatePrize={updatePrize}
        />
      ) : (
        <>
      <BoardStrip game={game} />

      <section className="px-1">
        <EventTicker events={events} />
      </section>

      {/* sign-off queue */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="display text-2xl text-brass-400">
            Sign-off queue{pending.length > 0 && ` · ${pending.length}`}
          </h2>
          {pending.length > 0 && (
            <div className="flex gap-2">
              <button
                onClick={() => runReview(true)}
                disabled={selectedIds.length === 0}
                className="pos-key display flex items-center gap-1 border-2 border-mint-400 bg-mint-400/10 px-3 py-1.5 text-lg text-mint-400 disabled:opacity-40"
              >
                <Check className="size-4" /> Sign off {selectedIds.length}
              </button>
              <button
                onClick={() => runReview(false)}
                disabled={selectedIds.length === 0}
                className="pos-key display flex items-center gap-1 border-2 border-danger-400 bg-danger-400/10 px-3 py-1.5 text-lg text-danger-400 disabled:opacity-40"
              >
                <X className="size-4" /> Bin it
              </button>
            </div>
          )}
        </div>
        {pending.length === 0 && (
          <p className="chalk text-xl text-cream-400">
            nothing on the spike.{" "}
            {game.autoApprove ? "honor system's running the floor — you only sign the win." : ""}
          </p>
        )}
        <ul className="space-y-4">
          {pending.map((s) => {
            const player = game.players.find((p) => p.id === s.playerId);
            const tile = game.tiles[s.tilePosition];
            const short = tile && s.claimedValue < tile.goal.target;
            return (
              <li
                key={s.id}
                className="receipt receipt-edge receipt-edge-top flex items-center gap-3 px-3 py-2.5"
              >
                <input
                  type="checkbox"
                  checked={!deselected.has(s.id)}
                  onChange={() => toggle(s.id)}
                  aria-label={`Select count from ${player?.name}`}
                  className="size-4 accent-brass-500"
                />
                <span className="text-xl">{player?.token}</span>
                <div className="min-w-0 flex-1 text-ink-900">
                  <p className="truncate text-sm">
                    <span className="display text-lg">{player?.name}</span>
                    <span className="text-ink-900/60"> · {tile?.goal.label}</span>
                  </p>
                  <p className="ticket text-[10px] text-ink-900/70">
                    says{" "}
                    <span className={`font-bold ${short ? "text-[#a02c2c]" : "text-[#177a3e]"}`}>
                      {s.claimedValue} of {tile?.goal.target}
                    </span>
                    {s.note && <span className="normal-case tracking-normal"> · “{s.note}”</span>}
                  </p>
                </div>
                <PhotoButton submission={s} resolve={photoUrl} />
              </li>
            );
          })}
        </ul>
      </section>

      {/* the roster */}
      <section className="space-y-2">
        <h2 className="display text-2xl text-brass-400">The roster</h2>
        {game.players.length === 0 && (
          <p className="text-sm text-cream-400">
            Empty bar. Crew clocks in at <span className="text-cream-100">/game/{gameId}</span>
          </p>
        )}
        {game.players.map((p) => (
          <div
            key={p.id}
            className="flex items-center gap-3 border-2 border-bar-600 bg-black px-3 py-2 shadow-[3px_3px_0_rgba(0,0,0,0.85)]"
          >
            <span className="text-2xl">{p.token}</span>
            <div className="flex-1">
              <p className="display text-xl">
                {p.name}
                {p.awaitingApproval && (
                  <span className="chalk ml-2 text-base text-brass-400">← waiting on you</span>
                )}
                {p.finished && (
                  <span className="chalk ml-2 text-base text-brass-400">rang last call 🏆</span>
                )}
              </p>
              <p className="text-xs text-cream-400">
                Tile {p.position + 1}/{game.boardLength} ·{" "}
                {game.tiles[p.position]?.goal.label ?? ""}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                aria-label={`Bump ${p.name} up`}
                onClick={() => override(p.id, 1, "earned it, seen it myself", pin)}
                className="pos-key border-2 border-bar-600 bg-bar-900 p-2 text-mint-400"
              >
                <ChevronUp className="size-4" />
              </button>
              <button
                aria-label={`Knock ${p.name} back`}
                onClick={() => override(p.id, -2, "caught slacking on fruit prep", pin)}
                className="pos-key border-2 border-bar-600 bg-bar-900 p-2 text-danger-400"
              >
                <ChevronDown className="size-4" />
              </button>
            </div>
          </div>
        ))}
      </section>

      {/* the book */}
      <section className="space-y-2 pb-4">
        <h2 className="display text-2xl text-brass-400">The book</h2>
        {history.length === 0 && (
          <p className="chalk text-xl text-cream-400">nothing in the book yet.</p>
        )}
        <ul className="space-y-1.5">
          {history.map((s) => {
            const player = game.players.find((p) => p.id === s.playerId);
            return (
              <li
                key={s.id}
                className="flex items-center gap-2 border-b border-dashed border-bar-600 px-1 py-2 text-sm"
              >
                <span>{player?.token}</span>
                <span className="min-w-0 flex-1 truncate text-cream-400">
                  {player?.name} · tile {s.tilePosition + 1} · said {s.claimedValue}
                </span>
                <span
                  className={`stamp text-sm ${s.status === "approved" ? "text-mint-400" : "text-danger-400"}`}
                >
                  {s.status === "approved" ? "signed off" : "binned"}
                </span>
                <time className="ticket text-[10px] text-cream-400">
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
        </>
      )}
    </main>
  );
}
