"use client";

// The full board: 30 tiles laid clockwise around a ring, Monopoly-style,
// with the shift ticker and quick stats filling the middle. Tap any tile
// for its rule and who's standing on it.

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Flag, ShieldCheck, X } from "lucide-react";
import { ringLayout } from "@/lib/board";
import type { BoardEvent, Game, Tile } from "@/lib/types";
import EventTicker from "./EventTicker";
import { chalkFor } from "./tileChalk";

export interface BoardStats {
  leaderName: string;
  leaderTile: number;
  daysLeft: number;
  drinksSold: number;
}

interface SquareBoardProps {
  game: Game;
  meId?: string;
  events: BoardEvent[];
  stats: BoardStats;
}

export default function SquareBoard({ game, meId, events, stats }: SquareBoardProps) {
  const [openTile, setOpenTile] = useState<Tile | null>(null);
  const { cols, rows, cells } = ringLayout(game.tiles.length);

  const standing = (position: number) => game.players.filter((p) => p.position === position);

  return (
    <div className="chalkboard p-2">
      <div
        className="grid gap-[3px]"
        style={{
          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
        }}
      >
        {cells.map((cell) => {
          const tile = game.tiles[cell.position];
          if (!tile) return null;
          const chalk = chalkFor(tile);
          const here = standing(cell.position);
          const mine = here.some((p) => p.id === meId);
          const isFinish = cell.position === game.tiles.length - 1;

          return (
            <button
              key={cell.position}
              data-testid={`square-tile-${cell.position}`}
              aria-label={`Tile ${cell.position + 1}: ${tile.name}`}
              onClick={() => setOpenTile(tile)}
              style={{ gridRow: cell.row, gridColumn: cell.col }}
              className={`relative flex aspect-square flex-col justify-between border bg-bar-900/70 p-[3px] text-left ${chalk.border} ${
                cell.corner ? "border-2 bg-bar-800" : ""
              } ${mine ? "ring-1 ring-brass-400 ring-offset-0" : ""}`}
            >
              <span className={`ticket flex items-start justify-between text-[7px] leading-none ${chalk.text}`}>
                <span>{cell.position + 1}</span>
                <span className="flex items-center gap-px">
                  {tile.isCheckpoint && <ShieldCheck className="size-2" />}
                  {isFinish && <Flag className="size-2" />}
                  {!tile.isCheckpoint && !isFinish && chalk.mark}
                </span>
              </span>

              {cell.corner && (
                <span className={`chalk line-clamp-2 text-[8px] leading-[1.05] ${chalk.text}`}>
                  {tile.name}
                </span>
              )}

              {/* players standing here, fanned so nobody hides */}
              <span className="flex min-h-3 items-end justify-center -space-x-1">
                {here.slice(0, 3).map((p) => (
                  <motion.span
                    key={p.id}
                    layoutId={`square-token-${p.id}`}
                    transition={{ type: "spring", stiffness: 240, damping: 24 }}
                    title={p.name}
                    className={`text-[11px] leading-none ${
                      p.id === meId ? "drop-shadow-[0_0_5px_#ffb92e]" : ""
                    }`}
                  >
                    {p.token}
                  </motion.span>
                ))}
                {here.length > 3 && (
                  <span className="ticket pl-0.5 text-[6px] text-cream-400">
                    +{here.length - 3}
                  </span>
                )}
              </span>
            </button>
          );
        })}

        {/* the middle of the board: what's happening and who's winning */}
        <div
          style={{ gridRow: `2 / ${rows}`, gridColumn: `2 / ${cols}` }}
          className="flex flex-col justify-between gap-2 p-2"
        >
          <div>
            <p className="ticket text-[8px] text-cream-400">
              {game.status === "finished" ? "shift over" : "on tonight"}
            </p>
            <h3 className="display text-xl leading-none text-brass-400">{game.name}</h3>
          </div>

          <div className="min-h-0 flex-1 overflow-hidden">
            <EventTicker events={events} />
          </div>

          <dl className="grid grid-cols-3 gap-1 border-t-2 border-dashed border-cream-100/20 pt-1.5">
            <div>
              <dt className="ticket text-[7px] text-cream-400">Leader</dt>
              <dd className="display truncate text-sm leading-tight text-cream-100">
                {stats.leaderName}
              </dd>
              <dd className="ticket text-[7px] text-cream-400">tile {stats.leaderTile}</dd>
            </div>
            <div>
              <dt className="ticket text-[7px] text-cream-400">Days left</dt>
              <dd
                data-testid="days-left"
                className={`display text-sm leading-tight ${stats.daysLeft <= 3 ? "text-danger-400" : "text-cream-100"}`}
              >
                {stats.daysLeft}
              </dd>
            </div>
            <div>
              <dt className="ticket text-[7px] text-cream-400">Rung in</dt>
              <dd className="display text-sm leading-tight text-cream-100">{stats.drinksSold}</dd>
              <dd className="ticket text-[7px] text-cream-400">drinks</dd>
            </div>
          </dl>
        </div>
      </div>

      {/* tile detail */}
      <AnimatePresence>
        {openTile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpenTile(null)}
            className="fixed inset-0 z-40 flex items-end justify-center bg-bar-950/80 sm:items-center"
          >
            <motion.div
              initial={{ y: 40 }}
              animate={{ y: 0 }}
              exit={{ y: 40 }}
              onClick={(e) => e.stopPropagation()}
              className="slab w-full max-w-md space-y-2 border-t-4 border-brass-400 bg-bar-800 p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="ticket text-[10px] text-cream-400">
                    Tile {openTile.position + 1}
                    {openTile.moveValue > 1 && ` · worth ${openTile.moveValue}`}
                  </p>
                  <h3 className="display text-3xl leading-none text-brass-400">{openTile.name}</h3>
                </div>
                <button
                  aria-label="Close tile"
                  onClick={() => setOpenTile(null)}
                  className="rounded border-2 border-bar-600 p-1.5 text-cream-400"
                >
                  <X className="size-4" />
                </button>
              </div>

              <p className="chalk text-xl leading-snug text-cream-100">{openTile.goal.label}</p>

              {openTile.ruleText && (
                <p className="chalk text-lg leading-snug text-cream-400">{openTile.ruleText}</p>
              )}

              {openTile.movementEffect !== 0 && (
                <p
                  className={`ticket text-[10px] ${openTile.movementEffect > 0 ? "text-mint-400" : "text-danger-400"}`}
                >
                  landing here moves you {openTile.movementEffect > 0 ? "+" : ""}
                  {openTile.movementEffect}
                </p>
              )}
              {openTile.isCheckpoint && (
                <p className="ticket text-[10px] text-mint-400">
                  checkpoint — nothing knocks you back past here
                </p>
              )}

              <div className="border-t-2 border-dashed border-bar-600 pt-2">
                <p className="ticket text-[10px] text-cream-400">Standing here</p>
                {standing(openTile.position).length === 0 ? (
                  <p className="chalk text-lg text-cream-400">nobody</p>
                ) : (
                  <ul className="mt-1 space-y-0.5">
                    {standing(openTile.position).map((p) => (
                      <li key={p.id} className="flex items-center gap-2">
                        <span className="text-lg">{p.token}</span>
                        <span className="display text-lg text-cream-100">{p.name}</span>
                        {p.awaitingApproval && (
                          <span className="chalk text-base text-brass-400">waiting on sign-off</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
