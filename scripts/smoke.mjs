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

  // Quest card shows the tile-1 goal with a progress stepper
  await page.waitForSelector("text=Tile 1");
  const plus = page.locator('[aria-label="Increase progress"]');
  for (let i = 0; i < 3; i++) {
    await plus.click();
    await page.waitForTimeout(120);
  }
  const counter = await page.locator("p.text-3xl").innerText();
  if (!counter.trim().startsWith("3")) throw new Error(`expected progress 3, got "${counter}"`);
  await page.screenshot({ path: "/tmp/baropoly-bartender.png" });

  // Submit → pending approval state
  await page.click("text=Submit for verification");
  await page.waitForSelector("text=Pending approval");

  // Manager: campaign builder → console → batch approve the seeded queue
  await page.goto(BASE + "/manager");
  await page.waitForSelector("text=Build the campaign");
  await page.waitForSelector("text=Cocktail Focus"); // presets rendered
  await page.click("text=Launch the marathon");
  await page.waitForURL("**/manager/demo");
  await page.waitForSelector("text=Approval queue");
  await page.waitForSelector("text=claims"); // Marco's seeded submission
  await page.click("text=Approve 1");
  await page.waitForSelector("text=Marco completes");
  await page.waitForSelector("text=approved"); // history row
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
