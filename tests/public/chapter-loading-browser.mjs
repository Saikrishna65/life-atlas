/** A delayed neighbouring chapter must never hide/reinitialize the active globe. */
import { createRequire } from "node:module";
import { readdir, readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const { chromium } = createRequire(import.meta.url)("playwright");
// Resolve the hashed production asset through the neighbouring chapter's public copy.
const chunks = await readdir(".next/static/chunks");
let chapterChunk;
for (const file of chunks.filter(file => file.endsWith(".js"))) {
  const source = await readFile(`.next/static/chunks/${file}`, "utf8");
  if (source.includes("Leave the familiar.") && source.includes("passage-scene")) {
    chapterChunk = file;
    break;
  }
}
assert.ok(chapterChunk, "Production build must contain the adjacent chapter");
const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox", "--enable-unsafe-swiftshader"] });
let release;
const held = new Promise(resolve => { release = resolve; });
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on("pageerror", error => errors.push(error.message));
  await page.route(`**/${chapterChunk}`, async route => { await held; await route.continue(); });
  await page.route("https://videos.pexels.com/**", async route => route.fulfill({ contentType: "video/mp4", body: await readFile("public/films/hero/highlands.mp4") }));
  await page.goto("http://localhost:3008", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !!window.__lenis);
  const requested = page.waitForRequest(request => request.url().endsWith(chapterChunk), { timeout: 15000 });
  await page.getByRole("link", { name: "Explore the Globe", exact: true }).click();
  await requested;
  await page.waitForFunction(() => window.__globeReady === true, null, { timeout: 45000 });
  await page.waitForFunction(() => Math.abs(document.querySelector("#observatory").getBoundingClientRect().top) < 12);
  await page.locator("#observatory canvas").evaluate(canvas => { canvas.dataset.retainedRenderer = "yes"; });
  assert.ok(await page.locator("#observatory").evaluate(el => el.getBoundingClientRect().height > 500));
  assert.ok(await page.locator("#on-the-road.world-loading").count());
  assert.ok(await page.evaluate(() => document.documentElement.scrollHeight > innerHeight * 2));
  release();
  await page.locator("#on-the-road:not(.world-loading)").waitFor({ state: "attached" });
  await page.waitForTimeout(600);
  assert.equal(await page.locator('#observatory canvas[data-retained-renderer="yes"]').count(), 1);
  assert.ok(await page.locator("#observatory").evaluate(el => Math.abs(el.getBoundingClientRect().top) < 12));
  assert.deepEqual(errors, []);
  console.log("PASS delayed adjacent chapter retains its placeholder, active globe DOM/renderer and scroll alignment throughout lazy loading, with no browser exceptions. Video uses local fixtures.");
} finally { release(); await browser.close(); }
