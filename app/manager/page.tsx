"use client";

// Shift setup: name the game, size the board, set the pace and manager PIN.
// Demo mode routes straight into a seeded session.

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Dice5, Loader2 } from "lucide-react";
import { isDemoMode } from "@/lib/supabase/client";
import { createGameLive } from "@/lib/supabase/db";

export default function ManagerSetup() {
  const router = useRouter();
  const [name, setName] = useState("Friday Night Shift");
  const [boardLength, setBoardLength] = useState(30);
  const [actionsPerTile, setActionsPerTile] = useState(3);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createGame(e: React.FormEvent) {
    e.preventDefault();
    if (isDemoMode()) {
      router.push("/manager/demo");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const gameId = await createGameLive({ name, boardLength, actionsPerTile, pin });
      try {
        sessionStorage.setItem("baropoly.manager-pin", pin);
      } catch {}
      router.push(`/manager/${gameId}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  const field =
    "w-full rounded-xl border border-bar-600 bg-bar-800 px-3 py-3 text-cream-100 outline-none focus:border-brass-500";

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-6 py-6">
      <Link href="/" className="flex items-center gap-1 text-sm text-cream-400">
        <ArrowLeft className="size-4" /> Home
      </Link>
      <h1 className="text-2xl font-bold text-brass-400">Set up the shift</h1>

      <form onSubmit={createGame} className="space-y-4">
        <label className="block space-y-1">
          <span className="text-sm text-cream-400">Game name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className={field} required />
        </label>
        <label className="block space-y-1">
          <span className="text-sm text-cream-400">Board length: {boardLength} tiles</span>
          <input
            type="range"
            min={20}
            max={40}
            value={boardLength}
            onChange={(e) => setBoardLength(Number(e.target.value))}
            className="w-full accent-brass-500"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-sm text-cream-400">
            Sales per tile: {actionsPerTile} (winning ≈ {boardLength * actionsPerTile} tallies)
          </span>
          <input
            type="range"
            min={1}
            max={10}
            value={actionsPerTile}
            onChange={(e) => setActionsPerTile(Number(e.target.value))}
            className="w-full accent-brass-500"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-sm text-cream-400">Manager PIN (approvals & overrides)</span>
          <input
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="••••"
            className={field}
          />
        </label>

        {error && <p className="text-sm text-danger-400">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-brass-500 px-4 py-3 font-semibold text-bar-900 transition-colors hover:bg-brass-400 disabled:opacity-50"
        >
          {busy ? <Loader2 className="size-5 animate-spin" /> : <Dice5 className="size-5" />}
          {busy ? "Setting up…" : "Start the game"}
        </button>
      </form>
    </main>
  );
}
