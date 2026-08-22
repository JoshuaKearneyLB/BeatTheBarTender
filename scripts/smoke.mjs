// Browser smoke test of Demo Mode (mobile viewport). Exercises the quest
// loop (progress → submit → pending), the manager console (batch approve
// moves the seeded player), and the training mini-game. Run a production
// server first:
//   npm run build && npm start
// Then: npm run test:e2e
// Env: BASE_URL (default http://localhost:3000), CHROMIUM_BIN (browser path).

import { chromium } from "playwright-core";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const executablePath =
  process.env.CHROMIUM_BIN ??
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";

const browser = await chromium.launch({ executablePath });
const errors = [];
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push("console: " + m.text());
});

try {
  // Home → bartender view
  await page.goto(BASE + "/");
  await page.waitForSelector("text=Baropoly");
  await page.click("text=I'm tending bar");
  await page.waitForURL("**/game/demo");
  await page.waitForSelector("text=Demo Mode");

  // Till pad shows the tile-1 shift goal; the opener must come from the
  // official menu ("Sell N <drink>")
  await page.waitForSelector("text=Tile 1");
  const goalLabel = await page.locator('[data-testid="goal-label"]').innerText();
  if (!/^Sell \d+ /.test(goalLabel)) {
    throw new Error(`opening goal not menu-based: "${goalLabel}"`);
  }
  const plus = page.locator('[aria-label="Increase progress"]');
  for (let i = 0; i < 3; i++) {
    await plus.click();
    await page.waitForTimeout(120);
  }
  await page.waitForTimeout(450); // let the flip animation settle to one span
  const counter = await page.locator('[data-testid="goal-count"]').last().innerText();
  if (!counter.trim().startsWith("3")) throw new Error(`expected count 3, got "${counter}"`);
  await page.screenshot({ path: "/tmp/baropoly-bartender.png" });

  // Trophy → prize modal → close
  await page.click('[data-testid="prize-trophy"]');
  await page.waitForSelector('[data-testid="prize-title"]');
  const prizeTitle = await page.locator('[data-testid="prize-title"]').innerText();
  if (!/£|cash|winner/i.test(prizeTitle)) throw new Error(`prize title looks wrong: "${prizeTitle}"`);
  await page.waitForTimeout(600); // let the poster settle before the shot
  await page.screenshot({ path: "/tmp/baropoly-prize.png" });
  await page.click('[aria-label="Close the prize"]');
  await page.waitForSelector('[data-testid="prize-title"]', { state: "detached" });

  // Full square board: every tile placed, centre stats, tile popover
  await page.click("text=Full board");
  await page.waitForSelector('[data-testid="square-tile-0"]');
  const squareTiles = await page.locator('[data-testid^="square-tile-"]').count();
  if (squareTiles !== 30) throw new Error(`square board placed ${squareTiles} tiles, expected 30`);
  const daysLeft = await page.locator('[data-testid="days-left"]').innerText();
  if (!/^\d+$/.test(daysLeft.trim())) throw new Error(`days-left not a number: "${daysLeft}"`);
  await page.waitForTimeout(300);
  await page.screenshot({ path: "/tmp/baropoly-square.png" });

  // Tile 3 has Marco and Dee nearby; tap tile 2 (Marco's seeded position)
  await page.click('[data-testid="square-tile-2"]');
  await page.waitForSelector("text=Standing here");
  await page.waitForTimeout(400);
  await page.screenshot({ path: "/tmp/baropoly-tile-popover.png" });
  await page.click('[aria-label="Close tile"]');
  await page.waitForTimeout(300);

  // Back to the rail for the till pad
  await page.click("text=The rail");
  await page.waitForSelector('[data-testid="goal-label"]');

  // Send for sign-off → waiting state
  await page.click("text=Send for sign-off");
  await page.waitForSelector("text=Waiting on manager sign-off");

  // Manager: campaign builder → console → batch approve the seeded queue
  await page.goto(BASE + "/manager");
  await page.waitForSelector("text=Chalk up the board");
  await page.waitForSelector("text=Chaos Shift"); // board templates rendered
  // Managers must be able to set the prize at setup, not just inherit defaults
  await page.waitForSelector('input[aria-label="Prize title"]');
  await page.fill('input[aria-label="Prize title"]', "Winner: £250 + a Friday off");
  await page.click("text=Open the board");
  await page.waitForURL("**/manager/demo");
  await page.waitForSelector("text=Sign-off queue");
  await page.waitForSelector("text=says"); // Marco's seeded count
  await page.click("text=Sign off 1");
  await page.waitForSelector("text=Marco ticked off");
  await page.waitForSelector("text=signed off"); // the book
  await page.screenshot({ path: "/tmp/baropoly-manager.png" });

  // Board builder: full tile map, editor drawer, custom setback + checkpoint
  await page.click("text=Board builder");
  await page.waitForSelector('[data-testid="builder-tile-0"]');
  const tileCount = await page.locator('[data-testid^="builder-tile-"]').count();
  if (tileCount !== 30) throw new Error(`builder shows ${tileCount} tiles, expected 30`);
  const deckCount = await page.locator("text=The deck").count();
  if (deckCount < 1) throw new Error("event card deck missing from builder");

  await page.click('[data-testid="builder-tile-5"]');
  await page.waitForSelector('[data-testid="tile-movement-effect"]');
  const menuOptions = await page.locator('select[aria-label="Pick a menu drink"] option').count();
  if (menuOptions < 26) throw new Error(`menu dropdown too small: ${menuOptions} options`);

  await page.fill('input[aria-label="Tile name"]', "Dirty Well Penalty");
  await page.fill('[data-testid="tile-movement-effect"]', "-3");
  await page.click('button[aria-label="Checkpoint off"]').catch(() => {});
  await page.screenshot({ path: "/tmp/baropoly-builder-drawer.png" });
  await page.click('[data-testid="save-tile"]');
  await page.waitForSelector("text=Dirty Well Penalty");
  await page.waitForTimeout(500); // let the drawer finish closing
  await page.screenshot({ path: "/tmp/baropoly-builder.png" });

  // Manager owns the prize too
  await page.fill('input[aria-label="Prize title"]', "Winner: £300 + a Friday off");
  await page.click('[data-testid="save-prize"]');
  await page.waitForSelector("text=Pinned up");

  // Training mini-game serves the official 25-drink menu
  const res = await page.goto(BASE + "/training/index.html");
  if (res.status() !== 200) throw new Error("training game not served");
  await page.waitForSelector("text=Beat the Bartender");
  const drinkCount = await page.evaluate(() => COCKTAILS.length);
  if (drinkCount !== 25) throw new Error(`training menu has ${drinkCount} drinks, expected 25`);
  const hasHouse = await page.evaluate(() =>
    COCKTAILS.some((c) => c.name === "Hacien Pineapple Spritz"),
  );
  if (!hasHouse) throw new Error("official menu drink missing from training data");

  if (errors.length) throw new Error("JS errors:\n" + errors.join("\n"));
  console.log("SMOKE PASSED");
} catch (e) {
  console.error("SMOKE FAILED:", e.message);
  process.exitCode = 1;
} finally {
  await browser.close();
}
