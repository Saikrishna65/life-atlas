/** Run against a fresh production server: node tests/public/cinema-browser.mjs */
import { createRequire } from "node:module";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const { chromium } = createRequire(import.meta.url)("playwright");
const origin = process.env.ATLAS_QA_URL ?? "http://localhost:3008";
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
});
const errors = [],
  results = [];
await mkdir("work/qa-cinema", { recursive: true });
const observe = (page) => page.on("pageerror", (e) => errors.push(e.message));
async function check(name, run) {
  try {
    await run();
    results.push({ name, passed: true });
    console.log("PASS", name);
  } catch (e) {
    results.push({ name, passed: false, error: e.message });
    console.log("FAIL", name, e.message);
  }
}
async function chapter(page, id) {
  await page.evaluate(
    (id) =>
      window.dispatchEvent(
        new CustomEvent("world-chapter-request", { detail: id }),
      ),
    id,
  );
  await page.locator(`#${id}:not(.world-loading)`).waitFor();
  for (let attempt = 0; attempt < 4; attempt++) {
    await page.locator(`#${id}`).scrollIntoViewIfNeeded();
    await page.waitForTimeout(700);
    await page.locator(`#${id}`).evaluate((el) => {
      window.__lenis.start();
      window.__lenis.resize();
      window.__lenis.scrollTo(el.getBoundingClientRect().top + scrollY - 90, {
        immediate: true,
        force: true,
      });
    });
    await page.waitForTimeout(1300);
    if (
      await page
        .locator(`#${id}`)
        .evaluate((el) => Math.abs(el.getBoundingClientRect().top - 90) < 10)
    )
      return;
  }
  assert.ok(
    await page
      .locator(`#${id}`)
      .evaluate((el) => Math.abs(el.getBoundingClientRect().top - 90) < 10),
    `Chapter ${id} must settle in the viewport`,
  );
}
async function home(page) {
  await page.goto(origin, { waitUntil: "networkidle" });
  await page.locator(".trip-film-main h1").waitFor();
}
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  observe(page);
  await home(page);
  await page.screenshot({ path: "work/qa-cinema/hero.png" });
  await check(
    "globe surround matches the white-on-charcoal hero; globe remains interactive",
    async () => {
      await chapter(page, "observatory");
      assert.equal(
        await page
          .locator(".world-observatory")
          .evaluate((el) => getComputedStyle(el).backgroundColor),
        "rgb(22, 33, 29)",
      );
      await page.waitForFunction(() => window.__globeReady);
      assert.ok((await page.locator("#observatory canvas").count()) > 0);
      await page.screenshot({ path: "work/qa-cinema/globe.png" });
    },
  );
  await check(
    "scroll cycle changes chapters and buttons navigate back",
    async () => {
      await chapter(page, "on-the-road");
      await page.waitForFunction(
        () => document.querySelector("#on-the-road")?.dataset.motion === "true",
      );
      for (let attempt = 0; attempt < 2; attempt++) {
        await page
          .locator("#on-the-road")
          .evaluate((el) =>
            window.__lenis.scrollTo(
              el.getBoundingClientRect().top +
                scrollY +
                (el.offsetHeight - innerHeight) * 0.85,
              { immediate: true, force: true },
            ),
          );
        await page.waitForTimeout(1800);
      }
      assert.equal(
        await page.locator(".passage-scene").nth(2).getAttribute("data-active"),
        "true",
      );
      assert.equal(
        await page.locator(".passage-scene").nth(0).getAttribute("aria-hidden"),
        "true",
      );
      await page.locator(".passage-chapters button").first().click();
      await page.waitForTimeout(1800);
      assert.equal(
        await page
          .locator(".passage-scene")
          .first()
          .getAttribute("data-active"),
        "true",
      );
      await page.screenshot({ path: "work/qa-cinema/passage.png" });
    },
  );
  await check(
    "fullscreen menu, image-only archive and visitor-initiated film playback",
    async () => {
      await page
        .getByRole("button", { name: "The atlas", exact: true })
        .click();
      await page.getByRole("dialog").waitFor();
      await page.waitForTimeout(600);
      assert.equal(
        await page
          .getByRole("dialog")
          .evaluate((el) => Math.round(el.getBoundingClientRect().width)),
        1440,
      );
      await page
        .locator(".world-chapter-menu button")
        .filter({ hasText: "Memory Archive" })
        .click();
      await page.waitForTimeout(2200);
      assert.ok(
        await page
          .locator("#memories")
          .evaluate((el) => Math.abs(el.getBoundingClientRect().top - 74) < 12),
      );
      await chapter(page, "memories");
      assert.equal(await page.locator(".memory-print-caption").count(), 0);
      assert.equal(await page.locator("dialog video").count(), 0);
      await page
        .getByRole("button", {
          name: "Watch mountain motion study",
          exact: true,
        })
        .click();
      const video = page.locator("dialog video");
      await video.evaluate(
        (el) =>
          new Promise((resolve, reject) => {
            if (el.readyState >= 1) return resolve();
            el.addEventListener("loadedmetadata", resolve, { once: true });
            el.addEventListener("error", reject, { once: true });
          }),
      );
      await page
        .getByRole("button", { name: "Close dialog", exact: true })
        .focus();
      await page.keyboard.press("Tab");
      assert.ok(await video.evaluate((v) => document.activeElement === v));
      assert.equal(await video.getAttribute("autoplay"), null);
      assert.equal(await video.evaluate((v) => v.paused), true);
      assert.ok(await video.evaluate((v) => Math.abs(v.duration - 6) < 0.2));
      await video.evaluate((v) => v.play());
      await page.waitForTimeout(400);
      assert.ok(await video.evaluate((v) => v.currentTime > 0));
      await page.screenshot({ path: "work/qa-cinema/film.png" });
      await page.keyboard.press("Escape");
      assert.equal(await page.locator("dialog video").count(), 0);
      await page.screenshot({ path: "work/qa-cinema/archive.png" });
    },
  );
  await check(
    "trip photos and films filter separately; film viewer does not autoplay",
    async () => {
      await page.goto(origin + "/trips/himalayan-journey", {
        waitUntil: "networkidle",
      });
      await page.getByRole("button", { name: "Films", exact: true }).click();
      assert.equal(await page.locator(".trip-photo-wall > button").count(), 1);
      assert.equal(await page.locator("dialog video").count(), 0);
      await page.locator(".trip-photo-wall > button").click();
      assert.equal(
        await page.locator("dialog video").getAttribute("autoplay"),
        null,
      );
      assert.match(
        await page.locator(".photo-open-details").innerText(),
        /not recorded trip footage/,
      );
      await page.keyboard.press("Escape");
      await page.getByRole("button", { name: "Photos", exact: true }).click();
      assert.equal(
        (await page.locator(".trip-photo-wall").innerText()).trim(),
        "",
      );
      await page.screenshot({ path: "work/qa-cinema/trip.png" });
    },
  );
  await check(
    "public catalog puts approved films in their exact trip and sends no credentials",
    async () => {
      const source = "https://media.example.com/atlas/catalog/current.json";
      const catalogItem = (id, collection) => ({
        id,
        collection,
        category: "expedition",
        key: `galleries/${id}.mp4`,
        url: `https://media.example.com/galleries/${id}.mp4`,
        mimeType: "video/mp4",
        size: 1000,
        title: id,
        description: "Published film",
        tags: ["place:Chopta"],
        publishedAt: "2026-01-01T00:00:00Z",
        metadataPolicy: "removed",
      });
      let reads = 0;
      await page.route("https://media.example.com/**", async (route) => {
        assert.equal(route.request().headers().authorization, undefined);
        assert.equal(route.request().headers().cookie, undefined);
        if (route.request().url() === source) {
          reads++;
          await route.fulfill({
            contentType: "application/json",
            body: JSON.stringify({
              format: "life-atlas-public-media",
              version: 1,
              revision: "qa",
              updatedAt: "2026-01-01T00:00:00Z",
              items: [
                catalogItem("approved-film", "himalayan-journey"),
                catalogItem("unrelated-film", "other-trip"),
              ],
            }),
          });
        } else
          await route.fulfill({
            contentType: "video/mp4",
            body: await readFile("public/films/mountain-study.mp4"),
          });
      });
      await page.goto(
        origin +
          "/trips/himalayan-journey?atlasCatalog=" +
          encodeURIComponent(source),
        { waitUntil: "networkidle" },
      );
      await page.getByRole("button", { name: "Films", exact: true }).click();
      await page
        .getByRole("button", { name: "View approved-film", exact: true })
        .waitFor();
      assert.equal(
        await page
          .getByRole("button", { name: "View unrelated-film", exact: true })
          .count(),
        0,
      );
      await page
        .getByRole("button", { name: "View approved-film", exact: true })
        .click();
      assert.equal(
        await page.locator("dialog video").getAttribute("src"),
        "https://media.example.com/galleries/approved-film.mp4",
      );
      assert.ok(reads > 0);
      await page.keyboard.press("Escape");
      await page.evaluate(() =>
        localStorage.removeItem("atlas-public-catalog-source-v1"),
      );
    },
  );
  const mobile = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  observe(mobile);
  await check(
    "mobile storytelling is a readable touch-friendly sequence without scroll trapping",
    async () => {
      await home(mobile);
      await chapter(mobile, "on-the-road");
      assert.equal(
        await mobile.locator("#on-the-road").getAttribute("data-motion"),
        null,
      );
      assert.equal(await mobile.locator(".passage-scene[inert]").count(), 0);
      assert.ok(
        await mobile.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      );
      await mobile.screenshot({ path: "work/qa-cinema/mobile-passage.png" });
      await chapter(mobile, "memories");
      assert.ok(
        await mobile
          .getByRole("button", {
            name: "Watch mountain motion study",
            exact: true,
          })
          .isVisible(),
      );
      assert.ok(
        await mobile.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      );
      await mobile.screenshot({ path: "work/qa-cinema/mobile-archive.png" });
    },
  );
  const reduced = await browser.newPage({
    viewport: { width: 1280, height: 900 },
    reducedMotion: "reduce",
  });
  observe(reduced);
  await check(
    "reduced motion keeps every chapter visible and readable",
    async () => {
      await home(reduced);
      await chapter(reduced, "on-the-road");
      assert.equal(
        await reduced.locator("#on-the-road").getAttribute("data-motion"),
        null,
      );
      assert.equal(
        await reduced.locator(".passage-scene[aria-hidden=true]").count(),
        0,
      );
      assert.equal(await reduced.locator(".passage-scene[inert]").count(), 0);
    },
  );
  await check("no uncaught browser exceptions", async () =>
    assert.deepEqual(errors, []),
  );
} finally {
  await writeFile(
    "work/qa-cinema/results.json",
    JSON.stringify({ results, errors }, null, 2),
  );
  await browser.close();
}
if (results.some((r) => !r.passed)) process.exitCode = 1;
