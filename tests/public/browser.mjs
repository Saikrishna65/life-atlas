/** Public travel regression suite. Run against a fresh production server. */
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
const resolve = createRequire(import.meta.url).resolve;
const imported = await import(pathToFileURL(resolve("playwright")).href);
const { chromium } = imported.default ?? imported;
const origin = process.env.ATLAS_QA_URL ?? "http://localhost:3008";
await mkdir("work/qa-travel", { recursive: true });
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
});
const errors = [],
  results = [];
function attach(page) {
  page.on("pageerror", (error) => errors.push(error.message));
}
async function check(name, fn) {
  try {
    await fn();
    results.push({ name, passed: true });
    console.log("PASS", name);
  } catch (error) {
    results.push({ name, passed: false, error: error.message });
    console.log("FAIL", name, error.message);
  }
}
async function scroll(page, y) {
  await page.evaluate(
    (y) =>
      window.__lenis?.scrollTo(y, { immediate: true, force: true }) ??
      window.scrollTo(0, y),
    y,
  );
  await page.waitForTimeout(1600);
}
async function scene(page, id) {
  await page.evaluate(
    (id) =>
      window.dispatchEvent(
        new CustomEvent("world-chapter-request", { detail: id }),
      ),
    id,
  );
  await page.waitForTimeout(500);
  await page.locator("#" + id).scrollIntoViewIfNeeded();
  await page.waitForTimeout(1000);
  await page.locator("#" + id).evaluate((el) =>
    window.__lenis.scrollTo(el, {
      immediate: true,
      force: true,
      offset: -80,
    }),
  );
  await page.waitForTimeout(1700);
}
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  attach(page);
  await page.goto(origin, { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.__heroReady);
  await page
    .getByRole("status", { name: "Loading", exact: true })
    .waitFor({ state: "detached" });
  await check("door image sequence remains scroll driven", async () => {
    const canvas = page.locator("[data-hero] canvas").first();
    const first = await canvas.evaluate((el) => el.toDataURL());
    await page.screenshot({ path: "work/qa-travel/hero.png" });
    await scroll(page, 1200);
    const middle = await canvas.evaluate((el) => el.toDataURL());
    assert.notEqual(first, middle);
    await scroll(page, 2400);
    assert.notEqual(middle, await canvas.evaluate((el) => el.toDataURL()));
  });
  await check(
    "Arrival and private app demos removed from public homepage",
    async () => {
      assert.equal(
        await page.locator("#arrival,#intelligence,#system").count(),
        0,
      );
      assert.equal(
        await page.getByRole("heading", { name: /Every life is/ }).count(),
        1,
      );
    },
  );
  await scene(page, "observatory");
  await check(
    "existing globe and destination selection remain usable",
    async () => {
      await page.waitForFunction(() => window.__globeReady);
      await page.locator("#observatory").getByRole("searchbox").fill("Kyoto");
      await page.getByRole("button", { name: /Kyoto Japan/ }).click();
      assert.ok(
        await page
          .locator("#observatory")
          .getByRole("heading", { name: "Kyoto", exact: true })
          .isVisible(),
      );
      assert.match(
        await page
          .locator("#observatory")
          .getByRole("link", { name: /Open the journey/ })
          .getAttribute("href"),
        /^\/trips\//,
      );
    },
  );
  await scene(page, "expeditions");
  await check("journey search and vertical editorial layout", async () => {
    await page.locator("#expeditions input[type=search]").fill("Himalayan");
    assert.equal(await page.locator(".expedition-panel").count(), 1);
    await page.locator("#expeditions input[type=search]").fill("");
    await page.waitForFunction(
      () => document.querySelectorAll(".expedition-panel").length === 3,
    );
    const boxes = await page
      .locator(".expedition-panel")
      .evaluateAll((items) =>
        items.map((el) => el.getBoundingClientRect().top),
      );
    assert.ok(boxes[1] > boxes[0] + 300);
    await page.screenshot({ path: "work/qa-travel/expeditions.png" });
  });
  await check(
    "trip opens a dedicated page with interactive route and field notes",
    async () => {
      await page.locator(".expedition-panel").first().click();
      await page.waitForURL("**/trips/**");
      await page.locator(".journey-cover h1").waitFor();
      assert.equal(await page.getByRole("dialog").count(), 0);
      const buttons = page.locator(".journey-stops button");
      assert.ok((await buttons.count()) > 0);
      await buttons.last().click();
      assert.equal(await buttons.last().getAttribute("aria-pressed"), "true");
      await page.getByRole("button", { name: "Zoom in", exact: true }).click();
      assert.ok(await page.locator(".leaflet-container").isVisible());
      await page.getByRole("button", { name: "Terrain", exact: true }).click();
      assert.equal(
        await page
          .getByRole("button", { name: "Terrain", exact: true })
          .getAttribute("aria-pressed"),
        "true",
      );
      await page.locator(".journey-route-section").scrollIntoViewIfNeeded();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: "work/qa-travel/trip-route.png" });
      assert.equal((await page.locator(".trip-photo-wall").innerText()).trim(), "");
      const filter=page.locator(".photo-place-filters button");
      await filter.nth(1).click();
      assert.equal(await filter.nth(1).getAttribute("aria-pressed"),"true");
      const photos = page.locator(".trip-photo-wall>button");
      assert.ok((await photos.count()) > 0);
      await photos.first().click();
      await page.getByRole("dialog").waitFor();
      await page.keyboard.press("Escape");
      await page.getByRole("tab", { name: /Packing/ }).click();
      await page.getByRole("checkbox").first().check();
      assert.ok(await page.getByRole("checkbox").first().isChecked());
    },
  );
  await page.goto(origin + "/#beyond", { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.__heroReady);
  await page
    .getByRole("status", { name: "Loading", exact: true })
    .waitFor({ state: "detached" });
  await scene(page, "beyond");
  await check("return-home door closes as the journey finishes", async () => {
    let before = 0;
    // Deep-link navigation and deferred chapters may still be settling above us.
    for (let attempt = 0; attempt < 3; attempt++) {
      const top = await page
        .locator("#beyond")
        .evaluate((el) => el.getBoundingClientRect().top + scrollY);
      await scroll(page, top - 700);
      before = await page
        .locator(".door-leaf")
        .evaluate((el) =>
          Math.abs(new DOMMatrix(getComputedStyle(el).transform).m13),
        );
      if (before > 0.3) break;
    }
    assert.ok(before > 0.3, "The ending must start with an open door");
    const finish = await page
      .locator("#beyond")
      .evaluate(
        (el) => el.getBoundingClientRect().bottom + scrollY - innerHeight,
      );
    await scroll(page, finish + 5);
    const after = await page
      .locator(".door-leaf")
      .evaluate((el) =>
        Math.abs(new DOMMatrix(getComputedStyle(el).transform).m13),
      );
    console.log("closing angles", before, after);
    assert.ok(after < before && after < 0.05);
    await page.screenshot({ path: "work/qa-travel/home-again.png" });
  });
  const mobile = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  attach(mobile);
  await mobile.goto(origin + "/trips/himalayan-journey", {
    waitUntil: "networkidle",
  });
  await check(
    "mobile route page and reduced motion remain readable",
    async () => {
      assert.ok(
        await mobile.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      );
      await mobile.locator(".journey-route-section").scrollIntoViewIfNeeded();
      await mobile.screenshot({ path: "work/qa-travel/mobile-route.png" });
      await mobile.emulateMedia({ reducedMotion: "reduce" });
      await mobile.reload();
      assert.ok(await mobile.locator("h1").isVisible());
    },
  );
  await check("no browser exceptions", async () =>
    assert.deepEqual(errors, []),
  );
} finally {
  await browser.close();
  await writeFile(
    "work/qa-travel/results.json",
    JSON.stringify({ results, errors }, null, 2),
  );
}
if (results.some((result) => !result.passed)) process.exitCode = 1;
