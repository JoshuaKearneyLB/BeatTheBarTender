"use client";

// Chalk up the board: name the month, pick a house style, set the pace and
// the PIN. Tile-by-tile work happens in the Board Builder once it's open.

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Dice5, Loader2, ShieldCheck, Trophy } from "lucide-react";
import PixelToken from "@/components/PixelToken";
import { BOARD_TEMPLATES, generateCampaignBoard, templateDeck } from "@/lib/board";
import { DEFAULT_BADGE, PRIZE_BADGES } from "@/lib/tokens";
import { isDemoMode } from "@/lib/supabase/client";
import { createCampaignLive } from "@/lib/supabase/db";

export default function ManagerSetup() {
  const router = useRouter();
  const [name, setName] = useState("Monthly Marathon");
  const [boardLength, setBoardLength] = useState(30);
  const [preset, setPreset] = useState("cocktail_focus");
  const [autoApprove, setAutoApprove] = useState(false);
  const [pin, setPin] = useState("");
  const [prizeTitle, setPrizeTitle] = useState("Monthly Winner: £250 Cash + Weekend Off");
  const [prizeDescription, setPrizeDescription] = useState(
    "First past Last Call with a manager sign-off takes the cash and gets first pick of next month's shifts.",
  );
  const [prizeBadge, setPrizeBadge] = useState(DEFAULT_BADGE);
  const [campaignDays, setCampaignDays] = useState(30);
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
        prize: {
          title: prizeTitle,
          description: prizeDescription,
          badge: prizeBadge,
          campaignDays,
        },
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

  const field = "field w-full";

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
                className={`pos-key border-2 p-3 text-left ${
                  preset === t.key
                    ? "border-brass-400 bg-brass-500/15"
                    : "border-bar-600 bg-bar-900"
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
          className={`pos-key flex w-full items-center gap-3 border-2 p-3 text-left ${
            autoApprove ? "border-mint-400 bg-mint-400/15" : "border-bar-600 bg-bar-900"
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

        {/* the prize */}
        <div className="space-y-2">
          <span className="chalk flex items-center gap-2 text-xl text-cream-400">
            <Trophy className="size-4 text-brass-400" /> what are they playing for?
          </span>
          <div className="panel">
            <div className="panel-head">
              <span>On the wall</span>
              <span>the crew see this</span>
            </div>
            <div className="space-y-2 p-3">
              <input
                value={prizeTitle}
                onChange={(e) => setPrizeTitle(e.target.value)}
                aria-label="Prize title"
                className="field w-full"
                required
              />
              <div className="space-y-1">
                <span className="ticket text-[10px] text-cream-400">Badge</span>
                <div className="flex flex-wrap gap-1.5">
                  {PRIZE_BADGES.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => setPrizeBadge(b.id)}
                      aria-pressed={prizeBadge === b.id}
                      aria-label={b.name}
                      className={`pos-key border-2 p-1.5 ${
                        prizeBadge === b.id
                          ? "border-brass-400 bg-brass-500/25"
                          : "border-bar-600 bg-bar-900"
                      }`}
                    >
                      <PixelToken id={b.id} pool={PRIZE_BADGES} size={22} />
                    </button>
                  ))}
                </div>
              </div>
              <textarea
                value={prizeDescription}
                onChange={(e) => setPrizeDescription(e.target.value)}
                rows={3}
                aria-label="Prize description"
                className="field w-full"
              />
              <label className="flex items-center gap-2">
                <span className="ticket text-[10px] text-cream-400">runs for</span>
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={campaignDays}
                  onChange={(e) => setCampaignDays(Number(e.target.value) || 30)}
                  aria-label="Campaign days"
                  className="field w-20"
                />
                <span className="ticket text-[10px] text-cream-400">days</span>
              </label>
            </div>
          </div>
        </div>

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
