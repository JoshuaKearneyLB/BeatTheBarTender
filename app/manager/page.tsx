"use client";

// Open a race in under a minute: pick the drink, set the number, say what
// the winner gets. That's the whole setup.

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Flag, Loader2, Trophy } from "lucide-react";
import PixelToken from "@/components/PixelToken";
import { CATEGORY_LABELS, MENU, type MenuCategory } from "@/lib/recipes";
import { DEFAULT_BADGE, PRIZE_BADGES } from "@/lib/tokens";
import { isDemoMode } from "@/lib/supabase/client";
import { createRaceLive } from "@/lib/supabase/db";
import { demoSetupQuery } from "@/lib/demoSetup";

const OTHER = "__other__";
const TARGETS = [10, 20, 30];
const CATEGORIES = Object.keys(CATEGORY_LABELS) as MenuCategory[];

export default function NewRace() {
  const router = useRouter();
  const [name, setName] = useState("Friday Night Race");
  const [drinkId, setDrinkId] = useState("hacien-pineapple-spritz");
  const [customDrink, setCustomDrink] = useState("");
  const [target, setTarget] = useState(20);
  const [prizeTitle, setPrizeTitle] = useState("£50 bar tab");
  const [prizeBadge, setPrizeBadge] = useState(DEFAULT_BADGE);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const drinkName =
    drinkId === OTHER ? customDrink.trim() : (MENU.find((d) => d.id === drinkId)?.name ?? "");

  async function openRace(e: React.FormEvent) {
    e.preventDefault();
    if (isDemoMode()) {
      const query = demoSetupQuery({ name, drinkName, target, prizeTitle, badge: prizeBadge });
      router.push(`/manager/demo${query}`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const raceId = await createRaceLive({
        name,
        drinkName,
        target,
        prizeTitle,
        prizeBadge,
        pin,
      });
      try {
        sessionStorage.setItem("baropoly.manager-pin", pin);
      } catch {}
      router.push(`/manager/${raceId}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-6 py-6">
      <Link href="/" className="flex items-center gap-1 text-sm text-cream-400">
        <ArrowLeft className="size-4" /> Front door
      </Link>
      <h1 className="display -rotate-1 text-5xl leading-none text-brass-400 [text-shadow:3px_3px_0_rgba(0,0,0,0.6)]">
        Start a race
      </h1>

      <form onSubmit={openRace} className="space-y-5">
        <label className="block space-y-1">
          <span className="chalk text-xl text-cream-400">1 · what are they selling?</span>
          <select
            value={drinkId}
            onChange={(e) => setDrinkId(e.target.value)}
            aria-label="Drink"
            className="field w-full"
          >
            {CATEGORIES.map((c) => (
              <optgroup key={c} label={CATEGORY_LABELS[c]}>
                {MENU.filter((d) => d.category === c).map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </optgroup>
            ))}
            <option value={OTHER}>Something else…</option>
          </select>
          {drinkId === OTHER && (
            <input
              value={customDrink}
              onChange={(e) => setCustomDrink(e.target.value)}
              placeholder="e.g. Espresso Martini, large glass of wine"
              aria-label="Custom drink"
              maxLength={60}
              className="field mt-2 w-full"
              required
            />
          )}
        </label>

        <div className="space-y-1">
          <span className="chalk text-xl text-cream-400">2 · first to how many?</span>
          <div className="flex gap-2">
            {TARGETS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTarget(t)}
                aria-pressed={target === t}
                className={`pos-key display flex-1 border-2 py-2 text-3xl ${
                  target === t
                    ? "border-brass-400 bg-brass-500 text-bar-950"
                    : "border-bar-600 bg-bar-900 text-cream-100"
                }`}
              >
                {t}
              </button>
            ))}
            <input
              type="number"
              min={3}
              max={200}
              value={target}
              onChange={(e) => setTarget(Math.max(3, Math.min(200, Number(e.target.value) || 3)))}
              aria-label="Target"
              className="field w-20 text-center"
            />
          </div>
        </div>

        <div className="space-y-2">
          <span className="chalk flex items-center gap-2 text-xl text-cream-400">
            <Trophy className="size-4 text-brass-400" /> 3 · what does the winner get?
          </span>
          <input
            value={prizeTitle}
            onChange={(e) => setPrizeTitle(e.target.value)}
            aria-label="Prize"
            className="field w-full"
            required
          />
          <div className="flex flex-wrap gap-1.5">
            {PRIZE_BADGES.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => setPrizeBadge(b.id)}
                aria-pressed={prizeBadge === b.id}
                aria-label={b.name}
                className={`pos-key border-2 p-1.5 ${
                  prizeBadge === b.id ? "border-brass-400 bg-brass-500/25" : "border-bar-600 bg-bar-900"
                }`}
              >
                <PixelToken id={b.id} pool={PRIZE_BADGES} size={22} />
              </button>
            ))}
          </div>
        </div>

        <details className="border-t-2 border-bar-600 pt-3">
          <summary className="chalk cursor-pointer text-xl text-cream-400">race name & manager PIN</summary>
          <div className="mt-3 space-y-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-label="Race name"
              className="field w-full"
            />
            <label className="block space-y-1">
              <span className="ticket text-[10px] text-cream-400">
                PIN — lets another phone fix counts at close
              </span>
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="••••"
                className="field w-full"
              />
            </label>
          </div>
        </details>

        {error && <p className="text-sm text-danger-400">{error}</p>}

        <button
          type="submit"
          disabled={busy || !drinkName}
          className="pos-key display flex w-full items-center justify-center gap-2 border-2 border-brass-400 bg-brass-500 px-4 py-3 text-2xl text-bar-950 disabled:opacity-50"
        >
          {busy ? <Loader2 className="size-5 animate-spin" /> : <Flag className="size-5" />}
          {busy ? "Opening…" : `Race to ${target}`}
        </button>
      </form>
    </main>
  );
}
