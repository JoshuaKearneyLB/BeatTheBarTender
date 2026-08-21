// The board engine: pure functions so the same rules run in the browser
// (optimistic updates / Demo Mode) and, mirrored in plpgsql, in Postgres
// (authoritative state — see supabase/migrations/0003_campaign_quests.sql).
//
// v0.3 movement model: each tile carries a manager-configured quest. When a
// quest submission is approved, the player advances by the tile's moveValue
// (1 standard, 2-3 hard/boss), then any landing effect (bonus/setback move)
// applies once, without chaining. Completing the FINAL tile's quest wins.

import type { BoardEvent, Game, GoalType, Player, Tile, TileGoal, TileType } from "./types";

// ---------- campaign presets ----------

interface GoalTemplate {
  type: GoalType;
  label: (n: number) => string;
  /** [min, max] target range for standard tiles; hard/boss tiles scale up. */
  range: [number, number];
}

interface PresetDef {
  key: string;
  label: string;
  blurb: string;
  /** Weighted goal pool: [template, weight]. */
  pool: Array<[GoalTemplate, number]>;
}

const VOLUME_COCKTAILS: GoalTemplate = {
  type: "volume",
  label: (n) => `Sell ${n} cocktails`,
  range: [8, 15],
};
const VOLUME_SIGNATURE: GoalTemplate = {
  type: "volume",
  label: (n) => `Sell ${n} house signature cocktails`,
  range: [4, 8],
};
const VOLUME_DRAFTS: GoalTemplate = {
  type: "volume",
  label: (n) => `Sell ${n} premium drafts`,
  range: [6, 12],
};
const UPSELL_SPIRITS: GoalTemplate = {
  type: "upsell",
  label: (n) => `Upsell ${n} top-shelf spirits`,
  range: [3, 6],
};
const UPSELL_PAIRING: GoalTemplate = {
  type: "upsell",
  label: (n) => `Land ${n} food or dessert pairings`,
  range: [3, 5],
};
const TASK_REVIEW: GoalTemplate = {
  type: "task",
  label: () => "Get a 5-star review mentioning you",
  range: [1, 1],
};
const TASK_ZERO_WASTE: GoalTemplate = {
  type: "task",
  label: () => "Run a zero-waste shift (no comps, no spills)",
  range: [1, 1],
};
const TASK_SPEED: GoalTemplate = {
  type: "task",
  label: () => "Clear the rail — no ticket over 4 minutes",
  range: [1, 1],
};

export const CAMPAIGN_PRESETS: PresetDef[] = [
  {
    key: "cocktail_focus",
    label: "Cocktail Focus",
    blurb: "Volume on the shaker: cocktails and signatures carry the month.",
    pool: [
      [VOLUME_COCKTAILS, 5],
      [VOLUME_SIGNATURE, 3],
      [UPSELL_SPIRITS, 1],
      [TASK_REVIEW, 1],
      [TASK_SPEED, 1],
    ],
  },
  {
    key: "high_margin",
    label: "High-Margin Spirits",
    blurb: "Push the top shelf: upsells and pairings over pure volume.",
    pool: [
      [UPSELL_SPIRITS, 5],
      [UPSELL_PAIRING, 3],
      [VOLUME_SIGNATURE, 2],
      [TASK_ZERO_WASTE, 1],
    ],
  },
  {
    key: "balanced",
    label: "Balanced Shift",
    blurb: "A bit of everything: volume, upsells, and service tasks.",
    pool: [
      [VOLUME_COCKTAILS, 3],
      [VOLUME_DRAFTS, 2],
      [UPSELL_SPIRITS, 2],
      [UPSELL_PAIRING, 1],
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
  return { type: tpl.type, label: tpl.label(target), target };
}

/**
 * Generate a campaign board: every tile gets a quest from the preset's pool.
 * Rhythm: every 10th tile is a Boss Quest (double target, move 3), every 7th
 * a Hard Quest (1.5x target, move 2); a few bonus/setback landing effects
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
    const tpl = weightedPick(rand, preset.pool);
    const goal = makeGoal(rand, tpl, isFinish || isBoss ? 2 : isHard ? 1.5 : 1);

    let type: TileType = "progress";
    let title = `Day ${i + 1}`;
    let move: number | undefined;

    if (i === 0) {
      type = "start";
      title = "Opening Night";
    } else if (isFinish) {
      type = "finish";
      title = "Last Call — Boss";
    } else if (isBoss) {
      type = "challenge";
      title = "Boss Quest";
    } else if (isHard) {
      type = "challenge";
      title = "Hard Quest";
    } else {
      const roll = rand();
      if (i > 3 && roll < 0.12) {
        type = "setback";
        title = "Rough Night";
        move = rand() < 0.5 ? -1 : -2;
      } else if (i > 2 && roll < 0.24) {
        type = "bonus";
        title = "Hot Streak";
        move = rand() < 0.5 ? 1 : 2;
      }
    }

    tiles.push({
      position: i,
      type,
      title,
      description:
        move !== undefined
          ? `Landing here ${move > 0 ? `skips you ahead ${move}` : `knocks you back ${-move}`}.`
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
 * Apply an approved quest completion. Mirrored by _apply_quest_approval in
 * SQL: completing the final tile's quest wins; otherwise advance by the
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
    events.push({ playerId: p.id, kind: "win", message: `🏆 ${p.name} WINS the marathon!` });
    return { player: p, events };
  }

  const from = game.tiles[p.position];
  p.position = Math.min(p.position + from.moveValue, game.boardLength - 1);
  events.push({
    playerId: p.id,
    kind: "advance",
    message: `${p.name} completes “${from.goal.label}” → ${from.moveValue > 1 ? `${from.moveValue} tiles to` : ""} “${game.tiles[p.position].title}”`,
  });

  const landed = game.tiles[p.position];
  if (landed.move) {
    p.position = Math.max(0, Math.min(p.position + landed.move, game.boardLength - 1));
    events.push({
      playerId: p.id,
      kind: landed.move > 0 ? "bonus" : "setback",
      message: `${landed.title}: ${landed.description ?? ""} → tile ${p.position + 1}`,
    });
  }

  if (p.position >= game.boardLength - 1) {
    events.push({
      playerId: p.id,
      kind: "checkpoint",
      message: `${p.name} faces the final Boss Quest at Last Call!`,
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
        message: `Manager ${delta > 0 ? "advanced" : "set back"} ${p.name} (${reason})`,
      },
    ],
  };
}
