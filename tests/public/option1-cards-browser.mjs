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
  const stack = page.locator(".trip-film-photo-stack");
  await decoded(stack.locator("img").first());
  await decoded(stack.locator("img").last());
  const tripIds = await stack.locator("img").evaluateAll(images => images.map(image => image.dataset.tripId));
  assert.equal(tripIds.length, 2);
  assert.equal(new Set(tripIds).size, 2);
  assert.equal(await page.locator(".hero-gallery-landscape").count(), 0);
  await decoded(page.locator(".trip-film-brand img"));
  assert.ok((await page.locator(".trip-film-brand img").getAttribute("src")).includes("life-atlas-white"));
  assert.equal(await page.locator(".trip-film-brand img").evaluate(image => getComputedStyle(image).filter), 'url("#atlas-white-ink")');
  assert.equal(await page.locator(".trip-film-hero canvas").count(), 0);
  assert.ok(await page.locator(".trip-film-globe-tile > svg").isVisible());
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
  // The illustrated hero globe must work even when WebGL is unavailable.
  await reduced.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type, ...args) {
      if (/webgl/.test(type)) return null;
      return original.call(this, type, ...args);
    };
  });
  await reduced.goto("http://localhost:3008");
  await reduced.locator(".trip-film-globe-tile > svg").filter({ visible: true }).waitFor();
  assert.equal(await reduced.locator(".trip-film-hero canvas").count(), 0);
  assert.equal(await reduced.getByRole("link", { name: "Explore the Globe", exact: true }).getAttribute("href"), "/#observatory");
  // Exercise the actual public catalog reader with photos from two distinct trips.
  const published = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
  await media(published);
  const source = "https://media.example.com/atlas/catalog/current.json";
  const item = (id, collection, mimeType = "image/jpeg") => ({
    id, collection, mimeType, key: `travel/expeditions/${id}.jpg`,
    url: `https://media.example.com/travel/expeditions/${id}.jpg`,
    thumbnailUrl: `https://media.example.com/galleries/previews/${id}.jpg`,
    title: "Trip photograph", description: "", tags: [], category: "expedition",
    size: 100, publishedAt: "2026-11-13T10:00:00Z", metadataPolicy: "removed",
  });
  await published.route("https://media.example.com/**", async route => {
    if (route.request().url() === source) return route.fulfill({ json: {
      format: "life-atlas-public-media", version: 1, revision: "browser-fixture",
      updatedAt: "2026-11-13T10:00:00Z", items: [
        item("a", "himalayan-journey"), item("b", "The Himalayan Journey"),
        item("c", "river-ritual-repeat"), item("d", "river-ritual-repeat", "video/mp4"),
      ],
    }});
    return route.fulfill({ contentType: "image/webp", body: await readFile("public/images/world/ridge-small.webp") });
  });
  await published.goto(`http://localhost:3008/?atlasCatalog=${encodeURIComponent(source)}`);
  await published.waitForFunction(() => document.querySelectorAll('.trip-film-photo-stack img[data-sample="false"]').length === 2);
  const publishedPhotos = published.locator(".trip-film-photo-stack img");
  await decoded(publishedPhotos.first());
  await decoded(publishedPhotos.last());
  assert.deepEqual(await publishedPhotos.evaluateAll(images => images.map(image => image.getAttribute("src"))), [
    "https://media.example.com/galleries/previews/a.jpg", "https://media.example.com/galleries/previews/c.jpg",
  ]);
  assert.equal(await published.locator(".hero-gallery-caption small").count(), 0);
  await published.locator(".trip-film-discover").screenshot({ path: "work/qa-option1/published-cards.png" });
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
  console.log("PASS restored photo-print and illustrated globe cards, distinct trip photos from the public catalog, thumbnail use and video exclusion, white-ink logo, gallery/back navigation, original main globe, reduced motion/WebGL unavailable and mobile without browser exceptions. Public media and video bytes used local fixtures.");
} finally {
  await browser.close();
}
