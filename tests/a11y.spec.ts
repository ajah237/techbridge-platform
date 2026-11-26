import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const BASE = process.env.BASE_URL || "http://localhost:8080";

const PUBLIC_PAGES = [
  "/",
  "/about",
  "/events",
  "/programs",
  "/services",
  "/mentors",
  "/blog",
  "/forum",
  "/projects",
  "/leaderboard",
  "/contact",
  "/auth",
  "/verify",
  "/privacy",
  "/terms",
];

for (const path of PUBLIC_PAGES) {
  test(`a11y: ${path}`, async ({ page }) => {
    await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle").catch(() => {});
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    const serious = results.violations.filter((v) =>
      ["serious", "critical"].includes(v.impact ?? "")
    );

    if (serious.length) {
      console.log(`\n--- a11y violations on ${path} ---`);
      for (const v of serious) {
        console.log(`[${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} nodes)`);
        console.log(`   ${v.helpUrl}`);
      }
    }
    expect(serious, `Serious/critical a11y violations on ${path}`).toEqual([]);
  });
}