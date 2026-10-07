// Shared by the smoke tests: play one full specs test through the UI.
// The answer comes from the house menu — the first printed line of the
// build, matched against each option's clues — so the run scores points
// and the test doesn't depend on luck.

import fs from "node:fs";

const src = fs.readFileSync(new URL("../lib/recipes.ts", import.meta.url), "utf8");
const menuSrc = src.match(/export const MENU[^=]*=\s*(\[[\s\S]*?\n\]);/)[1];
const MENU = new Function(`return ${menuSrc}`)();
const firstClue = new Map(MENU.map((r) => [r.name, r.clues[0]]));

export async function playSpecsGame(page, opponent = "barback") {
  await page.click(`[data-testid="opponent-${opponent}"]`);
  for (let round = 1; round <= 10; round++) {
    await page.waitForSelector(`[data-testid="round-label"]:has-text("Round ${round} of 10")`);
    await page.waitForSelector(".clue.revealed");
    const shown = (await page.locator(".clue.revealed").first().innerText()).trim();
    const options = await page.locator(".option").allInnerTexts();
    const pick = Math.max(0, options.findIndex((o) => firstClue.get(o.trim()) === shown));
    await page.locator(".option").nth(pick).click();
    await page.waitForSelector('[data-testid="round-result"]');
    await page.click(round === 10 ? "text=Cash out" : "text=Next round");
  }
  await page.waitForSelector('[data-testid="final-player-score"]');
  await page.waitForFunction(
    () => !document.querySelector('[data-testid="save-note"]')?.textContent?.includes("putting it in the book"),
  );
  return Number(await page.locator('[data-testid="final-player-score"]').innerText());
}
