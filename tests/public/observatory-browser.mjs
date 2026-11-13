import { createRequire } from "node:module";
import { mkdir, readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const { chromium } = createRequire(import.meta.url)("playwright");
const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox", "--enable-unsafe-swiftshader"] });
const errors = [];
let desktop;
await mkdir("work/qa-observatory", { recursive: true });
async function setup(page) {
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(() => {
    window.__atlasWebGLRequests = 0;
    const context = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type, ...args) {
      if (/webgl/.test(type)) window.__atlasWebGLRequests++;
      return context.call(this, type, ...args);
    };
  });
  await page.route("https://videos.pexels.com/**", async route => route.fulfill({ contentType: "video/mp4", body: await readFile("public/films/hero/highlands.mp4") }));
}
async function open(page) {
  await page.goto("http://localhost:3008", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !!window.__lenis);
  await page.locator("#observatory.observatory-v2").waitFor({ state: "attached" });
  await page.waitForTimeout(300);
  assert.equal(await page.evaluate(() => window.__atlasWebGLRequests), 0, "The hero must not initialize WebGL");
  await page.getByRole("link", { name: "Explore the Globe", exact: true }).click();
  await page.locator("#observatory.observatory-v2").waitFor();
}
async function globe(page) {
  await page.waitForFunction(() => window.__globeReady === true, null, { timeout: 45000 });
  await page.locator("#observatory canvas").waitFor();
  await page.waitForTimeout(3700);
}
try {
  const page = desktop = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await setup(page); await open(page); await globe(page);
  const section = page.locator("#observatory");
  assert.equal(await section.evaluate(el => getComputedStyle(el).backgroundColor), "rgb(22, 33, 29)");
  assert.ok(await section.locator(".observatory-heading h2").evaluate(el => getComputedStyle(el).fontFamily.toLowerCase().includes("jakarta")));
  assert.equal(await page.locator("#observatory canvas").count(), 1);
  assert.equal(await page.locator('.world-nav[data-scene="observatory"]').count(), 1);
  await page.waitForFunction(() => Math.abs(document.querySelector("#observatory").getBoundingClientRect().top) < 12, null, { timeout: 15000 });
  assert.ok(await page.locator('.world-nav[data-scene="observatory"]').isVisible());
  await page.screenshot({ path: "work/qa-observatory/desktop.png" });
  await section.screenshot({ path: "work/qa-observatory/section.png" });
  const search = section.getByRole("searchbox", { name: "Search destinations" });
  await search.fill("Kyoto");
  await section.getByRole("button", { name: "Kyoto Japan", exact: true }).click();
  assert.equal(await section.locator(".observatory-focus h3").innerText(), "Kyoto");
  assert.match(await section.getByRole("link", { name: "Open the journey" }).getAttribute("href"), /^\/trips\//);
  assert.ok(await section.getByRole("button", { name: "Next place", exact: true }).isDisabled());
  await search.fill("");
  await section.getByRole("button", { name: "Coast", exact: true }).click();
  assert.ok((await section.locator(".observatory-destination-list small").allTextContents()).every(value => value.endsWith("Coast")));
  await section.getByRole("button", { name: "Next place", exact: true }).click();
  assert.equal(await section.locator(".observatory-focus-meta span").last().innerText(), "Coast");
  await search.fill("no-such-place-zz");
  assert.ok(await section.getByText("No places found. Try a different direction.").isVisible());
  await section.getByRole("button", { name: "Show all places" }).click();
  assert.equal(await search.inputValue(), "");
  const initial = await section.locator(".observatory-destination-list").innerText();
  await section.getByRole("button", { name: "Next destinations", exact: true }).click();
  assert.notEqual(await section.locator(".observatory-destination-list").innerText(), initial);
  await section.getByRole("button", { name: "Previous destinations", exact: true }).click();
  const first = section.locator(".observatory-destination-list > button").first();
  await first.focus(); await page.keyboard.press("Enter");
  assert.equal(await first.getAttribute("aria-pressed"), "true");
  assert.notEqual(await first.evaluate(el => getComputedStyle(el).outlineStyle), "none");
  for (let i = 0; i < 10; i++) await section.getByRole("button", { name: "Next place", exact: true }).click();
  assert.equal(await section.locator("canvas").count(), 1);
  await section.getByRole("link", { name: "Find your somewhere" }).click();
  await page.waitForTimeout(1600);
  const position = await section.locator(".observatory-browser").boundingBox();
  assert.ok(position.y > 0 && position.y < 150, `Browser navigation position: ${position.y}`);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => {
    const browser = document.getElementById("place-browser");
    return browser && Math.abs(browser.getBoundingClientRect().top - 74) < 12;
  });
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
  await setup(mobile);
  // The hero's discovery rail is intentionally hidden on mobile; deep links still work.
  await mobile.goto("http://localhost:3008/#observatory");
  await mobile.locator("#observatory.observatory-v2").waitFor();
  await mobile.waitForFunction(() => Math.abs(document.querySelector("#observatory").getBoundingClientRect().top) < 12);
  await globe(mobile);
  assert.ok(await mobile.locator(".observatory-touch-hint").isVisible());
  assert.ok(await mobile.locator(".observatory-desktop-hint").isHidden());
  const touchTarget = await mobile.getByRole("button", { name: "Next place", exact: true }).boundingBox();
  assert.ok(touchTarget.width >= 44 && touchTarget.height >= 44);
  assert.ok(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  assert.equal(await mobile.locator("#observatory canvas").evaluate(el => getComputedStyle(el).touchAction), "pan-y");
  await mobile.screenshot({ path: "work/qa-observatory/mobile.png" });
  await mobile.locator("#observatory").screenshot({ path: "work/qa-observatory/mobile-section.png" });
  await mobile.getByRole("combobox", { name: "Destination category" }).selectOption("City");
  assert.ok((await mobile.locator(".observatory-destination-list small").allTextContents()).every(value => value.endsWith("City")));
  await mobile.locator(".observatory-destination-list > button").first().tap();
  assert.equal(await mobile.locator(".observatory-focus-meta span").last().innerText(), "City");
  assert.equal(await mobile.locator(".observatory-focus-copy").evaluate(el => getComputedStyle(el).animationName), "none");
  const fallback = await browser.newPage({ viewport: { width: 1366, height: 900 }, reducedMotion: "reduce" });
  await setup(fallback);
  await fallback.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type, ...args) {
      return /webgl/.test(type) ? null : getContext.call(this, type, ...args);
    };
  });
  await fallback.goto("http://localhost:3008/#observatory");
  await fallback.getByText("The map is taking a rest. Explore the destinations beside it.").waitFor();
  await fallback.getByRole("searchbox", { name: "Search destinations" }).fill("Kyoto");
  await fallback.getByRole("button", { name: "Kyoto Japan", exact: true }).click();
  assert.equal(await fallback.locator(".observatory-focus h3").innerText(), "Kyoto");
  await fallback.screenshot({ path: "work/qa-observatory/fallback.png" });
  assert.deepEqual(errors, []);
  console.log("PASS cinematic globe layout, original WebGL renderer, search, category filters, place stepping, pagination, keyboard selection, working journey links, section navigation, repeated selections without renderer duplication, mobile touch/reduced motion, WebGL-unavailable directory and no browser exceptions. Hero video uses local fixtures.");
} catch (error) {
  if (desktop) {
    console.log(await desktop.evaluate(() => ({ scrollY, hash: location.hash, ready: window.__globeReady, text: document.querySelector("#observatory")?.innerText.slice(0, 800) })));
    await desktop.screenshot({ path: "work/qa-observatory/failure.png" }).catch(() => {});
  }
  throw error;
} finally { await browser.close(); }
