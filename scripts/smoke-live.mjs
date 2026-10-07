// Live-mode smoke test: two separate phones (browser contexts = separate
// anonymous Supabase sessions) racing through a real Supabase project.
// Manager opens a race → bartender types the code → joins → rings in to
// the win → the manager sees it over Realtime → till check reopens it.
//
// Needs a build made WITH the Supabase env vars, served by `npm start`,
// against a project with the migrations applied and anonymous sign-ins on.
//   NEXT_PUBLIC_SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_ANON_KEY=... npm run build
//   npm start &  npm run test:e2e:live
// Env: BASE_URL (default http://localhost:3000), CHROMIUM_BIN, SHOTS_DIR.

import { chromium } from "playwright-core";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const SHOTS = process.env.SHOTS_DIR ?? "/tmp";
const executablePath =
  process.env.CHROMIUM_BIN ??
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";

// Behind an egress proxy (CI, sandboxes) the browser needs telling; local
// servers stay direct.
const proxyServer = process.env.HTTPS_PROXY ?? process.env.https_proxy;
const browser = await chromium.launch({
  executablePath,
  ...(proxyServer && { proxy: { server: proxyServer, bypass: "localhost,127.0.0.1" } }),
});
const errors = [];
const phone = { viewport: { width: 390, height: 844 } };

async function newPhone(label) {
  const ctx = await browser.newContext(phone);
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${label} pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`${label} console: ${m.text()}`);
  });
  return page;
}

try {
  const boss = await newPhone("manager");
  const bar = await newPhone("bartender");

  // Manager opens a real race, first to 3
  await boss.goto(BASE + "/manager");
  await boss.waitForSelector("text=Start a race");
  await boss.waitForSelector("text=or try this race as a demo first");
  await boss.selectOption('select[aria-label="Drink"]', { label: "Aperol Spritz" });
  await boss.fill('input[aria-label="Target"]', "3");
  await boss.fill('input[aria-label="Prize"]', "Tab on the house");
  await boss.click("text=Race to 3");
  await boss.waitForURL(/\/manager\/[0-9a-f-]{36}$/);
  await boss.waitForSelector('[data-testid="race-code"]');
  const code = (await boss.locator('[data-testid="race-code"]').innerText()).trim();
  if (!/^[A-Z2-9]{5}$/.test(code)) throw new Error(`odd race code "${code}"`);
  const shareLink = await boss.locator('[data-testid="share-link"]').innerText();
  if (!shareLink.endsWith(`/join/${code}`)) throw new Error(`share link is "${shareLink}"`);
  await boss.screenshot({ path: `${SHOTS}/live-manager-open.png`, fullPage: true });

  // Bartender types the code on the front door (lowercase on purpose)
  await bar.goto(BASE + "/");
  await bar.fill("#race-code", code.toLowerCase());
  await bar.click('[aria-label="Join the race"]');
  await bar.waitForURL(/\/game\/[0-9a-f-]{36}$/);
  await bar.waitForSelector("text=Clock in");
  await bar.fill('input[placeholder="What do they shout across the bar?"]', "Ana");
  await bar.click("text=Clock in");
  await bar.waitForSelector('[aria-label="Sold one"]');
  const drink = await bar.locator('[data-testid="race-drink"]').innerText();
  if (drink !== "Aperol Spritz") throw new Error(`bar view shows "${drink}"`);

  // Manager sees Ana arrive over Realtime
  await boss.waitForSelector('[data-testid="leaderboard"] >> text=Ana >> visible=true', { timeout: 15000 });

  // Fast taps: the count must land on exactly 2 without the server echo
  // dragging it backwards, then the third wins
  await bar.click('[aria-label="Sold one"]');
  await bar.click('[aria-label="Sold one"]');
  await bar.waitForTimeout(1500);
  const mid = (await bar.locator('[data-testid="my-count"]').last().innerText()).trim();
  if (mid !== "2") throw new Error(`after two taps the count reads ${mid}`);
  await bar.screenshot({ path: `${SHOTS}/live-bartender.png` });
  await bar.click('[aria-label="Sold one"]');
  await bar.waitForSelector('[data-testid="race-over"] >> text=You sold it first.', { timeout: 15000 });
  await bar.screenshot({ path: `${SHOTS}/live-bartender-won.png` });

  // Manager sees the win live
  await boss.waitForSelector('[data-testid="winner-banner"] >> text=Ana >> visible=true', { timeout: 15000 });
  await boss.screenshot({ path: `${SHOTS}/live-manager-won.png`, fullPage: true });

  // Till check: Ana was one short. The race reopens on both phones.
  await boss.click('[aria-label="Correct Ana down one"]');
  await boss.waitForSelector('[data-testid="winner-banner"]', { state: "detached", timeout: 15000 });
  await bar.waitForSelector('[aria-label="Sold one"]', { timeout: 15000 });
  const after = (await bar.locator('[data-testid="my-count"]').last().innerText()).trim();
  if (after !== "2") throw new Error(`after the till check the bar shows ${after}`);

  // A refresh keeps Ana in the race (same anonymous session, no rejoin)
  await bar.reload();
  await bar.waitForSelector('[aria-label="Sold one"]', { timeout: 15000 });

  // Both phones remember the race on the front door
  await boss.goto(BASE + "/");
  await boss.waitForSelector(`text=manage · ${code}`);
  await bar.goto(BASE + "/");
  await bar.waitForSelector(`text=race · ${code}`);
  await bar.screenshot({ path: `${SHOTS}/live-front-door.png` });

  // A bad code and a bad link fail politely
  await bar.goto(BASE + "/join/ZZZZZ");
  await bar.waitForSelector("text=No race with the code ZZZZZ");
  await bar.goto(BASE + "/game/not-a-race");
  await bar.waitForSelector("text=There's no race at this link");

  // The demo still works on a live deployment
  await bar.goto(BASE + "/manager/demo?drink=Mojito&target=10");
  await bar.waitForSelector("h1:has-text('Mojito')");
  await bar.waitForSelector("text=Demo");

  if (errors.length) throw new Error("JS errors:\n" + errors.join("\n"));
  console.log("LIVE SMOKE PASSED");
} catch (e) {
  console.error("LIVE SMOKE FAILED:", e.message);
  if (errors.length) console.error(errors.join("\n"));
  process.exitCode = 1;
} finally {
  await browser.close();
}
