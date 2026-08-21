# 🍸 Beat the Bartender — the Specs Test

The dead-hours game: ten serves off the venue's **official 25-drink menu**,
exact house builds and measures. Each round the build prints out one line at
a time on a docket — call the drink before the other one behind the bar
does. Fewer lines showing, more points. Biggest tab after ten rounds takes
it. Doubles as spec training for new staff.

Zero dependencies, no build step. It's linked from the app's front door, or
serve the folder on its own:

```sh
npx serve .
# or
python3 -m http.server 8000
```

## How it plays

- **Pick who you're up against.** Sam the barback checks the book; the
  tattooed one is insufferable and correct. Difficulty sets how fast they
  call it and how often they're right.
- **The build prints** every three seconds, ordered least-to-most revealing
  — commodity mixers first, the giveaway branded spirit last. Answer early
  for the bonus (50 base + 50 per line still hidden); a wrong call ends the
  round with nothing.
- **They're playing too.** When they call it, the line under the scoreboard
  turns and you're on the clock — they bank their own points whether or not
  you got it.
- **Keys 1–4** answer; `Enter` moves on.

## Style

Same house style as the app, dialled down — it's a game you sit with for ten
rounds, not a splash screen. Bebas Neue for display, Caveat for the chalk
lines, mono for anything printed. The build lands on thermal-docket paper
with a torn edge, answers are POS quick-keys, verdicts get rubber-stamped,
and the final tab is an itemized receipt. Fonts are the same committed
woff2 files the app uses (`public/fonts/`), loaded by relative path.

## Files

```
index.html        Screens: start / round / final tab
css/styles.css    House style, tamed for gameplay
js/game.js        Round loop, scoring, the opponent, rendering
data/cocktails.js The official 25-drink menu — KEEP IN SYNC with lib/recipes.ts;
                  ingredients ordered least-to-most revealing
```

## Ideas on the back bar

- Reverse mode: given the drink, build it from a well of ingredients
- Garnish-only rounds (harder than they sound)
- Daily challenge on a shared shuffle seed
- Local high score via `localStorage`
