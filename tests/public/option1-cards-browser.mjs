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
}
try {
  const page = await browser.newPage({
    viewport: { width: 1920, height: 1080 },
  });
  page.on("pageerror", (e) => errors.push(e.message));
  await media(page);
  await page.goto("http://localhost:3008", { waitUntil: "domcontentloaded" });
  await page
    .locator('.hero-globe-canvas[data-globe-ready="true"]')
    .waitFor({ timeout: 45000 });
  await page.locator(".hero-gallery-landscape").evaluate((el) => el.decode());
  const globe = page.locator(".hero-globe-canvas");
  assert.ok(await globe.locator("canvas").isVisible());
  await page.waitForFunction(
    () =>
      document.querySelector(".hero-globe-canvas")?.dataset.globeMotion ===
      "paused",
  );
  await page
    .getByRole("link", { name: "Explore the Globe", exact: true })
    .hover();
  await page.waitForFunction(
    () =>
      document.querySelector(".hero-globe-canvas")?.dataset.globeMotion ===
      "rotating",
  );
  await page.mouse.move(800, 100);
  await page.waitForFunction(
    () =>
      document.querySelector(".hero-globe-canvas")?.dataset.globeMotion ===
      "paused",
  );
  const gallery = page.getByRole("link", {
    name: "Photo Gallery",
    exact: true,
  });
  assert.equal(await gallery.getAttribute("href"), "/photography");
  assert.equal(
    await gallery
      .locator(".hero-gallery-landscape")
      .getAttribute("src")
      .then((url) => url.includes("gallery-window")),
    true,
  );
  assert.equal(await page.locator(".trip-film-photo-stack").count(), 0);
  assert.equal(await page.locator(".trip-film-stage video[poster]").count(), 0);
  await page
    .getByRole("button", { name: "Pause trip films", exact: true })
    .click();
  await page.waitForTimeout(900);
  await page.screenshot({ path: "work/qa-option1/desktop.png" });
  await page
    .locator(".trip-film-discover")
    .screenshot({ path: "work/qa-option1/cards.png" });
  await gallery.click();
  await page.waitForURL("**/photography");
  await page.goBack();
  await page
    .locator('.hero-globe-canvas[data-globe-ready="true"]')
    .waitFor({ timeout: 45000 });
  await page
    .getByRole("link", { name: "Explore the Globe", exact: true })
    .click();
  await page.waitForFunction(
    () => !!document.querySelector("#observatory .observatory-heading"),
  );
  await page.locator("#observatory canvas").first().waitFor({ timeout: 45000 });
  const fallback = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
  });
  fallback.on("pageerror", (e) => errors.push(e.message));
  await media(fallback);
  await fallback.goto("http://localhost:3008");
  await fallback
    .locator('.hero-globe-canvas[data-globe-ready="true"]')
    .waitFor({ timeout: 45000 });
  await fallback
    .getByRole("link", { name: "Explore the Globe", exact: true })
    .hover();
  await fallback.waitForTimeout(350);
  assert.equal(
    await fallback
      .locator(".hero-globe-canvas")
      .getAttribute("data-globe-motion"),
    "paused",
  );
  await fallback
    .locator(".hero-globe-canvas canvas")
    .evaluate((el) =>
      el
        .getContext("webgl2")
        ?.getExtension("WEBGL_lose_context")
        ?.loseContext(),
    );
  await fallback.locator('.hero-globe-preview[data-failed="true"]').waitFor();
  assert.ok(await fallback.locator(".hero-globe-fallback").isVisible());
  assert.equal(
    await fallback
      .getByRole("link", { name: "Explore the Globe", exact: true })
      .getAttribute("href"),
    "/#observatory",
  );
  const mobile = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    reducedMotion: "reduce",
  });
  mobile.on("pageerror", (e) => errors.push(e.message));
  await media(mobile);
  await mobile.goto("http://localhost:3008", { waitUntil: "networkidle" });
  assert.equal(await mobile.locator(".hero-globe-canvas canvas").count(), 0);
  assert.ok(
    await mobile.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await mobile.screenshot({ path: "work/qa-option1/mobile.png" });
  assert.deepEqual(errors, []);
  console.log(
    "PASS approved gallery art, live white/hex globe preview, idle/hover suspension, navigation/back lifecycle, reduced motion, WebGL loss fallback, mobile renderer avoidance, no hero poster and no browser exceptions. Video bytes used local fixtures.",
  );
} finally {
  await browser.close();
}
