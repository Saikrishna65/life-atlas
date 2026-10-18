import fs from "fs";
import path from "path";
import { spawn } from "child_process";

const chromeCandidates = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
];
const chromePath = chromeCandidates.find(p => fs.existsSync(p)) || chromeCandidates[0];
const tempDir = `${process.env.TEMP}\\chrome-scroll-test-${Date.now()}`;
const port = 9340;

const chrome = spawn(chromePath, [
  "--headless=new",
  `--user-data-dir=${tempDir}`,
  `--remote-debugging-port=${port}`,
  "--window-size=390,844",
  "about:blank",
], { stdio: "ignore" });

async function run() {
  let wsUrl = null;
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`);
      const data = await res.json();
      wsUrl = data.webSocketDebuggerUrl;
      if (wsUrl) break;
    } catch {
      await new Promise(r => setTimeout(r, 200));
    }
  }

  const ws = new WebSocket(wsUrl);
  let idCounter = 1;
  const pending = new Map();

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.method === "Runtime.consoleAPICalled") {
      console.log("[Console]", ...msg.params.args.map(a => a.value || a.description));
    }
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  };

  await new Promise((resolve) => { ws.onopen = resolve; });
  const send = (method, params = {}) => {
    const id = idCounter++;
    return new Promise((resolve) => {
      pending.set(id, resolve);
      ws.send(JSON.stringify({ id, method, params }));
    });
  };

  const { result: { targetId } } = await send("Target.createTarget", { url: "about:blank" });
  const { result: { sessionId } } = await send("Target.attachToTarget", { targetId, flatten: true });
  const sendSession = (method, params = {}) => {
    const id = idCounter++;
    return new Promise((resolve) => {
      pending.set(id, resolve);
      ws.send(JSON.stringify({ id, sessionId, method, params }));
    });
  };

  await sendSession("Runtime.enable");
  await sendSession("Page.enable");
  await sendSession("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true,
  });

  console.log("Navigating to http://localhost:3001 in mobile view (390x844)...");
  await sendSession("Page.navigate", { url: "http://localhost:3001" });
  await new Promise(r => setTimeout(r, 3500));

  // Check initial state
  const infoRes = await sendSession("Runtime.evaluate", {
    expression: `(() => {
      const hero = document.querySelector('[data-hero]');
      const canvas = document.querySelector('canvas');
      return JSON.stringify({
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        heroFound: !!hero,
        heroHeight: hero?.offsetHeight,
        canvasWidth: canvas?.width,
        canvasHeight: canvas?.height,
        canvasStyleW: canvas?.style.width,
        canvasStyleH: canvas?.style.height
      });
    })()`,
    returnByValue: true
  });
  console.log("Mobile Viewport & Canvas Info:", infoRes.result?.result?.value);

  // Take initial screenshot
  const initialSnap = await sendSession("Page.captureScreenshot", { format: "png" });
  if (initialSnap.result?.data) {
    fs.writeFileSync("./scratch/mobile_hero_0_initial.png", Buffer.from(initialSnap.result.data, "base64"));
    console.log("Saved scratch/mobile_hero_0_initial.png");
  }

  // Scroll in increments of 25% through the hero section and capture each stage
  const heroScrollHeights = [0.25, 0.50, 0.75, 1.0];
  for (const frac of heroScrollHeights) {
    const scrollRes = await sendSession("Runtime.evaluate", {
      expression: `(async () => {
        const hero = document.querySelector('[data-hero]');
        const maxScroll = hero ? (hero.offsetHeight - window.innerHeight) : 2000;
        const targetY = Math.round(maxScroll * ${frac});
        window.scrollTo({ top: targetY, behavior: 'instant' });
        window.dispatchEvent(new Event('scroll'));
        await new Promise(r => setTimeout(r, 600));
        return { targetY, actualY: window.scrollY };
      })()`,
      awaitPromise: true,
      returnByValue: true
    });
    console.log(`Scrolled to ${Math.round(frac * 100)}%:`, scrollRes.result?.result?.value);

    const snap = await sendSession("Page.captureScreenshot", { format: "png" });
    if (snap.result?.data) {
      const p = `./scratch/mobile_hero_${Math.round(frac * 100)}.png`;
      fs.writeFileSync(p, Buffer.from(snap.result.data, "base64"));
      console.log(`Saved screenshot ${p}`);
    }
  }

  ws.close();
  chrome.kill();
  try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
}

run().catch(e => {
  console.error(e);
  chrome.kill();
});
