"use client";

// Beat the Bartender, inside the app. The mechanics are the standalone
// game's, unchanged: ten rounds, the build prints a line every three
// seconds, call it early for more points, and the house is playing too.
// What's new is the end of the game: it's saved, and a new personal best
// gets stamped on the final tab.

import { useEffect, useReducer, useRef, useState } from "react";
import Link from "next/link";
import {
  DIFFICULTIES,
  FIRST_REVEAL_MS,
  REVEAL_INTERVAL_MS,
  ROUNDS_PER_GAME,
  bestsFor,
  dealDeck,
  isNewBest,
  resolveRound,
  revealNext,
  startRound,
  summariseRun,
  toRoundRecord,
  type Difficulty,
  type Round,
  type RoundRecord,
  type SpecsRun,
} from "@/lib/specs";
import { loadProfile } from "@/lib/profile";
import { loadRuns, saveRun, type SaveResult } from "@/lib/specsStore";
import type { Recipe } from "@/lib/recipes";

// ---------- game state ----------

interface State {
  phase: "start" | "round" | "end";
  difficulty: Difficulty | null;
  deck: Recipe[];
  roundNo: number;
  round: Round | null;
  playerScore: number;
  houseScore: number;
  streak: number;
  bestStreak: number;
  records: RoundRecord[];
}

const INITIAL: State = {
  phase: "start",
  difficulty: null,
  deck: [],
  roundNo: 0,
  round: null,
  playerScore: 0,
  houseScore: 0,
  streak: 0,
  bestStreak: 0,
  records: [],
};

type Action =
  | { type: "START"; difficulty: Difficulty }
  | { type: "REVEAL" }
  | { type: "GUESS"; choice: string | null }
  | { type: "NEXT" }
  | { type: "MENU" };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "START": {
      const deck = dealDeck();
      return {
        ...INITIAL,
        phase: "round",
        difficulty: action.difficulty,
        deck,
        roundNo: 1,
        round: startRound(deck[0], action.difficulty),
      };
    }
    case "REVEAL":
      if (!state.round || state.round.outcome) return state;
      return { ...state, round: revealNext(state.round) };
    case "GUESS": {
      if (!state.round || state.round.outcome) return state;
      const round = resolveRound(state.round, action.choice);
      const o = round.outcome!;
      const streak = o.playerCorrect ? state.streak + 1 : 0;
      return {
        ...state,
        round,
        playerScore: state.playerScore + o.playerPoints,
        houseScore: state.houseScore + o.housePoints,
        streak,
        bestStreak: Math.max(state.bestStreak, streak),
        records: [...state.records, toRoundRecord(round)],
      };
    }
    case "NEXT":
      if (!state.round?.outcome || !state.difficulty) return state;
      if (state.roundNo >= ROUNDS_PER_GAME) return { ...state, phase: "end" };
      return {
        ...state,
        roundNo: state.roundNo + 1,
        round: startRound(state.deck[state.roundNo], state.difficulty),
      };
    case "MENU":
      return INITIAL;
  }
}

// ---------- the end-of-game save ----------

type Saved =
  | { status: "saving" }
  | { status: "done"; result: SaveResult; isBest: boolean; previous: number | null };

export default function SpecsGame() {
  const [state, dispatch] = useReducer(reducer, INITIAL);
  const [history, setHistory] = useState<SpecsRun[] | null>(null);
  const [saved, setSaved] = useState<Saved | null>(null);
  const nextRef = useRef<HTMLButtonElement>(null);

  const { phase, round, difficulty } = state;

  // Your bests on the opponent picker; refreshed after every game.
  useEffect(() => {
    if (phase !== "start") return;
    let live = true;
    loadRuns()
      .then((runs) => live && setHistory(runs))
      .catch(() => live && setHistory([]));
    return () => {
      live = false;
    };
  }, [phase]);

  // The build prints: first line almost at once, then one every three
  // seconds. Once it's all out, one last beat — then the round is forced.
  const revealed = round?.revealed;
  const over = Boolean(round?.outcome);
  useEffect(() => {
    if (phase !== "round" || !round || round.outcome) return;
    const allOut = round.revealed >= round.drink.clues.length;
    const timer = setTimeout(
      () => dispatch(allOut ? { type: "GUESS", choice: null } : { type: "REVEAL" }),
      round.revealed === 0 ? FIRST_REVEAL_MS : REVEAL_INTERVAL_MS,
    );
    return () => clearTimeout(timer);
  }, [phase, state.roundNo, revealed, over]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keys 1–4 answer; Enter or Space moves on.
  useEffect(() => {
    if (phase !== "round") return;
    function onKey(e: KeyboardEvent) {
      if (!round) return;
      if (!round.outcome && e.key >= "1" && e.key <= "4") {
        const choice = round.options[Number(e.key) - 1];
        if (choice) dispatch({ type: "GUESS", choice });
      } else if (round.outcome && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        dispatch({ type: "NEXT" });
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [phase, round]);

  useEffect(() => {
    if (over) nextRef.current?.focus();
  }, [over]);

  // Cash out: record the game and check it against everything before it.
  useEffect(() => {
    if (phase !== "end" || !difficulty) return;
    let live = true;
    const run = summariseRun(difficulty.key, state.records, state.bestStreak, loadProfile()?.name);
    setSaved({ status: "saving" });
    (async () => {
      const earlier = history ?? (await loadRuns().catch(() => []));
      const { isBest, previous } = isNewBest(run, earlier);
      const result = await saveRun(run);
      if (live) setSaved({ status: "done", result, isBest, previous });
    })();
    return () => {
      live = false;
    };
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- start ----------

  if (phase === "start") {
    return (
      <div className="specs-test">
        <header className="masthead">
          <p className="ticket-label">Specs test · house menu</p>
          <h1>Beat the Bartender</h1>
          <p className="tagline">
            ten serves off our own menu.
            <br />
            one smug bartender. know your specs.
          </p>
        </header>

        <div className="rules">
          <h2>House rules</h2>
          <ol>
            <li>The build prints out one line at a time — house measures and all.</li>
            <li>Call the drink early. Fewer lines showing, more points.</li>
            <li>The other one behind the bar is playing too. When they call it, you&apos;re on the clock.</li>
            <li>Biggest tab after ten rounds takes it. Keys 1–4 answer.</li>
          </ol>
        </div>

        <p className="ticket-label picker-head">Who are you up against?</p>
        <div className="difficulty-picker" aria-label="Pick your opponent">
          {DIFFICULTIES.map((d) => {
            const best = history ? bestsFor(history, d.key).bestScore : null;
            return (
              <button
                key={d.key}
                className="difficulty"
                data-testid={`opponent-${d.key}`}
                onClick={() => {
                  setSaved(null);
                  dispatch({ type: "START", difficulty: d });
                }}
              >
                <span className="d-label">{d.label}</span>
                <span className="d-leader" />
                <span className="d-blurb">
                  {d.blurb}
                  {best !== null && <span className="d-best">your best: {best}</span>}
                </span>
              </button>
            );
          })}
        </div>

        <Link href="/bests" className="bests-link">
          my personal bests →
        </Link>
      </div>
    );
  }

  // ---------- end ----------

  if (phase === "end" && difficulty) {
    const won = state.playerScore > state.houseScore;
    const tied = state.playerScore === state.houseScore;
    return (
      <div className="specs-test">
        <div className="screen-end">
          <div className="final-receipt">
            <p className="ticket-label final-head">★ final tab ★</p>
            <h2 className="final-title">
              {won ? "You beat the bartender" : tied ? "Dead heat — split the tips" : `${difficulty.name} keeps the bar`}
            </h2>

            {saved?.status === "done" && saved.isBest && (
              <div className="new-best" data-testid="new-best">
                <span className="new-best-stamp">New personal best</span>
                <span className="new-best-line">
                  {saved.previous === null
                    ? `first score against ${difficulty.name}: ${state.playerScore}`
                    : `${saved.previous} → ${state.playerScore} against ${difficulty.name}`}
                </span>
              </div>
            )}

            <div className="final-scores">
              <div>
                <div className="who">You</div>
                <div className="big" data-testid="final-player-score">
                  {state.playerScore}
                </div>
              </div>
              <div>
                <div className="who">{difficulty.name}</div>
                <div className="big">{state.houseScore}</div>
              </div>
            </div>
            <p className="final-meta">Best run: {state.bestStreak} on the trot</p>
            <ol className="final-rounds">
              {state.records.map((h, i) => (
                <li key={i} className={h.correct ? "won" : "lost"}>
                  <span className="round-no">{i + 1}</span>
                  <span className="round-name">{h.drink}</span>
                  <span className="round-pts">
                    {h.correct ? "✓" : "✗"} {h.points} vs {h.housePoints}
                  </span>
                </li>
              ))}
            </ol>
            <p className="save-note" data-testid="save-note">
              {!saved || saved.status === "saving"
                ? "putting it in the book…"
                : saved.result.where === "cloud"
                  ? "in the book."
                  : saved.result.error
                    ? "couldn't reach the book — kept on this phone, sent next time."
                    : "kept on this phone."}
            </p>
          </div>
          <button className="btn-primary" onClick={() => dispatch({ type: "MENU" })}>
            Run it back
          </button>
          <Link href="/bests" className="bests-link">
            my personal bests →
          </Link>
        </div>
      </div>
    );
  }

  // ---------- a round ----------

  if (!round || !difficulty) return null;
  const o = round.outcome;
  const houseStatus = o
    ? o.houseScored
      ? ["is insufferable about it.", "locked"]
      : ["is sulking.", ""]
    : round.houseLocked
      ? ["has already called it…", "locked"]
      : ["is squinting at it…", ""];

  return (
    <div className="specs-test">
      <div className="scoreboard">
        <div>
          <span className="who">You</span>
          <span className="score" data-testid="player-score">
            {state.playerScore}
          </span>
        </div>
        <span className="streak">{state.streak > 1 ? `${state.streak} on the trot` : ""}</span>
        <span className="round-label" data-testid="round-label">
          Round {state.roundNo} of {ROUNDS_PER_GAME}
        </span>
        <div>
          <span className="who">{difficulty.name}</span>
          <span className="score">{state.houseScore}</span>
        </div>
      </div>

      <p className={`house-status ${houseStatus[1]}`}>
        {difficulty.name} {houseStatus[0]}
      </p>

      <div className="clue-card">
        <h2>★ the build ★</h2>
        <ul className="clues">
          {round.drink.clues.map((clue, i) => {
            const shown = o || i < round.revealed;
            return (
              <li key={i} className={`clue ${shown ? "revealed" : "hidden-clue"}`}>
                {shown ? clue : "·····································"}
              </li>
            );
          })}
        </ul>
      </div>

      <div className="options" aria-label="Call it">
        {round.options.map((name) => (
          <button
            key={name}
            className={`option ${o && name === round.drink.name ? "correct" : ""} ${
              o && name === o.choice && !o.playerCorrect ? "wrong" : ""
            }`}
            disabled={Boolean(o)}
            onClick={() => dispatch({ type: "GUESS", choice: name })}
          >
            {name}
          </button>
        ))}
      </div>

      {o && (
        <>
          <div className="round-result" data-testid="round-result">
            <p>
              {o.playerCorrect ? (
                <span className="stamp good">called it</span>
              ) : (
                <span className="stamp bad">{o.choice === null ? "too slow" : "wrong pour"}</span>
              )}
            </p>
            <p>
              {o.playerCorrect ? (
                <>
                  that&apos;s the <span className="drink">{round.drink.name}</span> — +{o.playerPoints} on the
                  tab.
                </>
              ) : (
                <>
                  it was the <span className="drink">{round.drink.name}</span>.
                </>
              )}
            </p>
            <p className="house-line">
              {o.houseScored
                ? `${difficulty.name} called it too — ${o.housePoints} to the house.`
                : `${difficulty.name} got it wrong. nothing for the house.`}
            </p>
            <p className="serve-note">Garnish: {round.drink.garnish}</p>
          </div>
          <button ref={nextRef} className="btn-primary" onClick={() => dispatch({ type: "NEXT" })}>
            {state.roundNo >= ROUNDS_PER_GAME ? "Cash out" : "Next round"}
          </button>
        </>
      )}
    </div>
  );
}
