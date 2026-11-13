import { createRequire } from "node:module";
import { mkdir, readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const { chromium } = createRequire(import.meta.url)("playwright");
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
});
await mkdir("work/qa-option1", { recursive: true });
const errors = [];
async function media(page) {
  await page.route("https://videos.pexels.com/**", async (route) =>
    route.fulfill({
      contentType: "video/mp4",
      body: await readFile("public/films/hero/highlands.mp4"),
    }),
  );
  page.on("pageerror", (e) => errors.push(e.message));
}
async function decoded(locator) {
  // Streaming Next responses may briefly retain a hidden boundary copy.
  const visible = locator.filter({ visible: true });
  await visible.waitFor({ state: "visible" });
  await visible.evaluate((el) => el.decode());
  await visible.waitFor({ state: "visible" });
}
try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await media(page);
  await page.goto("http://localhost:3008", { waitUntil: "domcontentloaded" });
  const globe = page.locator(".hero-globe-preview img");
  await decoded(globe);
  await decoded(page.locator(".hero-gallery-landscape"));
  await decoded(page.locator(".trip-film-brand img"));
  assert.ok((await page.locator(".trip-film-brand img").getAttribute("src")).includes("life-atlas-white"));
  assert.equal(await page.locator(".trip-film-hero canvas").count(), 0);
  const globeBounds = await globe.boundingBox();
  const cardBounds = await page.locator(".trip-film-globe-tile").boundingBox();
  assert.ok(globeBounds.width <= 142 && globeBounds.height <= 142);
  assert.ok(globeBounds.x > cardBounds.x && globeBounds.y > cardBounds.y);
  assert.ok(globeBounds.y + globeBounds.height < cardBounds.y + cardBounds.height - 25);
  const before = await globe.evaluate(el => getComputedStyle(el).transform);
  await page.getByRole("link", { name: "Explore the Globe", exact: true }).hover();
  await page.waitForTimeout(600);
  assert.equal(await globe.evaluate(el => getComputedStyle(el).transform), before);
  const gallery = page.getByRole("link", { name: "Photo Gallery", exact: true });
  assert.equal(await gallery.getAttribute("href"), "/photography");
  assert.equal(await page.locator(".trip-film-stage video[poster]").count(), 0);
  await page.getByRole("button", { name: "Pause trip films", exact: true }).click();
  await page.waitForTimeout(900);
  await page.screenshot({ path: "work/qa-option1/desktop.png" });
  await page.locator(".trip-film-discover").screenshot({ path: "work/qa-option1/cards.png" });
  await gallery.click();
  await page.waitForURL("**/photography");
  await decoded(page.locator(".public-header .atlas-logo-brand img"));
  assert.ok((await page.locator(".public-header .atlas-logo-brand img").getAttribute("src")).includes("life-atlas-black"));
  await page.screenshot({ path: "work/qa-option1/public-header.png" });
  await page.goBack();
  await decoded(page.locator(".trip-film-brand img"));
  await page.getByRole("link", { name: "Explore the Globe", exact: true }).click();
  await page.locator("#observatory .observatory-heading").waitFor();
  await page.locator("#observatory canvas").first().waitFor({ timeout: 45000 });
  const reduced = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
  await media(reduced);
  // The decorative hero globe must work even when WebGL is unavailable.
  await reduced.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type, ...args) {
      if (/webgl/.test(type)) return null;
      return original.call(this, type, ...args);
    };
  });
  await reduced.goto("http://localhost:3008");
  await decoded(reduced.locator(".hero-globe-preview img"));
  assert.equal(await reduced.locator(".trip-film-hero canvas").count(), 0);
  assert.equal(await reduced.getByRole("link", { name: "Explore the Globe", exact: true }).getAttribute("href"), "/#observatory");
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
  await media(mobile);
  await mobile.goto("http://localhost:3008", { waitUntil: "networkidle" });
  await decoded(mobile.locator(".trip-film-brand img"));
  assert.equal(await mobile.locator(".trip-film-hero canvas").count(), 0);
  assert.ok(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await mobile.screenshot({ path: "work/qa-option1/mobile.png" });
  await mobile.goto("http://localhost:3008/photography");
  await decoded(mobile.locator(".public-header .atlas-logo-brand img"));
  assert.ok(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  assert.deepEqual(errors, []);
  console.log("PASS compact flat globe without hero WebGL, logo variants on desktop/mobile, gallery/back navigation, original main globe, reduced motion/WebGL unavailable, no overflow or browser exceptions. Video bytes used local fixtures.");
} finally {
  await browser.close();
}
