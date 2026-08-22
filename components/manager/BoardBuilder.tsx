"use client";

// Board Builder: the manager's control over every tile on the board.
// Tap a tile to open the editor drawer — rename it, change what kind of
// tile it is, set its goal and how many tiles clearing it is worth, dial in
// a movement effect for landing on it, or flag it a checkpoint. The deck of
// event cards lives underneath.

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Layers, Plus, ShieldCheck, Trash2, X } from "lucide-react";
import { BOARD_TEMPLATES } from "@/lib/board";
import {
  byCategory,
  CATEGORY_LABELS,
  CATEGORY_QUEST_LABELS,
  MENU,
  sellQuestLabel,
  type MenuCategory,
} from "@/lib/recipes";
import type { EventCard, Game, GoalType, Tile, TileKind, TilePatch } from "@/lib/types";

const CATEGORY_ORDER: MenuCategory[] = ["signature", "spritz", "classic", "non_alcoholic"];

const KINDS: Array<{ value: TileKind; label: string }> = [
  { value: "standard", label: "Standard" },
  { value: "goal", label: "Goal" },
  { value: "setback", label: "Setback" },
  { value: "event_card", label: "Card" },
  { value: "checkpoint", label: "Checkpoint" },
  { value: "boss", label: "Boss" },
];

const GOAL_TYPES: Array<{ value: GoalType; label: string }> = [
  { value: "volume", label: "Count" },
  { value: "upsell", label: "Upsell" },
  { value: "task", label: "Job" },
];

/** Chalk colours for the map, mirroring the board itself. */
function tileTone(tile: Tile): string {
  if (tile.isCheckpoint) return "border-mint-400 text-mint-400";
  if (tile.movementEffect < 0) return "border-danger-400 text-danger-400";
  if (tile.movementEffect > 0) return "border-mint-400/70 text-mint-400";
  if (tile.kind === "event_card") return "border-brass-400/70 text-brass-400";
  if (tile.kind === "boss") return "border-brass-400 text-brass-400";
  return "border-bar-600 text-cream-400";
}

interface BuilderProps {
  game: Game;
  pin: string;
  onUpdateTile: (position: number, patch: TilePatch, pin?: string) => void;
  onApplyTemplate: (templateKey: string, pin?: string) => void;
  onSaveCard: (card: Partial<EventCard> & { name: string }, pin?: string) => void;
  onDeleteCard: (cardId: string, pin?: string) => void;
}

export default function BoardBuilder({
  game,
  pin,
  onUpdateTile,
  onApplyTemplate,
  onSaveCard,
  onDeleteCard,
}: BuilderProps) {
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState<Tile | null>(null);
  const [confirmTemplate, setConfirmTemplate] = useState<string | null>(null);
  const [cardDraft, setCardDraft] = useState<(Partial<EventCard> & { name: string }) | null>(null);

  function openTile(tile: Tile) {
    setEditing(tile.position);
    setDraft({ ...tile, goal: { ...tile.goal } });
  }

  function patchDraft(patch: Partial<Tile>) {
    setDraft((d) => (d ? { ...d, ...patch, goal: { ...d.goal, ...(patch.goal ?? {}) } } : d));
  }

  function saveDraft() {
    if (!draft || editing === null) return;
    onUpdateTile(
      editing,
      {
        kind: draft.kind,
        name: draft.name,
        ruleText: draft.ruleText ?? "",
        movementEffect: draft.movementEffect,
        isCheckpoint: draft.isCheckpoint,
        targetDrinkId: draft.targetDrinkId ?? "",
        moveValue: draft.moveValue,
        goal: draft.goal,
      },
      pin,
    );
    setEditing(null);
    setDraft(null);
  }

  /** Point a tile's goal at a menu drink (or a whole category). */
  function pickDrink(value: string) {
    if (!draft) return;
    const target = draft.goal.target;
    if (value.startsWith("cat:")) {
      const cat = value.slice(4) as MenuCategory;
      patchDraft({ goal: { ...draft.goal, label: CATEGORY_QUEST_LABELS[cat](target) }, targetDrinkId: undefined });
      return;
    }
    const drink = MENU.find((r) => r.id === value);
    if (drink) {
      patchDraft({
        goal: { ...draft.goal, label: sellQuestLabel(drink, target), type: "volume" },
        targetDrinkId: drink.id,
      });
    }
  }

  const field =
    "w-full rounded-md border-2 border-bar-600 bg-bar-950 px-2.5 py-2 text-sm text-cream-100 outline-none focus:border-brass-500";

  return (
    <div className="space-y-6 pb-4">
      {/* quick-apply */}
      <section className="space-y-2">
        <h2 className="display text-2xl text-brass-400">Quick-apply a house style</h2>
        <p className="chalk text-lg text-cream-400">
          swaps every tile and reshuffles the deck. players keep their places.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {BOARD_TEMPLATES.map((t) => (
            <button
              key={t.key}
              onClick={() => setConfirmTemplate(t.key)}
              className={`rounded-sm border-2 p-3 text-left transition-all ${
                game.campaignPreset === t.key
                  ? "slab -rotate-1 border-brass-400 bg-bar-800"
                  : "border-bar-600 bg-bar-800/60"
              }`}
            >
              <span className="display block text-xl leading-none text-brass-400">{t.label}</span>
              <span className="chalk text-base leading-tight text-cream-400">{t.blurb}</span>
            </button>
          ))}
        </div>
      </section>

      {/* the map */}
      <section className="space-y-2">
        <h2 className="display text-2xl text-brass-400">The board · {game.tiles.length} tiles</h2>
        <p className="chalk text-lg text-cream-400">tap any tile to rework it</p>
        <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
          {game.tiles.map((tile) => (
            <button
              key={tile.position}
              data-testid={`builder-tile-${tile.position}`}
              onClick={() => openTile(tile)}
              className={`flex h-[4.6rem] flex-col justify-between border-2 bg-bar-800 p-1 text-left ${tileTone(tile)}`}
            >
              <span className="ticket flex items-center justify-between text-[9px]">
                <span>{tile.position + 1}</span>
                <span className="flex items-center gap-0.5">
                  {tile.isCheckpoint && <ShieldCheck className="size-2.5" />}
                  {tile.kind === "event_card" && "?"}
                  {tile.moveValue > 1 && `×${tile.moveValue}`}
                </span>
              </span>
              <span className="chalk line-clamp-2 text-[13px] leading-[1.05] text-cream-100">
                {tile.name}
              </span>
              <span className="ticket text-[9px]">
                {tile.movementEffect !== 0
                  ? `${tile.movementEffect > 0 ? "+" : ""}${tile.movementEffect}`
                  : ""}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* the deck */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="display flex items-center gap-2 text-2xl text-brass-400">
            <Layers className="size-5" /> The deck · {game.cards.length}
          </h2>
          <button
            onClick={() => setCardDraft({ name: "", movementEffect: -1, weight: 1 })}
            className="pos-key display flex items-center gap-1 border-2 border-bar-600 bg-bar-700 px-2.5 py-1.5 text-lg text-cream-100"
          >
            <Plus className="size-4" /> New card
          </button>
        </div>
        {game.cards.length === 0 && (
          <p className="chalk text-lg text-cream-400">
            no cards. card tiles do nothing until the deck has something in it.
          </p>
        )}
        <ul className="space-y-1.5">
          {game.cards.map((card) => (
            <li
              key={card.id}
              className="flex items-center gap-2 border-2 border-bar-600 bg-bar-800 px-3 py-2"
            >
              <button onClick={() => setCardDraft(card)} className="min-w-0 flex-1 text-left">
                <span className="display block text-lg leading-none text-cream-100">
                  {card.name}
                </span>
                <span className="chalk block truncate text-base text-cream-400">
                  {card.ruleText ?? "—"}
                </span>
              </button>
              <span
                className={`ticket text-xs ${card.movementEffect < 0 ? "text-danger-400" : "text-mint-400"}`}
              >
                {card.movementEffect > 0 ? "+" : ""}
                {card.movementEffect}
              </span>
              <span className="ticket text-[10px] text-cream-400">
                {card.tilePosition == null ? "deck" : `t${card.tilePosition + 1}`} ·w{card.weight}
              </span>
              <button
                aria-label={`Delete ${card.name}`}
                onClick={() => onDeleteCard(card.id, pin)}
                className="rounded border border-bar-600 p-1.5 text-danger-400"
              >
                <Trash2 className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      </section>

      {/* template confirm */}
      <AnimatePresence>
        {confirmTemplate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 flex items-center justify-center bg-bar-950/80 p-6"
          >
            <div className="slab w-full max-w-sm border-2 border-brass-400 bg-bar-800 p-5">
              <h3 className="display text-2xl text-brass-400">Replace the whole board?</h3>
              <p className="chalk mt-1 text-lg text-cream-400">
                every tile and the deck get rewritten. crew keep their places.
              </p>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => {
                    onApplyTemplate(confirmTemplate, pin);
                    setConfirmTemplate(null);
                  }}
                  className="pos-key display flex-1 border-2 border-brass-400 bg-brass-500 py-2.5 text-xl text-bar-950"
                >
                  Do it
                </button>
                <button
                  onClick={() => setConfirmTemplate(null)}
                  className="pos-key display border-2 border-bar-600 bg-bar-700 px-4 py-2.5 text-xl text-cream-400"
                >
                  Leave it
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* card editor */}
      <AnimatePresence>
        {cardDraft && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 flex items-end justify-center bg-bar-950/80 sm:items-center"
          >
            <motion.div
              initial={{ y: 40 }}
              animate={{ y: 0 }}
              exit={{ y: 40 }}
              className="slab w-full max-w-md space-y-3 border-2 border-bar-600 bg-bar-800 p-5"
            >
              <h3 className="display text-2xl text-brass-400">
                {cardDraft.id ? "Edit card" : "New card"}
              </h3>
              <input
                value={cardDraft.name}
                onChange={(e) => setCardDraft({ ...cardDraft, name: e.target.value })}
                placeholder="Card name, e.g. Bribe the Barback"
                aria-label="Card name"
                className={field}
              />
              <input
                value={cardDraft.ruleText ?? ""}
                onChange={(e) => setCardDraft({ ...cardDraft, ruleText: e.target.value })}
                placeholder="What happens, in bar language"
                aria-label="Card rule"
                className={field}
              />
              <div className="flex gap-2">
                <label className="flex-1 space-y-1">
                  <span className="ticket text-[10px] text-cream-400">Moves them</span>
                  <input
                    type="number"
                    min={-10}
                    max={10}
                    value={cardDraft.movementEffect ?? 0}
                    onChange={(e) =>
                      setCardDraft({ ...cardDraft, movementEffect: Number(e.target.value) })
                    }
                    aria-label="Card movement"
                    className={field}
                  />
                </label>
                <label className="flex-1 space-y-1">
                  <span className="ticket text-[10px] text-cream-400">Draw weight</span>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={cardDraft.weight ?? 1}
                    onChange={(e) => setCardDraft({ ...cardDraft, weight: Number(e.target.value) })}
                    aria-label="Card weight"
                    className={field}
                  />
                </label>
                <label className="flex-1 space-y-1">
                  <span className="ticket text-[10px] text-cream-400">Tile</span>
                  <select
                    value={cardDraft.tilePosition ?? ""}
                    onChange={(e) =>
                      setCardDraft({
                        ...cardDraft,
                        tilePosition: e.target.value === "" ? undefined : Number(e.target.value),
                      })
                    }
                    aria-label="Card tile"
                    className={field}
                  >
                    <option value="">Any</option>
                    {game.tiles
                      .filter((t) => t.kind === "event_card")
                      .map((t) => (
                        <option key={t.position} value={t.position}>
                          {t.position + 1}
                        </option>
                      ))}
                  </select>
                </label>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => {
                    if (cardDraft.name.trim()) onSaveCard(cardDraft, pin);
                    setCardDraft(null);
                  }}
                  className="pos-key display flex-1 border-2 border-brass-400 bg-brass-500 py-2.5 text-xl text-bar-950"
                >
                  Save card
                </button>
                <button
                  onClick={() => setCardDraft(null)}
                  className="pos-key display border-2 border-bar-600 bg-bar-700 px-4 py-2.5 text-xl text-cream-400"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* tile editor drawer */}
      <AnimatePresence>
        {draft && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-bar-950/80"
          >
            <motion.div
              initial={{ y: 60 }}
              animate={{ y: 0 }}
              exit={{ y: 60 }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
              className="max-h-[88dvh] w-full max-w-2xl space-y-3 overflow-y-auto border-t-4 border-brass-400 bg-bar-800 p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="ticket text-[10px] text-cream-400">Tile {draft.position + 1}</p>
                  <h3 className="display text-3xl leading-none text-brass-400">Rework it</h3>
                </div>
                <button
                  aria-label="Close editor"
                  onClick={() => {
                    setDraft(null);
                    setEditing(null);
                  }}
                  className="rounded border-2 border-bar-600 p-1.5 text-cream-400"
                >
                  <X className="size-4" />
                </button>
              </div>

              <label className="block space-y-1">
                <span className="ticket text-[10px] text-cream-400">Tile name</span>
                <input
                  value={draft.name}
                  onChange={(e) => patchDraft({ name: e.target.value })}
                  aria-label="Tile name"
                  className={field}
                />
              </label>

              <div className="space-y-1">
                <span className="ticket text-[10px] text-cream-400">What kind of tile</span>
                <div className="flex flex-wrap gap-1.5">
                  {KINDS.map((k) => (
                    <button
                      key={k.value}
                      onClick={() => patchDraft({ kind: k.value })}
                      aria-pressed={draft.kind === k.value}
                      className={`display border-2 px-2.5 py-1 text-lg transition-colors ${
                        draft.kind === k.value
                          ? "border-brass-400 bg-brass-500/20 text-brass-400"
                          : "border-bar-600 bg-bar-900 text-cream-400"
                      }`}
                    >
                      {k.label}
                    </button>
                  ))}
                </div>
              </div>

              <label className="block space-y-1">
                <span className="ticket text-[10px] text-cream-400">The goal they must clear</span>
                <input
                  value={draft.goal.label}
                  onChange={(e) => patchDraft({ goal: { ...draft.goal, label: e.target.value } })}
                  aria-label="Tile goal"
                  className={field}
                />
              </label>

              <div className="flex flex-wrap gap-2">
                <select
                  value=""
                  onChange={(e) => pickDrink(e.target.value)}
                  aria-label="Pick a menu drink"
                  className="max-w-40 rounded-md border-2 border-brass-500/50 bg-bar-950 px-2 py-2 text-sm text-brass-400"
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
                  value={draft.goal.type}
                  onChange={(e) =>
                    patchDraft({ goal: { ...draft.goal, type: e.target.value as GoalType } })
                  }
                  aria-label="Goal type"
                  className="rounded-md border-2 border-bar-600 bg-bar-950 px-2 py-2 text-sm text-cream-100"
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
                  value={draft.goal.target}
                  onChange={(e) => {
                    const target = Number(e.target.value) || 1;
                    const label = /^(Sell|Upsell) \d+ /.test(draft.goal.label)
                      ? draft.goal.label.replace(/\d+/, String(target))
                      : draft.goal.label;
                    patchDraft({ goal: { ...draft.goal, target, label } });
                  }}
                  aria-label="Goal target"
                  className="w-20 rounded-md border-2 border-bar-600 bg-bar-950 px-2 py-2 text-sm text-cream-100"
                />
              </div>

              <div className="flex flex-wrap gap-3">
                <label className="space-y-1">
                  <span className="ticket text-[10px] text-cream-400">Clearing it is worth</span>
                  <select
                    value={draft.moveValue}
                    onChange={(e) => patchDraft({ moveValue: Number(e.target.value) })}
                    aria-label="Move value"
                    className="block rounded-md border-2 border-bar-600 bg-bar-950 px-2 py-2 text-sm text-cream-100"
                  >
                    <option value={1}>1 tile</option>
                    <option value={2}>2 tiles</option>
                    <option value={3}>3 tiles</option>
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="ticket text-[10px] text-cream-400">Landing here moves them</span>
                  <input
                    type="number"
                    min={-10}
                    max={10}
                    value={draft.movementEffect}
                    onChange={(e) => patchDraft({ movementEffect: Number(e.target.value) })}
                    aria-label="Movement effect"
                    data-testid="tile-movement-effect"
                    className="block w-24 rounded-md border-2 border-bar-600 bg-bar-950 px-2 py-2 text-sm text-cream-100"
                  />
                </label>
              </div>

              <button
                onClick={() => patchDraft({ isCheckpoint: !draft.isCheckpoint })}
                aria-pressed={draft.isCheckpoint}
                className={`flex w-full items-center gap-3 rounded-sm border-2 p-3 text-left transition-colors ${
                  draft.isCheckpoint ? "border-mint-400 bg-mint-400/10" : "border-bar-600 bg-bar-900"
                }`}
              >
                <ShieldCheck
                  className={`size-5 ${draft.isCheckpoint ? "text-mint-400" : "text-cream-400"}`}
                />
                <span className="flex-1">
                  <span className="display block text-xl leading-none">
                    Checkpoint {draft.isCheckpoint ? "on" : "off"}
                  </span>
                  <span className="chalk text-base leading-tight text-cream-400">
                    safe zone — no setback or card can knock anyone back past here
                  </span>
                </span>
              </button>

              <label className="block space-y-1">
                <span className="ticket text-[10px] text-cream-400">
                  House rule — what they read when they land
                </span>
                <textarea
                  value={draft.ruleText ?? ""}
                  onChange={(e) => patchDraft({ ruleText: e.target.value })}
                  rows={2}
                  aria-label="Custom rule text"
                  className={field}
                />
              </label>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={saveDraft}
                  data-testid="save-tile"
                  className="pos-key display flex flex-1 items-center justify-center gap-2 border-2 border-brass-400 bg-brass-500 py-3 text-2xl text-bar-950"
                >
                  <Check className="size-5" /> Save tile
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
