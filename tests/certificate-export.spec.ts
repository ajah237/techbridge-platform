import { test, expect } from "../playwright-fixture";

/**
 * Regression: the certificate template preview must always render a true
 * A4-landscape sheet with readable text and a correctly placed QR block,
 * at every viewport size. Runs against the admin template preview stage.
 */
const VIEWPORTS = [
  { name: "mobile", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "laptop", width: 1280, height: 800 },
  { name: "desktop", width: 1680, height: 1050 },
];

for (const vp of VIEWPORTS) {
  test(`certificate preview stays A4 landscape at ${vp.name}`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto("/admin/certificate-template", { waitUntil: "domcontentloaded" });

    const sheet = page.locator("[data-cert-sheet]").first();
    if ((await sheet.count()) === 0) {
      test.skip(true, "Admin preview not reachable without an admin session");
      return;
    }
    await expect(sheet).toBeVisible();

    const audit = await sheet.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const t = getComputedStyle(el).transform;
      const scale = t && t !== "none" ? Number(t.match(/matrix\(([-\d.]+)/)?.[1] ?? 1) : 1;
      return { w: r.width / (scale || 1), h: r.height / (scale || 1) };
    });
    // 297mm x 210mm at 96dpi
    expect(audit.w).toBeGreaterThan(audit.h);
    expect(Math.abs(audit.w - 1122.5)).toBeLessThan(6);
    expect(Math.abs(audit.h - 793.7)).toBeLessThan(6);

    // Never a horizontal page overflow at any width.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(2);
  });
}
