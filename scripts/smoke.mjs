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

  // Send for sign-off → waiting state
  await page.click("text=Send for sign-off");
  await page.waitForSelector("text=Waiting on manager sign-off");

  // Manager: campaign builder → console → batch approve the seeded queue
  await page.goto(BASE + "/manager");
  await page.waitForSelector("text=Chalk up the board");
  await page.waitForSelector("text=Cocktail Focus"); // presets rendered
  // Goal builder: tile list carries the official-menu drink dropdown
  await page.click("text=Rework the tiles");
  await page.waitForSelector('select[aria-label="Pick a menu drink for tile 1"]');
  const menuOptions = await page
    .locator('select[aria-label="Pick a menu drink for tile 1"] option')
    .count();
  if (menuOptions < 26) throw new Error(`menu dropdown too small: ${menuOptions} options`);
  await page.click("text=Rework the tiles"); // collapse again
  await page.click("text=Open the board");
  await page.waitForURL("**/manager/demo");
  await page.waitForSelector("text=Sign-off queue");
  await page.waitForSelector("text=says"); // Marco's seeded count
  await page.click("text=Sign off 1");
  await page.waitForSelector("text=Marco ticked off");
  await page.waitForSelector("text=signed off"); // the book
  await page.screenshot({ path: "/tmp/baropoly-manager.png" });

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
