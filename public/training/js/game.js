/**
 * Beat the Bartender — core game logic.
 *
 * Each round, a mystery cocktail's ingredients are revealed one at a time.
 * The earlier you lock in the right answer, the more you score. Meanwhile
 * the house bartender is playing the same round: at some point they lock in
 * an answer of their own. Outscore them over 10 rounds to win the shift.
 */

const ROUNDS_PER_GAME = 10;
const REVEAL_INTERVAL_MS = 3000;
const POINTS_BASE = 50;
const POINTS_PER_HIDDEN = 50;

const DIFFICULTIES = {
  barback: {
    label: "Barback",
    blurb: "Fresh hire, still learning the well drinks.",
    accuracy: 0.55,
    // How many ingredients the bartender needs before locking in (min, max)
    lockIn: [3, 5],
    name: "Sam the Barback",
  },
  bartender: {
    label: "Bartender",
    blurb: "Knows the classics cold. Respectable pour.",
    accuracy: 0.75,
    lockIn: [2, 4],
    name: "Rusty the Bartender",
  },
  mixologist: {
    label: "Mixologist",
    blurb: "Suspenders, hand-carved ice, encyclopedic memory.",
    accuracy: 0.92,
    lockIn: [1, 3],
    name: "Vesper the Mixologist",
  },
};

const state = {
  difficulty: null,
  round: 0,
  playerScore: 0,
  houseScore: 0,
  streak: 0,
  bestStreak: 0,
  deck: [],
  current: null, // per-round state
  revealTimer: null,
  history: [],
};

// ---------- helpers ----------

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function randInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function $(id) {
  return document.getElementById(id);
}

function show(screenId) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
  $(screenId).classList.add("active");
}

// ---------- game flow ----------

function startGame(difficultyKey) {
  state.difficulty = DIFFICULTIES[difficultyKey];
  state.round = 0;
  state.playerScore = 0;
  state.houseScore = 0;
  state.streak = 0;
  state.bestStreak = 0;
  state.deck = shuffle(COCKTAILS).slice(0, ROUNDS_PER_GAME);
  state.history = [];
  $("house-name").textContent = state.difficulty.name;
  nextRound();
}

function nextRound() {
  if (state.round >= ROUNDS_PER_GAME) {
    endGame();
    return;
  }

  const cocktail = state.deck[state.round];
  state.round += 1;

  const [lockMin, lockMax] = state.difficulty.lockIn;
  const houseLockIn = Math.min(randInt(lockMin, lockMax), cocktail.ingredients.length);

  state.current = {
    cocktail,
    revealed: 0,
    houseLockIn,
    houseLocked: false,
    houseCorrect: Math.random() < state.difficulty.accuracy,
    answered: false,
    options: buildOptions(cocktail),
  };

  renderRound();
  show("screen-game");
  scheduleReveal(true);
}

function buildOptions(cocktail) {
  const decoys = shuffle(COCKTAILS.filter((c) => c.name !== cocktail.name))
    .slice(0, 3)
    .map((c) => c.name);
  return shuffle([cocktail.name, ...decoys]);
}

function scheduleReveal(immediate) {
  clearTimeout(state.revealTimer);
  const delay = immediate ? 400 : REVEAL_INTERVAL_MS;
  state.revealTimer = setTimeout(revealNext, delay);
}

function revealNext() {
  const cur = state.current;
  if (!cur || cur.answered) return;

  if (cur.revealed < cur.cocktail.ingredients.length) {
    cur.revealed += 1;
    renderClues();
  }

  if (!cur.houseLocked && cur.revealed >= cur.houseLockIn) {
    cur.houseLocked = true;
    setHouseStatus("has locked in an answer…", "locked");
  }

  if (cur.revealed >= cur.cocktail.ingredients.length) {
    // All clues out; give the player one last beat, then force the round.
    state.revealTimer = setTimeout(() => resolveRound(null), REVEAL_INTERVAL_MS);
  } else {
    scheduleReveal(false);
  }
}

function onGuess(choice) {
  const cur = state.current;
  if (!cur || cur.answered) return;
  resolveRound(choice);
}

function resolveRound(choice) {
  const cur = state.current;
  cur.answered = true;
  clearTimeout(state.revealTimer);

  const total = cur.cocktail.ingredients.length;
  const hidden = total - cur.revealed;
  const playerCorrect = choice === cur.cocktail.name;
  const playerPoints = playerCorrect ? POINTS_BASE + POINTS_PER_HIDDEN * hidden : 0;

  // The house only scores if they locked in before the round ended and
  // their knowledge check passed.
  const houseScored = cur.houseLocked && cur.houseCorrect;
  const houseHidden = Math.max(0, total - cur.houseLockIn);
  const housePoints = houseScored ? POINTS_BASE + POINTS_PER_HIDDEN * houseHidden : 0;

  state.playerScore += playerPoints;
  state.houseScore += housePoints;

  if (playerCorrect) {
    state.streak += 1;
    state.bestStreak = Math.max(state.bestStreak, state.streak);
  } else {
    state.streak = 0;
  }

  state.history.push({
    cocktail: cur.cocktail.name,
    playerCorrect,
    playerPoints,
    housePoints,
  });

  renderRoundResult(choice, playerCorrect, playerPoints, houseScored, housePoints);
}

function endGame() {
  const won = state.playerScore > state.houseScore;
  const tied = state.playerScore === state.houseScore;

  $("final-title").textContent = won
    ? "You beat the bartender! 🏆"
    : tied
      ? "Split the tip jar — it's a tie."
      : `${state.difficulty.name} keeps the crown.`;
  $("final-player-score").textContent = state.playerScore;
  $("final-house-score").textContent = state.houseScore;
  $("final-streak").textContent = state.bestStreak;

  const list = $("final-rounds");
  list.innerHTML = "";
  state.history.forEach((h, i) => {
    const li = document.createElement("li");
    li.className = h.playerCorrect ? "won" : "lost";
    li.innerHTML = `<span class="round-no">${i + 1}</span>
      <span class="round-name">${h.cocktail}</span>
      <span class="round-pts">${h.playerCorrect ? "✓" : "✗"} ${h.playerPoints} vs ${h.housePoints}</span>`;
    list.appendChild(li);
  });

  show("screen-end");
}

// ---------- rendering ----------

function renderRound() {
  const cur = state.current;
  $("round-label").textContent = `Round ${state.round} of ${ROUNDS_PER_GAME}`;
  $("player-score").textContent = state.playerScore;
  $("house-score").textContent = state.houseScore;
  $("streak").textContent = state.streak > 1 ? `🔥 ${state.streak}` : "";
  setHouseStatus("is thinking…", "");

  const clueList = $("clues");
  clueList.innerHTML = "";
  cur.cocktail.ingredients.forEach(() => {
    const li = document.createElement("li");
    li.className = "clue hidden-clue";
    li.textContent = "?????";
    clueList.appendChild(li);
  });

  const optionsBox = $("options");
  optionsBox.innerHTML = "";
  cur.options.forEach((name) => {
    const btn = document.createElement("button");
    btn.className = "option";
    btn.textContent = name;
    btn.addEventListener("click", () => onGuess(name));
    optionsBox.appendChild(btn);
  });

  $("round-result").classList.add("hidden");
  $("btn-next").classList.add("hidden");
}

function renderClues() {
  const cur = state.current;
  const items = $("clues").children;
  for (let i = 0; i < cur.revealed; i++) {
    if (items[i].classList.contains("hidden-clue")) {
      items[i].classList.remove("hidden-clue");
      items[i].classList.add("revealed");
      items[i].textContent = cur.cocktail.ingredients[i];
    }
  }
}

function setHouseStatus(text, cls) {
  const el = $("house-status");
  el.textContent = `${state.difficulty.name} ${text}`;
  el.className = cls;
}

function renderRoundResult(choice, playerCorrect, playerPoints, houseScored, housePoints) {
  // Reveal everything and freeze the options.
  state.current.revealed = state.current.cocktail.ingredients.length;
  renderClues();
  document.querySelectorAll(".option").forEach((btn) => {
    btn.disabled = true;
    if (btn.textContent === state.current.cocktail.name) btn.classList.add("correct");
    else if (btn.textContent === choice) btn.classList.add("wrong");
  });

  const cur = state.current;
  const box = $("round-result");
  const verdict = playerCorrect
    ? `Nailed it — that's the <strong>${cur.cocktail.name}</strong>. +${playerPoints} pts.`
    : choice === null
      ? `Time's up! It was the <strong>${cur.cocktail.name}</strong>.`
      : `Not quite — it was the <strong>${cur.cocktail.name}</strong>.`;
  const houseLine = houseScored
    ? `${state.difficulty.name} called it and pockets ${housePoints} pts.`
    : `${state.difficulty.name} whiffed this one. No points for the house.`;
  box.innerHTML = `<p>${verdict}</p>
    <p class="house-line">${houseLine}</p>
    <p class="serve-note">House spec garnish: ${cur.cocktail.garnish}.</p>`;
  box.classList.remove("hidden");

  $("player-score").textContent = state.playerScore;
  $("house-score").textContent = state.houseScore;
  $("streak").textContent = state.streak > 1 ? `🔥 ${state.streak}` : "";
  setHouseStatus(houseScored ? "smirks." : "grumbles.", houseScored ? "locked" : "");

  const nextBtn = $("btn-next");
  nextBtn.textContent = state.round >= ROUNDS_PER_GAME ? "Final tab →" : "Next round →";
  nextBtn.classList.remove("hidden");
  nextBtn.focus();
}

// ---------- wiring ----------

document.addEventListener("DOMContentLoaded", () => {
  const picker = $("difficulty-picker");
  Object.entries(DIFFICULTIES).forEach(([key, d]) => {
    const btn = document.createElement("button");
    btn.className = "difficulty";
    btn.innerHTML = `<span class="d-label">${d.label}</span><span class="d-blurb">${d.blurb}</span>`;
    btn.addEventListener("click", () => startGame(key));
    picker.appendChild(btn);
  });

  $("btn-next").addEventListener("click", nextRound);
  $("btn-replay").addEventListener("click", () => show("screen-start"));

  // Keyboard shortcuts: 1-4 to answer, Enter/Space for next.
  document.addEventListener("keydown", (e) => {
    if (!$("screen-game").classList.contains("active")) return;
    if (e.key >= "1" && e.key <= "4") {
      const btn = document.querySelectorAll(".option")[Number(e.key) - 1];
      if (btn && !btn.disabled) btn.click();
    } else if ((e.key === "Enter" || e.key === " ") && !$("btn-next").classList.contains("hidden")) {
      e.preventDefault();
      $("btn-next").click();
    }
  });
});
