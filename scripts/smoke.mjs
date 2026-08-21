// Browser smoke test of Demo Mode (mobile viewport). Exercises the full
// bartender loop (tally → tile advance → undo), the manager console
// (override), and the training mini-game. Run a production server first:
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

  // Tally 4 cocktails → with 3 units/tile the token must advance a tile
  const cocktailBtn = page.locator("button", { hasText: "+1 Cocktail" });
  for (let i = 0; i < 4; i++) {
    await cocktailBtn.click();
    await page.waitForTimeout(150);
  }
  const shiftCount = await cocktailBtn.locator("span").nth(2).innerText();
  if (!shiftCount.startsWith("4")) throw new Error(`expected 4 tallied, got "${shiftCount}"`);
  const ticker = await page.locator("ul").first().innerText();
  if (!/advances/.test(ticker)) throw new Error("no advance event in ticker");
  await page.screenshot({ path: "/tmp/baropoly-bartender.png" });

  // Undo
  await page.click("text=Undo");
  await page.waitForTimeout(200);
  const afterUndo = await cocktailBtn.locator("span").nth(2).innerText();
  if (!afterUndo.startsWith("3")) throw new Error(`undo failed: "${afterUndo}"`);

  // Manager: setup → console → override
  await page.goto(BASE + "/manager");
  await page.waitForSelector("text=Set up the shift");
  await page.click("text=Start the game");
  await page.waitForURL("**/manager/demo");
  await page.waitForSelector("text=Audit feed");
  await page.click('[aria-label="Advance You"]');
  await page.waitForTimeout(300);
  if ((await page.locator("text=Manager advanced").count()) < 1) {
    throw new Error("override event did not appear");
  }
  await page.screenshot({ path: "/tmp/baropoly-manager.png" });

  // Training mini-game still served
  const res = await page.goto(BASE + "/training/index.html");
  if (res.status() !== 200) throw new Error("training game not served");
  await page.waitForSelector("text=Beat the Bartender");

  if (errors.length) throw new Error("JS errors:\n" + errors.join("\n"));
  console.log("SMOKE PASSED");
} catch (e) {
  console.error("SMOKE FAILED:", e.message);
  process.exitCode = 1;
} finally {
  await browser.close();
}
