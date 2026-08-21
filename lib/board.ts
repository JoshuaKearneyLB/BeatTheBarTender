// The board engine: pure functions so the same rules run in the browser
// (optimistic updates) and, later, in a server action / edge function
// (authoritative state).

import type { BoardEvent, Game, Player, Tile } from "./types";

const SETBACKS: Array<Pick<Tile, "title" | "description" | "move">> = [
  { title: "Spill on the Rail", description: "Move back 2 spaces.", move: -2 },
  { title: "Keg Kicked", description: "Change it over — back 1 space.", move: -1 },
  { title: "Card Declined", description: "Comp the round. Back 2 spaces.", move: -2 },
  { title: "Glass Wash Down", description: "Polish by hand — back 1 space.", move: -1 },
];

const BONUSES: Array<Pick<Tile, "title" | "description" | "move">> = [
  { title: "Happy Hour", description: "Rush of orders! Skip ahead 1 space.", move: 1 },
  { title: "Big Tipper", description: "Regular loves you — ahead 2 spaces.", move: 2 },
  { title: "Perfect Pour", description: "Flawless round. Skip ahead 1 space.", move: 1 },
];

const CHALLENGES: Array<Pick<Tile, "title" | "description">> = [
  { title: "Signature Spotlight", description: "Next sale must be the house signature cocktail." },
  { title: "Upsell Gauntlet", description: "Land an upsell within your next 3 orders." },
  { title: "Round Builder", description: "Sell a round of 4+ drinks in one order." },
];

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generate a board layout. Deterministic for a given (length, seed) so every
 * client of a game renders the identical board without shipping tile rows —
 * though in Supabase mode tiles are still persisted for auditability.
 */
export function generateBoard(length = 30, seed = 1): Tile[] {
  const rand = mulberry32(seed);
  const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];

  const tiles: Tile[] = [];
  const midCheckpoint = Math.floor(length / 2);

  for (let i = 0; i < length; i++) {
    if (i === 0) {
      tiles.push({ position: i, type: "start", title: "Clock In" });
    } else if (i === length - 1) {
      tiles.push({
        position: i,
        type: "finish",
        title: "Last Call — WIN",
        description: "Manager must approve the win.",
        requiresApproval: true,
      });
    } else if (i === midCheckpoint) {
      tiles.push({
        position: i,
        type: "checkpoint",
        title: "Stock Check",
        description: "Manager spot-check before you continue.",
        requiresApproval: true,
      });
    } else {
      const roll = rand();
      // Keep the first few tiles clean so games start with momentum.
      if (i > 3 && roll < 0.15) {
        tiles.push({ position: i, type: "setback", ...pick(SETBACKS) });
      } else if (i > 2 && roll < 0.3) {
        tiles.push({ position: i, type: "bonus", ...pick(BONUSES) });
      } else if (roll < 0.42) {
        tiles.push({ position: i, type: "challenge", ...pick(CHALLENGES) });
      } else {
        tiles.push({ position: i, type: "progress", title: "Behind the Bar" });
      }
    }
  }
  return tiles;
}

/**
 * Apply tally units to a player and walk them forward tile by tile,
 * resolving landing effects. Effects don't chain (a bonus that lands you on
 * a setback doesn't trigger it) — keeps rounds snappy and un-loopable.
 */
export function applyUnits(
  game: Game,
  player: Player,
  units: number,
): { player: Player; events: BoardEvent[] } {
  const events: BoardEvent[] = [];
  const p: Player = { ...player, tally: { ...player.tally } };
  if (p.finished || p.awaitingApproval) return { player: p, events };

  p.progress += units;

  while (p.progress >= game.actionsPerTile && !p.finished && !p.awaitingApproval) {
    p.progress -= game.actionsPerTile;
    p.position = Math.min(p.position + 1, game.boardLength - 1);
    const tile = game.tiles[p.position];
    events.push({
      playerId: p.id,
      kind: "advance",
      message: `${p.name} advances to “${tile.title}”`,
    });

    if (tile.move) {
      p.position = Math.max(0, Math.min(p.position + tile.move, game.boardLength - 1));
      events.push({
        playerId: p.id,
        kind: tile.move > 0 ? "bonus" : "setback",
        message: `${tile.title}: ${tile.description ?? ""} → tile ${p.position + 1}`,
      });
    }

    const landed = game.tiles[p.position];
    if (landed.requiresApproval) {
      p.awaitingApproval = true;
      events.push({
        playerId: p.id,
        kind: landed.type === "finish" ? "win" : "checkpoint",
        message:
          landed.type === "finish"
            ? `${p.name} reached LAST CALL — awaiting manager approval! 🏆`
            : `${p.name} hit “${landed.title}” — manager check required`,
      });
    }
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
  p.awaitingApproval = game.tiles[p.position].requiresApproval ?? false;
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

/** Manager approves a player parked on a checkpoint/finish tile. */
export function approvePlayer(game: Game, player: Player): { player: Player; won: boolean } {
  const p = { ...player, awaitingApproval: false };
  const won = game.tiles[p.position].type === "finish";
  if (won) p.finished = true;
  return { player: p, won };
}
