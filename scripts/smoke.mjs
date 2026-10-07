// Browser smoke test of Demo Mode (mobile viewport). Exercises the whole
// pitch: a manager opens a race with their own drink/number/prize, the
// bartender view carries it, taps count, undo works, the manager's till
// check can hand out the win, and the bonus specs test still serves.
// Run a production server first:
//   npm run build && npm start
// Then: npm run test:e2e
// Env: BASE_URL (default http://localhost:3000), CHROMIUM_BIN (browser path).

import { chromium } from "playwright-core";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const SHOTS = process.env.SHOTS_DIR ?? "/tmp";
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

async function myCount() {
  await page.waitForTimeout(450); // let the flip animation settle to one span
  return Number((await page.locator('[data-testid="my-count"]').last().innerText()).trim());
}

try {
  // Front door: two choices plus the bonus specs test
  await page.goto(BASE + "/");
  await page.waitForSelector("text=first behind the bar to sell it wins");
  await page.screenshot({ path: `${SHOTS}/race-home.png` });

  // Manager opens a race: their drink, their number, their prize
  await page.click("text=I run the bar");
  await page.waitForSelector("text=Start a race");
  await page.selectOption('select[aria-label="Drink"]', { label: "Espresso Martini" });
  await page.click('button:has-text("10")');
  await page.fill('input[aria-label="Prize"]', "Friday off");
  await page.screenshot({ path: `${SHOTS}/race-setup.png`, fullPage: true });
  await page.click("text=Race to 10");
  await page.waitForURL("**/manager/demo?**");
  await page.waitForSelector("h1:has-text('Espresso Martini')");
  await page.waitForSelector("text=First to 10 wins Friday off");
  await page.waitForSelector('[data-testid="leaderboard"]');
  await page.screenshot({ path: `${SHOTS}/race-manager.png`, fullPage: true });

  // The crew link carries the same race into the bar view
  await page.click("text=try the bar view");
  await page.waitForURL("**/game/demo?**");
  const drink = await page.locator('[data-testid="race-drink"]').innerText();
  if (drink !== "Espresso Martini") throw new Error(`bar view shows "${drink}"`);

  // Tap three, undo one
  const sold = page.locator('[aria-label="Sold one"]');
  for (let i = 0; i < 3; i++) {
    await sold.click();
    await page.waitForTimeout(120);
  }
  if ((await myCount()) !== 3) throw new Error("expected count 3 after three taps");
  await page.click('[aria-label="Undo one"]');
  if ((await myCount()) !== 2) throw new Error("undo did not take one back");

  // Pieces are pixel sprites on the track
  if ((await page.locator(".chip svg").count()) < 4) throw new Error("racer pieces missing");
  await page.screenshot({ path: `${SHOTS}/race-bartender.png` });

  // Trophy → prize poster
  await page.click('[data-testid="prize-trophy"]');
  const prize = await page.locator('[data-testid="prize-title"]').innerText();
  if (prize !== "Friday off") throw new Error(`prize poster shows "${prize}"`);
  await page.click('[aria-label="Close the prize"]');
  await page.waitForSelector('[data-testid="prize-title"]', { state: "detached" });

  // Race to the finish (rivals may get there first — either way it ends)
  for (let i = 0; i < 12; i++) {
    if (await page.locator('[data-testid="race-over"]').count()) break;
    await sold.click();
    await page.waitForTimeout(80);
  }
  await page.waitForSelector('[data-testid="race-over"]');
  await page.screenshot({ path: `${SHOTS}/race-finished.png` });

  // Manager till check: correcting a racer to the target ends the race on them
  await page.goto(BASE + "/manager/demo?target=5&drink=Negroni");
  await page.waitForSelector("h1:has-text('Negroni')");
  for (let i = 0; i < 5; i++) {
    if (await page.locator('[data-testid="winner-banner"]').count()) break;
    await page.click('[aria-label="Correct You up one"]');
    await page.waitForTimeout(80);
  }
  await page.waitForSelector('[data-testid="winner-banner"]');

  // Bonus: the specs test still serves the official 25-drink menu
  const res = await page.goto(BASE + "/training/index.html");
  if (res.status() !== 200) throw new Error("training game not served");
  await page.waitForSelector("text=Beat the Bartender");
  const drinkCount = await page.evaluate(() => COCKTAILS.length);
  if (drinkCount !== 25) throw new Error(`training menu has ${drinkCount} drinks, expected 25`);

  if (errors.length) throw new Error("JS errors:\n" + errors.join("\n"));
  console.log("SMOKE PASSED");
} catch (e) {
  console.error("SMOKE FAILED:", e.message);
  process.exitCode = 1;
} finally {
  await browser.close();
}
