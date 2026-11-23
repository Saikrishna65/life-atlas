// Run after npm run build:mobile. Uses the real packaged app, no live cloud access.
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
const { chromium } = createRequire(import.meta.url)("playwright");
const root = path.resolve("mobile-dist");
const evidence = "work/qa-startup";
await mkdir(evidence, { recursive: true });
const server = createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url, "http://localhost").pathname;
    const file = path.resolve(
      root,
      "." +
        (pathname.startsWith("/secret") || pathname === "/"
          ? "/index.html"
          : pathname),
    );
    if (!file.startsWith(root + "/")) throw new Error("Invalid path");
    res.setHeader(
      "content-type",
      file.endsWith(".js")
        ? "application/javascript"
        : file.endsWith(".css")
          ? "text/css"
          : file.endsWith(".json")
            ? "application/json"
            : "text/html",
    );
    res.end(await readFile(file));
  } catch {
    res.statusCode = 404;
    res.end();
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/*", (route) =>
    new URL(route.request().url()).origin === origin
      ? route.continue()
      : route.fulfill({
          status: 503,
          contentType: "application/json",
          body: '{"error":"Offline fixture"}',
        }),
  );
  await page.addInitScript(() => {
    // A broken hosted worker cleanup must not block the home screen.
    Object.defineProperty(navigator, "serviceWorker", {
      value: { getRegistrations: () => new Promise(() => {}) },
      configurable: true,
    });
    localStorage.setItem("startup-preservation-check", "keep");
  });
  await page.goto(origin + "/secret");
  await page
    .getByRole("heading", { name: "Private Atlas", exact: true })
    .waitFor();
  const first = await page.evaluate(() => ({
    ms: performance.now(),
    styles: [...document.querySelectorAll("link[rel=stylesheet]")].map(
      (link) => new URL(link.href).pathname,
    ),
    preserved: localStorage.getItem("startup-preservation-check"),
  }));
  assert.equal(first.preserved, "keep");
  assert.ok(
    first.styles.length < 5,
    `Startup should not install every screen: ${first.styles.length}`,
  );
  await page.screenshot({ path: evidence + "/home-mobile.png" });
  // Intent prefetch installs a lazy page's styles, and actual navigation reuses it.
  const gallery = page.getByRole("link", { name: /Photo & video gallery/ });
  await gallery.focus();
  await gallery.click();
  await page.waitForURL("**/secret/gallery");
  await page.locator(".private-gallery").first().waitFor({ timeout: 15000 });
  await page.screenshot({ path: evidence + "/gallery-mobile.png" });
  const after = await page.evaluate(() => ({
    styles: [...document.querySelectorAll("link[rel=stylesheet]")].map(
      (link) => new URL(link.href).pathname,
    ),
    overflow: document.documentElement.scrollWidth > innerWidth,
  }));
  assert.equal(after.overflow, false);
  assert.equal(
    new Set(after.styles).size,
    after.styles.length,
    "Prefetch and navigation share a stylesheet",
  );
  // Navigate through layouts that used to be imported on every app launch.
  await page.evaluate(() => {
    history.pushState({}, "", "/secret/music");
    dispatchEvent(new PopStateEvent("popstate"));
  });
  await page.locator(".music-theme.fixed").waitFor();
  await page.evaluate(() => {
    history.pushState({}, "", "/secret/vault");
    dispatchEvent(new PopStateEvent("popstate"));
  });
  await page.locator(".tv-appbar").waitFor();
  // The future lazy-CSS fallback deduplicates concurrent loads, fails visibly,
  // and permits retry without retaining a failed stylesheet element.
  let styleRequests = 0;
  await page.route("**/__test.css", (route) => {
    styleRequests++;
    return route.fulfill({
      status: styleRequests === 1 ? 503 : 200,
      contentType: "text/css",
      body: ":root{--atlas-style-test:ready}",
    });
  });
  await page.evaluate(async () => {
    const { loadStyles } = await import("/mobile-styles.js");
    let rejected = false;
    try {
      await loadStyles(["/__test.css"]);
    } catch {
      rejected = true;
    }
    if (!rejected) throw new Error("Missing stylesheet must reject");
    await Promise.all([
      loadStyles(["/__test.css"]),
      loadStyles(["/__test.css"]),
    ]);
    if (
      getComputedStyle(document.documentElement).getPropertyValue(
        "--atlas-style-test",
      ) !== "ready"
    )
      throw new Error("Styles must apply before load resolves");
  });
  assert.equal(styleRequests, 2);
  assert.deepEqual(errors, []);
  await writeFile(
    evidence + "/startup.json",
    JSON.stringify(
      {
        firstScreen: first,
        afterNavigation: after,
        note: "Desktop Chromium mobile viewport; not Android timing.",
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ firstScreen: first, afterNavigation: after }));
  console.log(
    "PASS: packaged offline home opens despite stalled worker cleanup; lazy Gallery navigation, unique styles, preserved local storage, mobile width and no page errors.",
  );
} finally {
  if (browser) await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
