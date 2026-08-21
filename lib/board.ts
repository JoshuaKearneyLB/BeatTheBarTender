// The board engine: pure functions so the same rules run in the browser
// (optimistic updates / Demo Mode) and, mirrored in plpgsql, in Postgres
// (authoritative state — see supabase/migrations/0003_campaign_quests.sql).
//
// v0.3 movement model: each tile carries a manager-configured quest. When a
// quest submission is approved, the player advances by the tile's moveValue
// (1 standard, 2-3 hard/boss), then any landing effect (bonus/setback move)
// applies once, without chaining. Completing the FINAL tile's quest wins.

import { byCategory, CATEGORY_QUEST_LABELS, sellQuestLabel } from "./recipes";
import type { BoardEvent, Game, GoalType, Player, Tile, TileGoal, TileType } from "./types";

// ---------- campaign presets ----------
// Goals are drawn from the venue's official menu (lib/recipes.ts): a preset
// is a weighted pool of goal makers — most pick a concrete drink ("Sell 10
// Hacien Pineapple Spritzes"), some target a category, a few are service
// tasks.

interface GoalTemplate {
  type: GoalType;
  /** [min, max] target range for standard tiles; hard/boss tiles scale up. */
  range: [number, number];
  label: (n: number, rand: () => number) => string;
}

interface PresetDef {
  key: string;
  label: string;
  blurb: string;
  /** Weighted goal pool: [template, weight]. */
  pool: Array<[GoalTemplate, number]>;
}

function pickFrom<T>(rand: () => number, arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}

// Landing-tile flavor: the stuff that actually happens on a shift.
const DISASTERS = [
  "Keg Blew Mid-Rush",
  "Glasswasher Died",
  "Caught Slacking on Fruit Prep",
  "Stag Do Trashed the Rail",
  "Card Machine Down",
];
const HOT_STREAKS = [
  "Big Table Tipped Cash",
  "Hen Party Round ×3",
  "Perfect Pour Streak",
  "Regulars Brought Mates",
];

const SIGNATURES = byCategory("signature");
const SPRITZES = byCategory("spritz");
const CLASSICS = byCategory("classic");
const NON_ALC = byCategory("non_alcoholic");
// The margin-makers: premium spirits and liqueur-led serves.
const PREMIUM = CLASSICS.filter((r) =>
  ["woodford-old-fashioned", "espresso-martini", "negroni", "passionfruit-martini"].includes(r.id),
).concat(SPRITZES.filter((r) => ["chambord-royale", "sarti-spritz"].includes(r.id)));

const SELL_SIGNATURE: GoalTemplate = {
  type: "volume",
  range: [6, 12],
  label: (n, rand) => sellQuestLabel(pickFrom(rand, SIGNATURES), n),
};
const SELL_SPRITZ: GoalTemplate = {
  type: "volume",
  range: [6, 12],
  label: (n, rand) => sellQuestLabel(pickFrom(rand, SPRITZES), n),
};
const SELL_CLASSIC: GoalTemplate = {
  type: "volume",
  range: [6, 10],
  label: (n, rand) => sellQuestLabel(pickFrom(rand, CLASSICS), n),
};
const UPSELL_PREMIUM: GoalTemplate = {
  type: "upsell",
  range: [3, 6],
  label: (n, rand) => sellQuestLabel(pickFrom(rand, PREMIUM), n),
};
const SELL_NON_ALC: GoalTemplate = {
  type: "volume",
  range: [4, 8],
  label: (n) => CATEGORY_QUEST_LABELS.non_alcoholic(n),
};
const SELL_ANY_SIGNATURE: GoalTemplate = {
  type: "volume",
  range: [8, 14],
  label: (n) => CATEGORY_QUEST_LABELS.signature(n),
};
const TASK_REVIEW: GoalTemplate = {
  type: "task",
  range: [1, 1],
  label: () => "Get a 5-star review mentioning you",
};
const TASK_ZERO_WASTE: GoalTemplate = {
  type: "task",
  range: [1, 1],
  label: () => "Run a zero-waste shift (no comps, no spills)",
};
const TASK_SPEED: GoalTemplate = {
  type: "task",
  range: [1, 1],
  label: () => "Clear the rail — no ticket over 4 minutes",
};

export const CAMPAIGN_PRESETS: PresetDef[] = [
  {
    key: "cocktail_focus",
    label: "Cocktail Focus",
    blurb: "Volume on the shaker: Hacien signatures and classics carry the month.",
    pool: [
      [SELL_SIGNATURE, 5],
      [SELL_CLASSIC, 3],
      [SELL_ANY_SIGNATURE, 1],
      [TASK_REVIEW, 1],
      [TASK_SPEED, 1],
    ],
  },
  {
    key: "high_margin",
    label: "High-Margin Spirits",
    blurb: "Push the top shelf: Woodford, Chambord Royales, and premium serves.",
    pool: [
      [UPSELL_PREMIUM, 5],
      [SELL_SPRITZ, 3],
      [SELL_SIGNATURE, 2],
      [TASK_ZERO_WASTE, 1],
    ],
  },
  {
    key: "balanced",
    label: "Balanced Shift",
    blurb: "A bit of everything: signatures, spritzes, zero-proof, and service tasks.",
    pool: [
      [SELL_SIGNATURE, 3],
      [SELL_SPRITZ, 2],
      [SELL_CLASSIC, 2],
      [SELL_NON_ALC, 1],
      [UPSELL_PREMIUM, 1],
      [TASK_REVIEW, 1],
      [TASK_ZERO_WASTE, 1],
      [TASK_SPEED, 1],
    ],
  },
];

// ---------- deterministic generation ----------

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function weightedPick<T>(rand: () => number, pool: Array<[T, number]>): T {
  const total = pool.reduce((a, [, w]) => a + w, 0);
  let roll = rand() * total;
  for (const [item, w] of pool) {
    roll -= w;
    if (roll <= 0) return item;
  }
  return pool[pool.length - 1][0];
}

function makeGoal(rand: () => number, tpl: GoalTemplate, scale = 1): TileGoal {
  const [min, max] = tpl.range;
  const target = Math.max(1, Math.round((min + rand() * (max - min)) * scale));
  return { type: tpl.type, label: tpl.label(target, rand), target };
}

/**
 * Generate a campaign board: every tile gets a shift goal from the preset's
 * pool. Rhythm: every 10th tile is a Boss Night (double target, move 3),
 * every 7th a Double Shift (1.5x target, move 2); a few landing effects
 * add board-game texture. Deterministic for a given (length, preset, seed);
 * managers can still edit any tile before the campaign starts.
 */
export function generateCampaignBoard(length: number, presetKey: string, seed = 1): Tile[] {
  const preset = CAMPAIGN_PRESETS.find((p) => p.key === presetKey) ?? CAMPAIGN_PRESETS[2];
  const rand = mulberry32(seed);
  const tiles: Tile[] = [];

  for (let i = 0; i < length; i++) {
    const isFinish = i === length - 1;
    const isBoss = !isFinish && i > 0 && i % 10 === 0;
    const isHard = !isFinish && !isBoss && i > 0 && i % 7 === 0;
    // Day 1 always opens with a straightforward signature-volume quest.
    const tpl = i === 0 ? SELL_SIGNATURE : weightedPick(rand, preset.pool);
    const goal = makeGoal(rand, tpl, isFinish || isBoss ? 2 : isHard ? 1.5 : 1);

    let type: TileType = "progress";
    let title = `Shift ${i + 1}`;
    let move: number | undefined;

    if (i === 0) {
      type = "start";
      title = "Opening Night";
    } else if (isFinish) {
      type = "finish";
      title = "Last Call";
    } else if (isBoss) {
      type = "challenge";
      title = "Boss Night";
    } else if (isHard) {
      type = "challenge";
      title = "Double Shift";
    } else {
      const roll = rand();
      if (i > 3 && roll < 0.12) {
        type = "setback";
        title = pickFrom(rand, DISASTERS);
        move = rand() < 0.5 ? -1 : -2;
      } else if (i > 2 && roll < 0.24) {
        type = "bonus";
        title = pickFrom(rand, HOT_STREAKS);
        move = rand() < 0.5 ? 1 : 2;
      }
    }

    tiles.push({
      position: i,
      type,
      title,
      description:
        move !== undefined
          ? move > 0
            ? `Land here and skip ahead ${move}.`
            : `Land here and eat it — back ${-move}.`
          : undefined,
      move,
      goal,
      moveValue: isBoss ? 3 : isHard ? 2 : 1,
    });
  }
  return tiles;
}

// ---------- movement ----------

/**
 * Apply a signed-off shift goal. Mirrored by _apply_quest_approval in
 * SQL: completing the final tile's goal wins; otherwise advance by the
 * tile's moveValue, then apply the landing tile's effect once (no chaining).
 */
export function applyQuestApproval(
  game: Game,
  player: Player,
): { player: Player; events: BoardEvent[] } {
  const events: BoardEvent[] = [];
  const p: Player = { ...player, progress: 0, awaitingApproval: false };

  if (p.position >= game.boardLength - 1) {
    p.finished = true;
    events.push({
      playerId: p.id,
      kind: "win",
      message: `🏆 ${p.name} rang Last Call. Drinks are on them.`,
    });
    return { player: p, events };
  }

  const from = game.tiles[p.position];
  p.position = Math.min(p.position + from.moveValue, game.boardLength - 1);
  events.push({
    playerId: p.id,
    kind: "advance",
    message: `${p.name} ticked off “${from.goal.label}”${from.moveValue > 1 ? ` — big move, ${from.moveValue} tiles` : ""} → “${game.tiles[p.position].title}”`,
  });

  const landed = game.tiles[p.position];
  if (landed.move) {
    p.position = Math.max(0, Math.min(p.position + landed.move, game.boardLength - 1));
    events.push({
      playerId: p.id,
      kind: landed.move > 0 ? "bonus" : "setback",
      message: `${landed.title}! ${landed.move > 0 ? `${p.name} skips ahead` : `${p.name} eats it, back`} ${Math.abs(landed.move)} → tile ${p.position + 1}`,
    });
  }

  if (p.position >= game.boardLength - 1) {
    events.push({
      playerId: p.id,
      kind: "checkpoint",
      message: `${p.name} is at Last Call. One goal left — the manager watches the pour.`,
    });
  }
  return { player: p, events };
}

/** Manager override: move a player ±n tiles, skipping landing effects. */
export function applyOverride(
  game: Game,
  player: Player,
  delta: number,
  reason: string,
): { player: Player; events: BoardEvent[] } {
  const p = { ...player };
  p.position = Math.max(0, Math.min(p.position + delta, game.boardLength - 1));
  p.progress = 0;
  return {
    player: p,
    events: [
      {
        playerId: p.id,
        kind: "override",
        message: `Manager ${delta > 0 ? "bumped" : "knocked"} ${p.name} ${delta > 0 ? "up" : "back"} — ${reason}`,
      },
    ],
  };
}
