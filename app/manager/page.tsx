"use client";

// Campaign Preset Builder: pick a preset (or customize every tile's goal),
// set the pace and trust level, and launch the Monthly Marathon.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ChevronDown, ChevronUp, Dice5, Loader2, ShieldCheck } from "lucide-react";
import { CAMPAIGN_PRESETS, generateCampaignBoard } from "@/lib/board";
import {
  byCategory,
  CATEGORY_LABELS,
  CATEGORY_QUEST_LABELS,
  MENU,
  sellQuestLabel,
  type MenuCategory,
} from "@/lib/recipes";
import { isDemoMode } from "@/lib/supabase/client";
import { createCampaignLive } from "@/lib/supabase/db";
import type { GoalType, Tile, TileGoal } from "@/lib/types";

const CATEGORY_ORDER: MenuCategory[] = ["signature", "spritz", "classic", "non_alcoholic"];

/** Per-tile customization layered over the generated preset board. */
type TileEdit = Omit<Partial<Tile>, "goal"> & { goal?: Partial<TileGoal> };

const GOAL_TYPES: Array<{ value: GoalType; label: string }> = [
  { value: "volume", label: "Volume" },
  { value: "upsell", label: "Upsell" },
  { value: "task", label: "Task" },
];

export default function ManagerSetup() {
  const router = useRouter();
  const [name, setName] = useState("Monthly Marathon");
  const [boardLength, setBoardLength] = useState(30);
  const [preset, setPreset] = useState("balanced");
  const [autoApprove, setAutoApprove] = useState(false);
  const [pin, setPin] = useState("");
  const [seed] = useState(() => Math.floor(Math.random() * 2 ** 31));
  const [edits, setEdits] = useState<Record<number, TileEdit>>({});
  const [showTiles, setShowTiles] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Regenerating from (length, preset, seed) keeps the builder deterministic;
  // per-tile edits are layered on top and survive preset/length tweaks where
  // positions still exist.
  const tiles = useMemo(() => {
    const base = generateCampaignBoard(boardLength, preset, seed);
    return base.map((t) => {
      const e = edits[t.position];
      return e ? { ...t, ...e, goal: { ...t.goal, ...e.goal } } : t;
    });
  }, [boardLength, preset, seed, edits]);

  /** Build a "Sell N <drink>" goal from a menu pick (or a whole category). */
  function applyMenuPick(position: number, target: number, value: string) {
    if (value.startsWith("cat:")) {
      const cat = value.slice(4) as MenuCategory;
      editTile(position, { goal: { label: CATEGORY_QUEST_LABELS[cat](target), type: "volume" } });
      return;
    }
    const recipe = MENU.find((r) => r.id === value);
    if (recipe) {
      editTile(position, { goal: { label: sellQuestLabel(recipe, target), type: "volume" } });
    }
  }

  function editTile(position: number, patch: TileEdit) {
    setEdits((prev) => {
      const current = prev[position] ?? {};
      return {
        ...prev,
        [position]: {
          ...current,
          ...patch,
          goal: patch.goal ? { ...current.goal, ...patch.goal } : current.goal,
        },
      };
    });
  }

  async function createCampaign(e: React.FormEvent) {
    e.preventDefault();
    if (isDemoMode()) {
      router.push("/manager/demo");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const gameId = await createCampaignLive({ name, boardLength, preset, autoApprove, pin, tiles });
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
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-6 px-6 py-6">
      <Link href="/" className="flex items-center gap-1 text-sm text-cream-400">
        <ArrowLeft className="size-4" /> Home
      </Link>
      <h1 className="text-2xl font-bold text-brass-400">Build the campaign</h1>

      <form onSubmit={createCampaign} className="space-y-5">
        <label className="block space-y-1">
          <span className="text-sm text-cream-400">Campaign name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className={field} required />
        </label>

        <div className="space-y-2">
          <span className="text-sm text-cream-400">Goal preset</span>
          <div className="grid gap-2 sm:grid-cols-3">
            {CAMPAIGN_PRESETS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => setPreset(p.key)}
                aria-pressed={preset === p.key}
                className={`rounded-xl border p-3 text-left transition-colors ${
                  preset === p.key
                    ? "border-brass-500 bg-brass-500/10"
                    : "border-bar-600 bg-bar-800"
                }`}
              >
                <span className="block font-semibold text-brass-400">{p.label}</span>
                <span className="text-xs text-cream-400">{p.blurb}</span>
              </button>
            ))}
          </div>
        </div>

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

        <button
          type="button"
          onClick={() => setAutoApprove((v) => !v)}
          aria-pressed={autoApprove}
          className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
            autoApprove ? "border-mint-400 bg-mint-400/10" : "border-bar-600 bg-bar-800"
          }`}
        >
          <ShieldCheck className={`size-5 ${autoApprove ? "text-mint-400" : "text-cream-400"}`} />
          <span className="flex-1">
            <span className="block text-sm font-medium">
              Auto-trust {autoApprove ? "ON" : "OFF"}
            </span>
            <span className="text-xs text-cream-400">
              {autoApprove
                ? "Quests approve instantly on submit — except the winning tile, which always waits for you."
                : "Every quest submission waits in your approval queue."}
            </span>
          </span>
        </button>

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

        {/* per-tile customization */}
        <div className="rounded-xl border border-bar-600 bg-bar-800">
          <button
            type="button"
            onClick={() => setShowTiles((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-brass-400"
          >
            Customize individual tiles ({boardLength})
            {showTiles ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </button>
          {showTiles && (
            <ul className="max-h-96 space-y-2 overflow-y-auto border-t border-bar-600 p-3">
              {tiles.map((t) => (
                <li key={t.position} className="rounded-lg border border-bar-600 bg-bar-900 p-2">
                  <div className="mb-1 flex items-center gap-2 text-xs text-cream-400">
                    <span className="w-8 shrink-0">#{t.position + 1}</span>
                    <span className="flex-1 truncate">{t.title}</span>
                    {t.move ? (
                      <span className={t.move > 0 ? "text-mint-400" : "text-danger-400"}>
                        landing {t.move > 0 ? `+${t.move}` : t.move}
                      </span>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      value={t.goal.label}
                      onChange={(e) => editTile(t.position, { goal: { label: e.target.value } })}
                      aria-label={`Goal for tile ${t.position + 1}`}
                      className="min-w-40 flex-1 rounded-lg border border-bar-600 bg-bar-800 px-2 py-1.5 text-sm text-cream-100 outline-none focus:border-brass-500"
                    />
                    <select
                      value=""
                      onChange={(e) => applyMenuPick(t.position, t.goal.target, e.target.value)}
                      aria-label={`Pick a menu drink for tile ${t.position + 1}`}
                      className="max-w-32 rounded-lg border border-brass-500/50 bg-bar-800 px-1.5 py-1.5 text-sm text-brass-400"
                    >
                      <option value="">From menu…</option>
                      {CATEGORY_ORDER.map((cat) => (
                        <optgroup key={cat} label={CATEGORY_LABELS[cat]}>
                          {byCategory(cat).map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.name}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                      <optgroup label="Whole category">
                        {CATEGORY_ORDER.map((cat) => (
                          <option key={`cat:${cat}`} value={`cat:${cat}`}>
                            Any: {CATEGORY_LABELS[cat]}
                          </option>
                        ))}
                      </optgroup>
                    </select>
                    <select
                      value={t.goal.type}
                      onChange={(e) =>
                        editTile(t.position, { goal: { type: e.target.value as GoalType } })
                      }
                      aria-label={`Goal type for tile ${t.position + 1}`}
                      className="rounded-lg border border-bar-600 bg-bar-800 px-1.5 py-1.5 text-sm text-cream-100"
                    >
                      {GOAL_TYPES.map((g) => (
                        <option key={g.value} value={g.value}>
                          {g.label}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min={1}
                      max={999}
                      value={t.goal.target}
                      onChange={(e) => {
                        const target = Number(e.target.value) || 1;
                        // Keep "Sell N …" labels in step with the target.
                        const label = /^(Sell|Upsell) \d+ /.test(t.goal.label)
                          ? t.goal.label.replace(/\d+/, String(target))
                          : undefined;
                        editTile(t.position, { goal: label ? { target, label } : { target } });
                      }}
                      aria-label={`Target for tile ${t.position + 1}`}
                      className="w-16 rounded-lg border border-bar-600 bg-bar-800 px-2 py-1.5 text-sm text-cream-100"
                    />
                    <select
                      value={t.moveValue}
                      onChange={(e) => editTile(t.position, { moveValue: Number(e.target.value) })}
                      aria-label={`Move value for tile ${t.position + 1}`}
                      className="rounded-lg border border-bar-600 bg-bar-800 px-1.5 py-1.5 text-sm text-cream-100"
                    >
                      <option value={1}>+1 tile</option>
                      <option value={2}>+2 tiles</option>
                      <option value={3}>+3 tiles</option>
                    </select>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {error && <p className="text-sm text-danger-400">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-brass-500 px-4 py-3 font-semibold text-bar-900 transition-colors hover:bg-brass-400 disabled:opacity-50"
        >
          {busy ? <Loader2 className="size-5 animate-spin" /> : <Dice5 className="size-5" />}
          {busy ? "Setting up…" : "Launch the marathon"}
        </button>
      </form>
    </main>
  );
}
