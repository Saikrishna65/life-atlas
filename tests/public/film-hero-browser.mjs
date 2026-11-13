import { createRequire } from "node:module";
import { readFile, mkdir } from "node:fs/promises";
import assert from "node:assert/strict";
const { chromium } = createRequire(import.meta.url)("playwright");
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
await mkdir("work/qa-film-hero", { recursive: true });
const errors = [];
try {
  const page = await browser.newPage({
    viewport: { width: 1920, height: 1080 },
  });
  page.on("pageerror", (e) => errors.push(e.message));
  // Controlled fixture verifies the player independently of the workspace's blocked stock CDN.
  const requested = [];
  await page.route("https://videos.pexels.com/**", async (route) => {
    requested.push(route.request().url());
    await route.fulfill({
      contentType: "video/mp4",
      body: await readFile("public/films/mountain-study.mp4"),
    });
  });
  await page.goto("http://localhost:3008", { waitUntil: "networkidle" });
  assert.equal(await page.locator(".trip-film-selectors button").count(), 3);
  assert.equal(await page.locator("[data-hero] canvas").count(), 0);
  assert.equal(
    await page
      .locator(".trip-film-main h1")
      .evaluate((el) => getComputedStyle(el).color),
    "rgb(255, 255, 255)",
  );
  assert.equal(
    await page.locator(".trip-film-stage video[data-showing=true]").count(),
    1,
  );
  await page.waitForFunction(
    () =>
      document.querySelector(".trip-film-stage video[data-showing=true]")
        ?.currentTime > 0.1,
  );
  assert.ok(
    await page
      .locator(".trip-film-stage video[data-showing=true]")
      .evaluate((v) => v.muted),
  );
  assert.ok(requested.length > 0);
  await page
    .getByRole("button", { name: "Pause trip films", exact: true })
    .click();
  const time = await page
    .locator(".trip-film-stage video[data-showing=true]")
    .evaluate((v) => v.currentTime);
  await page.waitForTimeout(500);
  assert.ok(
    await page
      .locator(".trip-film-stage video[data-showing=true]")
      .evaluate((v, t) => Math.abs(v.currentTime - t) < 0.1, time),
  );
  await page.screenshot({ path: "work/qa-film-hero/desktop.png" });
  const slides = page.locator(".trip-film-selectors button");
  const title = await page.locator(".trip-film-main h1").innerText();
  await slides.nth(1).click();
  await page.waitForFunction(
    () =>
      document
        .querySelectorAll(".trip-film-selectors button")[1]
        ?.getAttribute("aria-pressed") === "true",
  );
  assert.notEqual(await page.locator(".trip-film-main h1").innerText(), title);
  assert.equal(
    await page.locator(".trip-film-stage video[data-showing=true]").count(),
    1,
  );
  await page.getByRole("button", { name: "Open atlas menu" }).click();
  await page.getByRole("dialog").waitFor();
  assert.ok(
    await page
      .locator(".trip-film-stage video[data-showing=true]")
      .evaluate((v) => v.paused),
  );
  await page.keyboard.press("Escape");
  await slides.nth(2).focus();
  await page.keyboard.press("ArrowRight");
  await page.waitForFunction(
    () =>
      document
        .querySelectorAll(".trip-film-selectors button")[2]
        ?.getAttribute("aria-pressed") === "true",
  );
  await page.locator(".trip-film-cta").click();
  await page.waitForURL("**/trips/**");
  const mobile = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    reducedMotion: "reduce",
  });
  mobile.on("pageerror", (e) => errors.push(e.message));
  await mobile.route("https://videos.pexels.com/**", (route) => route.abort());
  await mobile.goto("http://localhost:3008", { waitUntil: "networkidle" });
  assert.ok(
    await mobile
      .locator(".trip-film-stage video[data-showing=true]")
      .evaluate((v) => v.paused),
  );
  await mobile.screenshot({ path: "work/qa-film-hero/mobile.png" });
  assert.ok(
    await mobile.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  assert.ok(
    await mobile
      .locator(".trip-film-selectors")
      .evaluate((el) => el.getBoundingClientRect().bottom < innerHeight),
  );
  await mobile
    .getByRole("button", { name: "Play trip films", exact: true })
    .click();
  await mobile.waitForFunction(
    () =>
      document.querySelector(".trip-film-stage video[data-showing=true]")
        ?.currentTime > 0.1,
  );
  assert.match(
    await mobile.locator(".trip-film-footer-note [role=status]").innerText(),
    /Local motion study/,
  );
  await mobile.getByRole("button", { name: "Open atlas menu" }).click();
  await mobile.getByRole("dialog").waitFor();
  await mobile.keyboard.press("Escape");
  assert.deepEqual(errors, []);
  console.log(
    "PASS: desktop reference composition, 3 trip selectors, single active video, muted playback, pause, manual selection, keyboard navigation, menu pause/dismissal, trip links, mobile layout, reduced motion and blocked-CDN fallback. No browser exceptions. Stock bytes were mocked for desktop playback testing.",
  );
} finally {
  await browser.close();
}
