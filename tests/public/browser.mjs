/** Run against a local server: node tests/public/browser.mjs. Playwright + Chromium required. */
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const resolve = createRequire(import.meta.url).resolve;
const playwright = await import(pathToFileURL(resolve("playwright")).href);
const { chromium } = playwright.default ?? playwright;
const origin = process.env.ATLAS_QA_URL ?? "http://localhost:3001";
const directory = "work/qa";
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.ATLAS_CHROMIUM ?? "/usr/bin/chromium",
  args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
});
const results = [],
  errors = [],
  consoleErrors = [],
  failures = [];
let activePage;
async function check(name, fn) {
  try {
    await fn();
    results.push({ name, passed: true });
    console.log("PASS", name);
  } catch (e) {
    results.push({ name, passed: false, message: e.message });
    console.log("FAIL", name, e.message);
    await activePage?.keyboard.press("Escape").catch(() => {});
  }
}
function attach(page) {
  activePage = page;
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  page.on("response", (r) => {
    if (r.status() >= 400 && !r.url().includes("favicon"))
      failures.push({ status: r.status(), url: r.url() });
  });
}
async function scene(page, id) {
  console.log("SCENE", id, page.viewportSize().width);
  await page.locator("#" + id).scrollIntoViewIfNeeded();
  await page.waitForTimeout(900);
  await page.waitForFunction(
    (id) =>
      !document.querySelector("#" + id)?.classList.contains("world-loading"),
    id,
  );
  await page.locator("#" + id).evaluate((el) => {
    const lenis = window.__lenis;
    if (lenis)
      lenis.scrollTo(el, { immediate: true, offset: -80, force: true });
    else window.scrollTo(0, el.offsetTop - 80);
  });
  await page.waitForTimeout(700);
  await page.locator("#" + id).evaluate((el) =>
    window.__lenis.scrollTo(el, {
      immediate: true,
      offset: -80,
      force: true,
    }),
  );
  await page.waitForTimeout(200);
  assert.ok(
    await page
      .locator("#" + id)
      .evaluate((el) => Math.abs(el.getBoundingClientRect().top - 80) < 130),
    `Chapter ${id} did not reach the viewport`,
  );
}
async function shot(page, name) {
  await page.screenshot({
    path: `${directory}/${name}.png`,
    animations: "disabled",
  });
}
try {
  const desktop = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
  });
  const page = await desktop.newPage();
  attach(page);
  await page.goto(origin, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForFunction(() => window.__heroReady === true);
  await check(
    "original door renders closed, opens with scroll, reaches its unchanged endpoint",
    async () => {
      const canvas = page.locator('[aria-label="Life Atlas Hero"] canvas');
      const first = await canvas.evaluate((c) => c.toDataURL());
      await shot(page, "01-preserved-hero");
      await page.evaluate(() =>
        window.__lenis.scrollTo(1200, { immediate: true }),
      );
      await page.waitForTimeout(900);
      const middle = await canvas.evaluate((c) => c.toDataURL());
      assert.notEqual(first, middle);
      await shot(page, "02-door-opening");
      await page.evaluate(() =>
        window.__lenis.scrollTo(2400, { immediate: true }),
      );
      await page.waitForTimeout(1000);
      const final = await canvas.evaluate((c) => c.toDataURL());
      assert.notEqual(middle, final);
      await shot(page, "03-hero-reveal");
    },
  );
  await check(
    "heavy globe and optional music data are deferred at initial entry",
    async () => {
      const resources = await page.evaluate(() =>
        performance.getEntriesByType("resource").map((r) => r.name),
      );
      assert.ok(
        !resources.some((r) => r.includes("countries.geojson")),
        "globe geography downloaded before approaching Observatory",
      );
    },
  );
  await scene(page, "arrival");
  await check(
    "arrival hotspot reveals and dismisses a field note",
    async () => {
      await page
        .getByRole("button", {
          name: "Discover A world to discover",
          exact: true,
        })
        .click();
      assert.equal(
        await page
          .getByRole("heading", { name: "A world to discover", exact: true })
          .count(),
        1,
      );
      await page
        .getByRole("button", { name: "Close A world to discover", exact: true })
        .click();
    },
  );
  await shot(page, "04-arrival");
  await scene(page, "observatory");
  await check(
    "globe renders, location selection and journey preview function",
    async () => {
      await page.waitForFunction(() => window.__globeReady === true);
      const obs = page.locator("#observatory");
      await obs
        .getByRole("searchbox", { name: "Search destinations" })
        .fill("Kyoto");
      await obs.getByRole("button", { name: /Kyoto Japan/ }).click();
      assert.ok(
        await obs
          .getByRole("heading", { name: "Kyoto", exact: true })
          .isVisible(),
      );
      await obs
        .getByRole("button", { name: "Open the journey", exact: true })
        .click();
      await page.getByRole("dialog").waitFor();
      assert.ok(
        (await page.getByRole("dialog").innerText()).includes(
          "Fictional itinerary",
        ),
      );
      await page.keyboard.press("Escape");
      await obs.getByRole("searchbox").fill("");
    },
  );
  await shot(page, "05-observatory");
  await scene(page, "expeditions");
  await check(
    "journey search, filters, sorting, tabs, checklist, download and dialog focus restoration",
    async () => {
      const exp = page.locator("#expeditions");
      await exp.getByRole("searchbox").fill("Himalayan");
      assert.equal(await exp.locator(".expedition-panel").count(), 1);
      const trigger = exp.locator(".expedition-panel").first();
      await trigger.click();
      const dialog = page.getByRole("dialog");
      await dialog.waitFor();
      await dialog.getByRole("tab", { name: "Packing", exact: true }).click();
      await dialog.getByRole("checkbox").first().check();
      assert.match(await dialog.innerText(), /1 of 6 ready/);
      await dialog.getByRole("tab", { name: "Budget", exact: true }).click();
      assert.match(await dialog.innerText(), /Example total/i);
      await dialog.getByRole("tab", { name: "Timeline", exact: true }).click();
      assert.equal(await dialog.locator(".detail-itinerary li").count(), 5);
      const downloadPromise = page.waitForEvent("download");
      await dialog
        .getByRole("button", { name: "Take this sample plan" })
        .click();
      assert.match(
        (await downloadPromise).suggestedFilename(),
        /himalayan-journey/,
      );
      await page.keyboard.press("Escape");
      assert.ok(await trigger.evaluate((el) => el === document.activeElement));
      await exp.getByRole("searchbox").fill("");
      await exp.getByLabel("Filter terrain").selectOption("Coast");
      await exp.getByLabel("Sort journeys").selectOption("Shortest first");
      assert.ok((await exp.locator(".expedition-panel").count()) > 0);
      await exp.getByLabel("Filter terrain").selectOption("All terrains");
    },
  );
  await shot(page, "06-expeditions");
  await scene(page, "memories");
  await check(
    "memory search, category filters, lightbox zoom, photo changes and keyboard navigation",
    async () => {
      const mem = page.locator("#memories");
      await mem.getByRole("searchbox").fill("Kyoto");
      await mem.getByRole("button", { name: "Discovery", exact: true }).click();
      assert.equal(await mem.locator(".memory-print").count(), 1);
      await mem.locator(".memory-print").first().click();
      const dialog = page.getByRole("dialog");
      const image = dialog.locator(".lightbox-image img");
      const first = await image.getAttribute("src");
      await dialog.getByRole("button", { name: "View image 2" }).click();
      assert.notEqual(await image.getAttribute("src"), first);
      await dialog.getByRole("button", { name: "Zoom in" }).click();
      assert.ok(
        await dialog.getByRole("button", { name: "Zoom out" }).isVisible(),
      );
      await page.keyboard.press("Escape");
      await mem.getByRole("searchbox").fill("");
      await mem
        .getByRole("button", { name: "All moments", exact: true })
        .click();
      await mem.locator(".memory-print").first().click();
      const title = await page
        .getByRole("dialog")
        .getByRole("heading")
        .innerText();
      await page.keyboard.press("ArrowRight");
      assert.notEqual(
        await page.getByRole("dialog").getByRole("heading").innerText(),
        title,
      );
      await page.keyboard.press("Escape");
    },
  );
  await shot(page, "07-memory-archive");
  await scene(page, "sound");
  await check(
    "sound filters, playlist details, album catalog and honest visual preview",
    async () => {
      const sound = page.locator("#sound");
      await sound
        .getByLabel("Filter listening mood")
        .selectOption("After dark");
      await sound
        .getByRole("button", { name: "Explore collection", exact: true })
        .click();
      assert.equal(
        await page.getByRole("dialog").locator(".playlist-tracks>div").count(),
        12,
      );
      await page.keyboard.press("Escape");
      await sound
        .getByRole("button", { name: "Visual preview", exact: true })
        .click();
      assert.ok(
        await sound
          .getByText("Visual preview only. No sound is playing.")
          .isVisible(),
      );
      assert.equal(await page.locator("audio").count(), 0);
      await sound
        .getByRole("button", { name: "Pause visuals", exact: true })
        .click();
      await sound.getByRole("button", { name: "Albums", exact: true }).click();
      await sound.locator(".album-catalog-item").first().click();
      assert.equal(
        await page.getByRole("dialog").locator(".playlist-tracks>div").count(),
        6,
      );
      await page.keyboard.press("Escape");
      await sound.getByRole("button", { name: "Artists", exact: true }).click();
      assert.equal(await sound.locator(".artist-row").count(), 45);
      await sound
        .getByRole("button", { name: "Playlists", exact: true })
        .click();
      await sound
        .getByLabel("Filter listening mood")
        .selectOption("All frequencies");
    },
  );
  await shot(page, "08-sound");
  await scene(page, "intelligence");
  await check(
    "orb, authored conversation selection and workflow demonstration",
    async () => {
      const ai = page.locator("#intelligence");
      await ai.locator(".ai-topic select").selectOption("Finance");
      assert.match(
        await ai.locator(".conversation-answer").innerText(),
        /fictional estimates/,
      );
      await ai.getByRole("button", { name: "Workflow", exact: true }).click();
      assert.equal(await ai.locator(".workflow-paper li").count(), 3);
      await ai
        .getByRole("button", { name: "Conversations", exact: true })
        .click();
      await ai
        .getByRole("button", { name: "Next example", exact: true })
        .click();
      assert.match(
        await ai.locator(".conversation-answer").innerText(),
        /balance/,
      );
      assert.equal(await ai.locator(".atlas-orb canvas").count(), 1);
    },
  );
  await shot(page, "09-intelligence");
  await scene(page, "system");
  await check(
    "system nodes, reconciled finance ledger, reminder updates and linked activity",
    async () => {
      const sys = page.locator("#system");
      await sys.getByRole("button", { name: "Finance", exact: true }).click();
      await sys
        .getByRole("button", { name: "Open the local demo", exact: true })
        .click();
      assert.equal(
        await page.getByRole("dialog").locator(".sample-ledger>div").count(),
        10,
      );
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Previous month" })
        .click();
      assert.match(await page.getByRole("dialog").innerText(), /October 2025/);
      await page.keyboard.press("Escape");
      await sys.getByRole("button", { name: "Reminders", exact: true }).click();
      await sys
        .getByRole("button", { name: "Open the local demo", exact: true })
        .click();
      const check = page.getByRole("dialog").getByRole("checkbox").nth(1);
      await check.check();
      assert.ok(await check.isChecked());
      await page.keyboard.press("Escape");
      await sys
        .getByRole("button", { name: "Organization", exact: true })
        .click();
      await sys
        .getByRole("button", { name: "Open the local demo", exact: true })
        .click();
      assert.equal(
        await page.getByRole("dialog").locator(".sample-ledger>div").count(),
        12,
      );
      await page.keyboard.press("Escape");
      await sys.getByRole("button", { name: "Travel", exact: true }).click();
    },
  );
  await shot(page, "10-atlas-system");
  await scene(page, "beyond");
  await shot(page, "11-beyond");
  await check("chapter menu traps focus, navigates and closes", async () => {
    await page.getByRole("button", { name: "The atlas", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.waitFor();
    await page.keyboard.press("Shift+Tab");
    assert.ok(
      await dialog.evaluate((el) => el.contains(document.activeElement)),
    );
    await dialog.getByRole("button", { name: /The Sound Dimension/ }).click();
    await page.waitForTimeout(2000);
    assert.equal(await page.getByRole("dialog").count(), 0);
    assert.equal(await page.evaluate(() => location.hash), "#sound");
    assert.ok(
      await page
        .locator("#sound")
        .evaluate((el) => Math.abs(el.getBoundingClientRect().top - 74) < 100),
    );
  });
  await check(
    "return to original door works after a long browsing session",
    async () => {
      await scene(page, "beyond");
      await page
        .getByRole("button", { name: "Return to the door", exact: true })
        .click();
      await page.waitForFunction(
        () => window.scrollY < 5,
        {},
        { timeout: 8000 },
      );
      assert.ok(await page.evaluate(() => window.scrollY < 5));
    },
  );
  await check(
    "public routes, real local search, direct detail links and back navigation",
    async () => {
      for (const path of [
        "/explore",
        "/trips",
        "/places",
        "/map",
        "/photography",
        "/timeline",
        "/experiences",
        "/food",
        "/cinema",
        "/about",
        "/search?q=Kyoto",
        "/trips/himalayan-journey",
        "/places/kyoto",
      ]) {
        const response = await page.goto(origin + path, {
          waitUntil: "domcontentloaded",
          timeout: 60000,
        });
        assert.equal(response.status(), 200, path);
        await page.waitForTimeout(100);
        assert.equal(await page.locator("h1").count(), 1, path);
      }
      await page.goto(origin + "/explore", { waitUntil: "networkidle" });
      await page
        .getByRole("button", { name: "Search the atlas", exact: true })
        .click();
      await page.getByRole("dialog").getByRole("searchbox").fill("Kyoto");
      await page
        .getByRole("dialog")
        .getByRole("link", { name: /Place Kyoto/ })
        .click();
      await page.waitForURL("**/places/kyoto");
      await page.goBack();
      assert.match(page.url(), /explore/);
    },
  );
  await check(
    "complete track catalog: search, mood filtering and album relationships",
    async () => {
      await page.goto(origin + "/#sound", { waitUntil: "networkidle" });
      const sound = page.locator("#sound");
      await sound.getByRole("button", { name: "Tracks", exact: true }).click();
      assert.equal(await sound.locator(".track-row").count(), 216);
      await sound
        .getByLabel("Filter listening mood")
        .selectOption("After dark");
      assert.ok(
        (await sound.locator(".track-row").count()) > 0 &&
          (await sound.locator(".track-row").count()) < 216,
      );
      await sound.getByRole("searchbox").fill("Night Bus");
      assert.ok((await sound.locator(".track-row").count()) > 0);
      await sound.locator(".track-row").first().click();
      assert.equal(
        await page.getByRole("dialog").locator(".playlist-tracks>div").count(),
        6,
      );
      await page.keyboard.press("Escape");
    },
  );
  await check(
    "connected details: memory navigation closes overlays and opens linked journeys",
    async () => {
      await page.goto(origin + "/#expeditions", { waitUntil: "networkidle" });
      await page.locator("#expeditions .expedition-panel").first().click();
      await page
        .getByRole("dialog")
        .getByRole("link", { name: "Explore the memory archive" })
        .click();
      await page.waitForTimeout(1500);
      assert.equal(await page.getByRole("dialog").count(), 0);
      await page.locator("#memories .memory-print").first().click();
      assert.ok(
        (await page.getByRole("dialog").locator(".memory-related a").count()) >
          0,
      );
      await page
        .getByRole("dialog")
        .locator(".memory-related a")
        .first()
        .click();
      await page.waitForURL("**/trips/**");
      assert.equal(await page.getByRole("dialog").count(), 0);
    },
  );
  await desktop.close();
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
  });
  const mp = await mobile.newPage();
  attach(mp);
  await mp.goto(origin, { waitUntil: "networkidle", timeout: 90000 });
  await check(
    "mobile: original hero framing, all scenes and no horizontal page overflow",
    async () => {
      await shot(mp, "12-mobile-hero");
      for (const id of [
        "arrival",
        "observatory",
        "expeditions",
        "memories",
        "sound",
        "intelligence",
        "system",
        "beyond",
      ]) {
        await scene(mp, id);
        const widths = await mp.evaluate(() => ({
          page: document.documentElement.scrollWidth,
          viewport: innerWidth,
        }));
        assert.ok(
          widths.page <= widths.viewport + 1,
          `${id}: ${JSON.stringify(widths)}`,
        );
        await shot(mp, "mobile-" + id);
      }
    },
  );
  await check(
    "mobile: chapter navigation and touch-size detail dismissal",
    async () => {
      await scene(mp, "expeditions");
      await mp.locator("#expeditions .expedition-panel").first().tap();
      await mp.getByRole("dialog").waitFor();
      await mp.getByRole("button", { name: "Close dialog" }).tap();
      await mp.getByRole("button", { name: "The atlas", exact: true }).tap();
      await mp
        .getByRole("dialog")
        .getByRole("button", { name: /The Memory Archive/ })
        .tap();
      await mp.waitForTimeout(1700);
      assert.equal(await mp.evaluate(() => location.hash), "#memories");
      assert.ok(
        await mp
          .locator("#memories")
          .evaluate(
            (el) => Math.abs(el.getBoundingClientRect().top - 74) < 150,
          ),
      );
    },
  );
  await check(
    "mobile: native vertical swipe passes through the preserved globe",
    async () => {
      await scene(mp, "observatory");
      const canvas = mp.locator("#observatory canvas");
      assert.equal(
        await canvas.evaluate((el) => getComputedStyle(el).touchAction),
        "pan-y",
      );
      const box = await canvas.boundingBox();
      const y = Math.min(780, box.y + box.height * 0.6);
      const before = await mp.evaluate(() => scrollY);
      const cdp = await mobile.newCDPSession(mp);
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x: 195, y }],
      });
      for (let i = 1; i <= 8; i++) {
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [{ x: 195, y: y - i * 30 }],
        });
        await mp.waitForTimeout(35);
      }
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
      await mp.waitForTimeout(400);
      assert.ok((await mp.evaluate(() => scrollY)) > before + 60);
      await cdp.detach();
    },
  );
  await check(
    "responsive: landscape orientation and a 320px viewport",
    async () => {
      await mp.setViewportSize({ width: 844, height: 390 });
      await mp.waitForTimeout(500);
      assert.ok(
        await mp.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      );
      await shot(mp, "15-mobile-landscape");
      await mp.setViewportSize({ width: 320, height: 568 });
      await scene(mp, "system");
      assert.ok(
        await mp.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      );
      await shot(mp, "16-small-mobile");
    },
  );
  await mobile.close();
  const reduced = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    reducedMotion: "reduce",
  });
  const rp = await reduced.newPage();
  attach(rp);
  await rp.goto(origin, { waitUntil: "networkidle", timeout: 90000 });
  await check(
    "reduced motion: original hero alternative, visible reading and paused new animation",
    async () => {
      assert.equal(
        Math.round(
          (await rp.locator('[aria-label="Life Atlas Hero"]').boundingBox())
            .height,
        ),
        900,
      );
      await scene(rp, "sound");
      await rp
        .getByRole("button", { name: "Visual preview", exact: true })
        .click();
      const names = await rp
        .locator(".sound-wave i")
        .first()
        .evaluate((el) => getComputedStyle(el).animationName);
      assert.equal(names, "none");
      await shot(rp, "13-reduced-motion");
    },
  );
  await reduced.close();
  const fallback = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  await fallback.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
      return String(kind).includes("webgl")
        ? null
        : original.call(this, kind, ...args);
    };
  });
  const fp = await fallback.newPage();
  attach(fp);
  await fp.goto(origin, { waitUntil: "networkidle", timeout: 90000 });
  await check(
    "WebGL failure: destination directory and CSS orb remain usable",
    async () => {
      await scene(fp, "observatory");
      assert.ok(
        await fp
          .getByText("Your world, in words. Select any destination.")
          .isVisible(),
      );
      await fp.locator("#observatory").getByRole("searchbox").fill("Tokyo");
      await fp.getByRole("button", { name: /Tokyo Japan/ }).click();
      assert.ok(
        await fp
          .getByRole("heading", { name: "Tokyo", exact: true })
          .isVisible(),
      );
      await scene(fp, "intelligence");
      assert.equal(await fp.locator(".atlas-orb canvas").count(), 0);
      assert.ok(await fp.locator(".orb-css-fallback").isVisible());
      await shot(fp, "14-webgl-fallback");
    },
  );
  await fallback.close();
} finally {
  await browser.close();
  await writeFile(
    `${directory}/results.json`,
    JSON.stringify({ results, errors, consoleErrors, failures }, null, 2),
  );
}
console.log(
  JSON.stringify(
    {
      passed: results.filter((r) => r.passed).length,
      failed: results.filter((r) => !r.passed).length,
      pageErrors: errors.length,
      consoleErrors: consoleErrors.length,
      httpFailures: failures.length,
    },
    null,
    2,
  ),
);
if (results.some((r) => !r.passed) || errors.length) process.exitCode = 1;
