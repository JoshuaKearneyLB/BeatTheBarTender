"use client";

// Chalk up the board: name the month, pick a house style, set the pace and
// the PIN. Tile-by-tile work happens in the Board Builder once it's open.

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Dice5, Loader2, ShieldCheck } from "lucide-react";
import { BOARD_TEMPLATES, generateCampaignBoard, templateDeck } from "@/lib/board";
import { isDemoMode } from "@/lib/supabase/client";
import { createCampaignLive } from "@/lib/supabase/db";

export default function ManagerSetup() {
  const router = useRouter();
  const [name, setName] = useState("Monthly Marathon");
  const [boardLength, setBoardLength] = useState(30);
  const [preset, setPreset] = useState("cocktail_focus");
  const [autoApprove, setAutoApprove] = useState(false);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createCampaign(e: React.FormEvent) {
    e.preventDefault();
    if (isDemoMode()) {
      router.push("/manager/demo");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const seed = Math.floor(Math.random() * 2 ** 31);
      const gameId = await createCampaignLive({
        name,
        boardLength,
        preset,
        autoApprove,
        pin,
        tiles: generateCampaignBoard(boardLength, preset, seed),
        cards: templateDeck(preset),
      });
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
    "w-full rounded-md border-2 border-bar-600 bg-bar-950 px-3 py-3 text-cream-100 outline-none focus:border-brass-500";

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-6 px-6 py-6">
      <Link href="/" className="flex items-center gap-1 text-sm text-cream-400">
        <ArrowLeft className="size-4" /> Front door
      </Link>
      <h1 className="display -rotate-1 text-5xl leading-none text-brass-400 [text-shadow:3px_3px_0_rgba(0,0,0,0.6)]">
        Chalk up the board
      </h1>

      <form onSubmit={createCampaign} className="space-y-5">
        <label className="block space-y-1">
          <span className="chalk text-xl text-cream-400">what&apos;s the month called?</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className={field} required />
        </label>

        <div className="space-y-2">
          <span className="chalk text-xl text-cream-400">house style</span>
          <div className="grid gap-2 sm:grid-cols-2">
            {BOARD_TEMPLATES.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setPreset(t.key)}
                aria-pressed={preset === t.key}
                className={`rounded-sm border-2 p-3 text-left transition-all ${
                  preset === t.key
                    ? "slab -rotate-1 border-brass-400 bg-bar-800"
                    : "border-bar-600 bg-bar-800/60"
                }`}
              >
                <span className="display block text-2xl leading-none text-brass-400">{t.label}</span>
                <span className="chalk text-lg leading-tight text-cream-400">{t.blurb}</span>
              </button>
            ))}
          </div>
        </div>

        <label className="block space-y-1">
          <span className="chalk text-xl text-cream-400">{boardLength} tiles on the board</span>
          <input
            type="range"
            min={20}
            max={40}
            value={boardLength}
            onChange={(e) => setBoardLength(Number(e.target.value))}
            className="w-full accent-brass-500"
          />
        </label>

        <button
          type="button"
          onClick={() => setAutoApprove((v) => !v)}
          aria-pressed={autoApprove}
          className={`flex w-full items-center gap-3 rounded-sm border-2 p-3 text-left transition-colors ${
            autoApprove ? "border-mint-400 bg-mint-400/10" : "border-bar-600 bg-bar-800"
          }`}
        >
          <ShieldCheck className={`size-5 ${autoApprove ? "text-mint-400" : "text-cream-400"}`} />
          <span className="flex-1">
            <span className="display block text-xl leading-none">
              Honor system {autoApprove ? "on" : "off"}
            </span>
            <span className="chalk text-lg leading-tight text-cream-400">
              {autoApprove
                ? "counts clear themselves — except Last Call. you always sign the win."
                : "every count waits on your sign-off."}
            </span>
          </span>
        </button>

        <label className="block space-y-1">
          <span className="chalk text-xl text-cream-400">manager PIN — sign-offs & bumps</span>
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

        <p className="chalk text-lg text-cream-400/80">
          tile-by-tile work — setbacks, checkpoints, cards — is in the Board Builder once
          the board&apos;s open.
        </p>

        {error && <p className="text-sm text-danger-400">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="pos-key display flex w-full items-center justify-center gap-2 border-2 border-brass-400 bg-brass-500 px-4 py-3 text-2xl text-bar-950 disabled:opacity-50"
        >
          {busy ? <Loader2 className="size-5 animate-spin" /> : <Dice5 className="size-5" />}
          {busy ? "Chalking it up…" : "Open the board"}
        </button>
      </form>
    </main>
  );
}
