# 🍸 Beat the Bartender

A fast, zero-dependency cocktail trivia game. Each round, a mystery cocktail's
ingredients are revealed one at a time — guess the drink before the house
bartender locks in their answer. The fewer clues you need, the more you score.
Highest tab after ten rounds wins the shift.

## Play

No build step, no dependencies. Either open `index.html` directly in a
browser, or serve the folder:

```sh
npx serve .
# or
python3 -m http.server 8000
```

Then visit the printed URL.

## How it works

- **Pick your opponent.** Sam the Barback is forgiving; Vesper the Mixologist
  is not. Difficulty controls how quickly the house locks in an answer and how
  often they're right.
- **Clues drip out** every three seconds. Answer early for bonus points
  (50 base + 50 per still-hidden ingredient). A wrong guess ends the round
  with nothing.
- **The house plays too.** When your opponent locks in, you'll see it — they
  score their own points if their answer was right, whether or not you were.
- **Keyboard-friendly.** Keys `1`–`4` pick an answer; `Enter` advances rounds.

## Project layout

```
index.html        Markup and screens (start / game / results)
css/styles.css    Speakeasy-dark theme
js/game.js        Game loop, scoring, house-bartender AI, rendering
data/cocktails.js 36 classic cocktails with ingredients ordered least-to-most revealing
```

## Ideas on the back bar

- Reverse mode: given the drink, build it from a well of ingredients
- Daily challenge with a shared shuffle seed
- Local leaderboard via `localStorage`
- Sound: shaker rattle on reveal, cheer on a streak
