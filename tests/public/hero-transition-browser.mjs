import { createRequire } from "node:module";
import { readFile, mkdir } from "node:fs/promises";
import assert from "node:assert/strict";
const { chromium } = createRequire(import.meta.url)("playwright");
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
await mkdir("work/qa-hero-white", { recursive: true });
const errors = [];
try {
  const page = await browser.newPage({
    viewport: { width: 1920, height: 1080 },
  });
  page.on("pageerror", (e) => errors.push(e.message));
  let release;
  const delayed = new Promise((resolve) => {
    release = resolve;
  });
  await page.route("https://videos.pexels.com/**", async (route) => {
    const next = route.request().url().includes("40202545");
    if (next) await delayed;
    await route.fulfill({
      contentType: "video/mp4",
      body: await readFile(
        `public/films/hero/${next ? "coast" : "highlands"}.mp4`,
      ),
    });
  });
  await page.goto("http://localhost:3008", { waitUntil: "domcontentloaded" });
  const first = page.locator('video[data-film-index="0"]');
  await page.waitForFunction(
    () =>
      document.querySelector('video[data-showing="true"]')?.currentTime > 0.1,
  );
  assert.equal(
    await page
      .locator(".trip-film-main h1")
      .evaluate((e) => getComputedStyle(e).color),
    "rgb(255, 255, 255)",
  );
  assert.equal(await page.locator(".trip-film-main h1 br").count(), 1);
  await page.screenshot({ path: "work/qa-hero-white/first-trip.png" });
  assert.equal(await page.locator(".trip-film-shade").count(), 0);
  const panels = await page.locator(".trip-film-discover").evaluate(el => {
    const box = selector => { const r = el.querySelector(selector).getBoundingClientRect(); return { x:r.x, y:r.y, bottom:r.bottom, height:r.height }; };
    return { label:box(".trip-film-aside-label"), journal:box(".trip-film-journal-tile"), photo:box(".trip-film-photo-tile"), story:box(".trip-film-world-link") };
  });
  assert.ok(Math.abs(panels.label.x-panels.journal.x)<1);
  assert.ok(Math.abs(panels.label.y-panels.photo.y)<1);
  assert.ok(Math.abs(panels.journal.bottom-panels.photo.bottom)<1);
  assert.ok(panels.photo.height > panels.journal.height);
  assert.ok(panels.story.y >= panels.photo.bottom + 7);
  assert.equal(await page.locator(".trip-film-orbit").count(), 0);
  await page.locator(".trip-film-discover").screenshot({path:"work/qa-hero-white/discovery.png"});
  const time = await first.evaluate((v) => v.currentTime);
  await page.locator(".trip-film-selectors button").nth(1).click();
  await page.waitForTimeout(350);
  assert.equal(await first.getAttribute("data-showing"), "true");
  assert.ok(
    await first.evaluate((v, t) => v.currentTime > t && !v.paused, time),
  );
  assert.equal(
    await page
      .locator(".trip-film-selectors button")
      .nth(1)
      .getAttribute("aria-busy"),
    "true",
  );
  assert.equal(
    await page
      .locator('.trip-film-stage video[data-film-index="1"]')
      .evaluate((v) => getComputedStyle(v).opacity),
    "0",
  );
  release();
  await page.waitForFunction(
    () =>
      document.querySelector('video[data-film-index="1"]')?.dataset.showing ===
      "true",
  );
  await page.waitForTimeout(450);
  const opacity = await page
    .locator('video[data-film-index="1"]')
    .evaluate((v) => Number(getComputedStyle(v).opacity));
  assert.ok(opacity > 0.01 && opacity < 0.99, `blend opacity ${opacity}`);
  assert.equal(await first.getAttribute("data-outgoing"), "true");
  assert.ok(await first.evaluate((v) => !v.paused));
  await page.screenshot({ path: "work/qa-hero-white/blend.png" });
  await page.waitForTimeout(1600);
  assert.equal(await first.getAttribute("src"), null);
  await page
    .getByRole("button", { name: "Pause trip films", exact: true })
    .click();
  assert.ok(
    await page.locator('video[data-showing="true"]').evaluate((v) => v.paused),
  );
  await page.screenshot({ path: "work/qa-hero-white/desktop.png" });
  await page.getByRole("button", { name: "The atlas", exact: true }).click();
  await page.getByRole("dialog").waitFor();
  await page.keyboard.press("Escape");
  await page.locator(".trip-film-selectors button").first().click();
  await page.waitForFunction(
    () =>
      document.querySelector('video[data-film-index="0"]')?.dataset.showing ===
      "true",
  );
  await page.locator(".trip-film-selectors button").nth(2).click();
  assert.equal(
    await page
      .locator('video[data-film-index="0"]')
      .getAttribute("data-showing"),
    "true",
  );
  await page.waitForFunction(
    () =>
      document.querySelector('video[data-film-index="2"]')?.dataset.showing ===
      "true",
  );
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
      .locator('video[data-showing="true"]')
      .evaluate((v) => v.paused),
  );
  assert.ok(
    await mobile.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await mobile.screenshot({ path: "work/qa-hero-white/mobile.png" });
  await mobile
    .getByRole("button", { name: "Play trip films", exact: true })
    .click();
  await mobile.waitForFunction(
    () =>
      document.querySelector('video[data-showing="true"]')?.currentTime > 0.1,
  );
  await mobile.locator(".trip-film-selectors button").nth(2).click();
  await mobile.waitForFunction(
    () =>
      document.querySelector('video[data-film-index="2"]')?.dataset.showing ===
      "true",
  );
  assert.equal(
    await mobile
      .locator('video[data-showing="true"]')
      .evaluate((v) => getComputedStyle(v).transitionDuration),
    "0s",
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS delayed incoming media retains a live outgoing video; decoded-frame reveal, measured two-video crossfade, outgoing release, queued rapid selections, white text, unshaded video, staggered discovery panels, two-line heading, pause/menu controls, colour fallback, mobile overflow and reduced-motion switching. No browser exceptions. Primary CDN responses used local colour-video fixtures.",
  );
} finally {
  await browser.close();
}
