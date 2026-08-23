// The board engine: pure functions so the same rules run in the browser
// (optimistic updates / Demo Mode) and, mirrored in plpgsql, in Postgres
// (authoritative state — see supabase/migrations/0004_tile_editor.sql).
//
// v0.4 movement: clearing a tile's goal moves you by that tile's moveValue.
// The tile you LAND on applies its movementEffect once (an event-card tile
// draws the manager's deck instead). Effects never chain, and no automatic
// effect can push a player below the furthest checkpoint they've reached.

import { byCategory, CATEGORY_QUEST_LABELS, sellQuestLabel } from "./recipes";
import type {
  BoardEvent,
  EventCard,
  Game,
  GoalType,
  Player,
  Tile,
  TileGoal,
} from "./types";

// ---------- flavour pools ----------

const DISASTERS = [
  "Keg Blew Mid-Rush",
  "Glasswasher Died",
  "Dirty Well Penalty",
  "Stag Do Trashed the Rail",
  "Card Machine Down",
];
const HOT_STREAKS = [
  "Big Table Tipped Cash",
  "Hen Party Round ×3",
  "Perfect Pour Streak",
  "Regulars Brought Mates",
];

// ---------- goal makers ----------

interface GoalTemplate {
  type: GoalType;
  /** [min, max] target for standard tiles; hard/boss tiles scale up. */
  range: [number, number];
  make: (n: number, rand: () => number) => { label: string; drinkId?: string };
}

function pickFrom<T>(rand: () => number, arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}

const SIGNATURES = byCategory("signature");
const SPRITZES = byCategory("spritz");
const CLASSICS = byCategory("classic");
// The margin-makers: premium spirits and liqueur-led serves.
const PREMIUM = CLASSICS.filter((r) =>
  ["woodford-old-fashioned", "espresso-martini", "negroni", "passionfruit-martini"].includes(r.id),
).concat(SPRITZES.filter((r) => ["chambord-royale", "sarti-spritz"].includes(r.id)));

const fromMenu = (type: GoalType, range: [number, number], pool: typeof SIGNATURES): GoalTemplate => ({
  type,
  range,
  make: (n, rand) => {
    const drink = pickFrom(rand, pool);
    return { label: sellQuestLabel(drink, n), drinkId: drink.id };
  },
});

const SELL_SIGNATURE = fromMenu("volume", [6, 12], SIGNATURES);
const SELL_SPRITZ = fromMenu("volume", [6, 12], SPRITZES);
const SELL_CLASSIC = fromMenu("volume", [6, 10], CLASSICS);
const UPSELL_PREMIUM = fromMenu("upsell", [3, 6], PREMIUM);

const SELL_NON_ALC: GoalTemplate = {
  type: "volume",
  range: [4, 8],
  make: (n) => ({ label: CATEGORY_QUEST_LABELS.non_alcoholic(n) }),
};
const SELL_ANY_SIGNATURE: GoalTemplate = {
  type: "volume",
  range: [8, 14],
  make: (n) => ({ label: CATEGORY_QUEST_LABELS.signature(n) }),
};
const JOB_REVIEW: GoalTemplate = {
  type: "task",
  range: [1, 1],
  make: () => ({ label: "Get a 5-star review mentioning you" }),
};
const JOB_ZERO_WASTE: GoalTemplate = {
  type: "task",
  range: [1, 1],
  make: () => ({ label: "Run a zero-waste shift (no comps, no spills)" }),
};
const JOB_SPEED: GoalTemplate = {
  type: "task",
  range: [1, 1],
  make: () => ({ label: "Clear the rail — no ticket over 4 minutes" }),
};

// ---------- board templates ----------

export interface StarterCard {
  name: string;
  ruleText: string;
  movementEffect: number;
  weight: number;
}

export interface BoardTemplate {
  key: string;
  label: string;
  blurb: string;
  /** Weighted goal pool: [maker, weight]. */
  pool: Array<[GoalTemplate, number]>;
  setbackChance: number;
  bonusChance: number;
  cardChance: number;
  /** Roughly every N tiles gets a checkpoint; 0 for none. */
  checkpointEvery: number;
  /** Magnitude range for setbacks and bonuses. */
  setbackRange: [number, number];
  bonusRange: [number, number];
  /** Deck seeded alongside the board. */
  cards: StarterCard[];
}

const HOUSE_DECK: StarterCard[] = [
  { name: "Bribe the Barback", ruleText: "They cover your restock. Skip ahead 2.", movementEffect: 2, weight: 2 },
  { name: "Late to Shift", ruleText: "Everyone saw. Back 1.", movementEffect: -1, weight: 3 },
  { name: "Double Down", ruleText: "You called it and nailed it. Ahead 3.", movementEffect: 3, weight: 1 },
  { name: "Dirty Well Penalty", ruleText: "Manager ran a finger along the rail. Back 2.", movementEffect: -2, weight: 2 },
  { name: "Covered a Sick Shift", ruleText: "The rota owes you. Ahead 1.", movementEffect: 1, weight: 3 },
];

export const BOARD_TEMPLATES: BoardTemplate[] = [
  {
    key: "chaos_shift",
    label: "Chaos Shift",
    blurb: "High risk, big drops, wild jumps. For a bar that likes a scrap.",
    pool: [
      [SELL_SIGNATURE, 3],
      [SELL_CLASSIC, 2],
      [UPSELL_PREMIUM, 2],
      [SELL_SPRITZ, 2],
      [JOB_SPEED, 1],
    ],
    setbackChance: 0.2,
    bonusChance: 0.18,
    cardChance: 0.16,
    checkpointEvery: 8,
    setbackRange: [2, 3],
    bonusRange: [2, 3],
    cards: HOUSE_DECK,
  },
  {
    key: "cocktail_focus",
    label: "Cocktail Focus",
    blurb: "Hacien spritzes and house signatures carry the month.",
    pool: [
      [SELL_SIGNATURE, 6],
      [SELL_SPRITZ, 3],
      [SELL_ANY_SIGNATURE, 2],
      [JOB_REVIEW, 1],
      [JOB_SPEED, 1],
    ],
    setbackChance: 0.1,
    bonusChance: 0.12,
    cardChance: 0.08,
    checkpointEvery: 10,
    setbackRange: [1, 2],
    bonusRange: [1, 2],
    cards: HOUSE_DECK,
  },
  {
    key: "clean_fast",
    label: "Clean & Fast",
    blurb: "Straight run of daily targets. No tricks, no card tiles.",
    pool: [
      [SELL_SIGNATURE, 3],
      [SELL_SPRITZ, 2],
      [SELL_CLASSIC, 2],
      [SELL_NON_ALC, 1],
      [JOB_ZERO_WASTE, 1],
    ],
    setbackChance: 0.04,
    bonusChance: 0.06,
    cardChance: 0,
    checkpointEvery: 10,
    setbackRange: [1, 1],
    bonusRange: [1, 1],
    cards: [],
  },
  {
    key: "high_margin",
    label: "High-Margin Spirits",
    blurb: "Push the top shelf: Woodford, Chambord Royales, premium serves.",
    pool: [
      [UPSELL_PREMIUM, 5],
      [SELL_SPRITZ, 3],
      [SELL_SIGNATURE, 2],
      [JOB_ZERO_WASTE, 1],
    ],
    setbackChance: 0.1,
    bonusChance: 0.1,
    cardChance: 0.08,
    checkpointEvery: 10,
    setbackRange: [1, 2],
    bonusRange: [1, 2],
    cards: HOUSE_DECK,
  },
];

export function boardTemplate(key: string): BoardTemplate {
  return BOARD_TEMPLATES.find((t) => t.key === key) ?? BOARD_TEMPLATES[1];
}

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

function makeGoal(rand: () => number, tpl: GoalTemplate, scale = 1): { goal: TileGoal; drinkId?: string } {
  const [min, max] = tpl.range;
  const target = Math.max(1, Math.round((min + rand() * (max - min)) * scale));
  const { label, drinkId } = tpl.make(target, rand);
  return { goal: { type: tpl.type, label, target }, drinkId };
}

function magnitude(rand: () => number, [min, max]: [number, number]): number {
  return min + Math.floor(rand() * (max - min + 1));
}

/** Checkpoint positions, dodging boss (every 10th) and hard (every 7th) tiles. */
function checkpointPositions(length: number, every: number): Set<number> {
  const set = new Set<number>();
  if (!every) return set;
  for (let p = every; p < length - 1; p += every) {
    let q = p;
    while (q < length - 1 && (q % 10 === 0 || q % 7 === 0)) q += 1;
    if (q > 0 && q < length - 1) set.add(q);
  }
  return set;
}

/**
 * Generate a board from a template. Every tile carries a goal (so nobody can
 * get stranded on a tile with nothing to do) plus its own kind and movement
 * effect. Deterministic for a given (length, template, seed) — and every
 * value here is editable afterwards in the manager's tile editor.
 */
export function generateCampaignBoard(length: number, templateKey: string, seed = 1): Tile[] {
  const tpl = boardTemplate(templateKey);
  const rand = mulberry32(seed);
  const checkpoints = checkpointPositions(length, tpl.checkpointEvery);
  const tiles: Tile[] = [];

  for (let i = 0; i < length; i++) {
    const isFinish = i === length - 1;
    const isBoss = !isFinish && i > 0 && i % 10 === 0;
    const isHard = !isFinish && !isBoss && i > 0 && i % 7 === 0;
    const isCheckpoint = checkpoints.has(i);

    // Opening night is always a straightforward signature count.
    const maker = i === 0 ? SELL_SIGNATURE : weightedPick(rand, tpl.pool);
    const { goal, drinkId } = makeGoal(rand, maker, isFinish || isBoss ? 2 : isHard ? 1.5 : 1);

    let kind: Tile["kind"] = "goal";
    let name = `Shift ${i + 1}`;
    let ruleText: string | undefined;
    let movementEffect = 0;

    if (i === 0) {
      kind = "standard";
      name = "Opening Night";
    } else if (isFinish) {
      kind = "boss";
      name = "Last Call";
      ruleText = "Clear this one and the board's yours. Manager signs it personally.";
    } else if (isBoss) {
      kind = "boss";
      name = "Boss Night";
      ruleText = "Double target, worth three tiles.";
    } else if (isCheckpoint) {
      kind = "checkpoint";
      name = "Stock Check";
      ruleText = "Safe zone — nothing knocks you back past here.";
    } else if (isHard) {
      kind = "goal";
      name = "Double Shift";
      ruleText = "Bigger target, worth two tiles.";
    } else {
      const roll = rand();
      if (i > 3 && roll < tpl.setbackChance) {
        kind = "setback";
        name = pickFrom(rand, DISASTERS);
        movementEffect = -magnitude(rand, tpl.setbackRange);
        ruleText = `Land here and eat it — back ${-movementEffect}.`;
      } else if (i > 2 && roll < tpl.setbackChance + tpl.bonusChance) {
        kind = "standard";
        name = pickFrom(rand, HOT_STREAKS);
        movementEffect = magnitude(rand, tpl.bonusRange);
        ruleText = `Land here and skip ahead ${movementEffect}.`;
      } else if (i > 2 && roll < tpl.setbackChance + tpl.bonusChance + tpl.cardChance) {
        kind = "event_card";
        name = "Draw a Card";
        ruleText = "Land here and take one off the top.";
      }
    }

    tiles.push({
      position: i,
      kind,
      name,
      ruleText,
      movementEffect,
      isCheckpoint,
      targetDrinkId: drinkId,
      goal,
      moveValue: isBoss || isFinish ? 3 : isHard ? 2 : 1,
    });
  }
  return tiles;
}

/** Starter deck for a template, ready for replace_event_deck. */
export function templateDeck(templateKey: string): StarterCard[] {
  return boardTemplate(templateKey).cards;
}

// ---------- movement ----------

/** Furthest checkpoint at or below a position. */
export function checkpointFloorAt(tiles: Tile[], position: number): number {
  let floor = 0;
  for (const t of tiles) {
    if (t.isCheckpoint && t.position <= position && t.position > floor) floor = t.position;
  }
  return floor;
}

/** Weighted draw from the cards playable on a tile. */
export function drawCard(cards: EventCard[], position: number, rand = Math.random): EventCard | null {
  const playable = cards.filter((c) => c.tilePosition == null || c.tilePosition === position);
  if (playable.length === 0) return null;
  const total = playable.reduce((a, c) => a + Math.max(1, c.weight), 0);
  let roll = rand() * total;
  for (const c of playable) {
    roll -= Math.max(1, c.weight);
    if (roll <= 0) return c;
  }
  return playable[playable.length - 1];
}

/**
 * Apply a signed-off shift goal. Mirrors _apply_quest_approval in SQL:
 * clearing the final tile wins; otherwise advance by the tile's moveValue,
 * then resolve the landing tile once — its movementEffect, or a card draw —
 * never below the player's checkpoint floor.
 */
export function applyQuestApproval(
  game: Game,
  player: Player,
  rand: () => number = Math.random,
): { player: Player; events: BoardEvent[] } {
  const events: BoardEvent[] = [];
  const p: Player = { ...player, progress: 0, awaitingApproval: false };

  if (p.position >= game.boardLength - 1) {
    p.finished = true;
    events.push({
      playerId: p.id,
      kind: "win",
      message: `*** ${p.name} rang Last Call — drinks are on them ***`,
    });
    return { player: p, events };
  }

  const from = game.tiles[p.position];
  p.position = Math.min(p.position + from.moveValue, game.boardLength - 1);
  let floor = Math.max(p.checkpointFloor, checkpointFloorAt(game.tiles, p.position));

  events.push({
    playerId: p.id,
    kind: "advance",
    message: `${p.name} ticked off “${from.goal.label}”${
      from.moveValue > 1 ? ` — big move, ${from.moveValue} tiles` : ""
    } → “${game.tiles[p.position].name}”`,
  });

  const landed = game.tiles[p.position];
  let effect = landed.movementEffect;

  if (landed.kind === "event_card") {
    const card = drawCard(game.cards, landed.position, rand);
    effect = card ? card.movementEffect : 0;
    if (card) {
      events.push({
        playerId: p.id,
        kind: "card",
        message: `${p.name} drew “${card.name}” — ${card.ruleText ?? `${card.movementEffect >= 0 ? "ahead" : "back"} ${Math.abs(card.movementEffect)}`}`,
      });
    }
  }

  if (effect !== 0) {
    const wanted = p.position + effect;
    p.position = Math.max(floor, Math.min(wanted, game.boardLength - 1));
    if (wanted < floor) {
      // The checkpoint took the hit instead of the player.
      events.push({
        playerId: p.id,
        kind: "checkpoint",
        message: `“${game.tiles[floor].name}” held the line — ${p.name} stops at tile ${floor + 1}`,
      });
    } else if (landed.kind !== "event_card") {
      events.push({
        playerId: p.id,
        kind: effect > 0 ? "bonus" : "setback",
        message: `${landed.name}! ${p.name} ${effect > 0 ? "skips ahead" : "eats it, back"} ${Math.abs(effect)} → tile ${p.position + 1}`,
      });
    }
  }

  floor = Math.max(floor, checkpointFloorAt(game.tiles, p.position));
  p.checkpointFloor = floor;

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
  p.checkpointFloor = checkpointFloorAt(game.tiles, p.position);
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

// ---------- square board geometry ----------

export interface RingCell {
  position: number;
  /** 1-indexed CSS grid coordinates. */
  row: number;
  col: number;
  corner: boolean;
}

export interface RingLayout {
  cols: number;
  rows: number;
  cells: RingCell[];
}

/**
 * Lay n tiles clockwise around the perimeter of a grid, starting top-left.
 * Picks the grid whose perimeter fits n exactly where possible (30 tiles →
 * a 9×8 ring, zero gaps) and is otherwise as square as it can be. Corner
 * cells are flagged so the board can give them Monopoly-style weight.
 */
export function ringLayout(n: number): RingLayout {
  let best = { cols: 4, rows: 4, score: Number.POSITIVE_INFINITY };
  for (let cols = 4; cols <= 24; cols++) {
    for (let rows = 4; rows <= 24; rows++) {
      const perimeter = 2 * cols + 2 * rows - 4;
      if (perimeter < n) continue;
      // Prefer no empty cells first, then the squarest shape.
      const score = (perimeter - n) * 20 + Math.abs(cols - rows);
      if (score < best.score) best = { cols, rows, score };
    }
  }

  const { cols, rows } = best;
  const path: Array<[number, number]> = [];
  for (let c = 0; c < cols; c++) path.push([0, c]); // top, left → right
  for (let r = 1; r < rows; r++) path.push([r, cols - 1]); // right, down
  for (let c = cols - 2; c >= 0; c--) path.push([rows - 1, c]); // bottom, right → left
  for (let r = rows - 2; r >= 1; r--) path.push([r, 0]); // left, up

  const cells: RingCell[] = [];
  for (let i = 0; i < n && i < path.length; i++) {
    const [r, c] = path[i];
    cells.push({
      position: i,
      row: r + 1,
      col: c + 1,
      corner: (r === 0 || r === rows - 1) && (c === 0 || c === cols - 1),
    });
  }
  return { cols, rows, cells };
}
