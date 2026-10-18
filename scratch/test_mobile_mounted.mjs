import fs from "fs";
import { spawn } from "child_process";

const chromeCandidates = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
];
const chromePath = chromeCandidates.find(p => fs.existsSync(p)) || chromeCandidates[0];
const tempDir = `${process.env.TEMP}\\chrome-scroll-test-${Date.now()}`;
const port = 9341;

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

  console.log("Navigating to http://localhost:3001...");
  await sendSession("Page.navigate", { url: "http://localhost:3001" });

  // Wait until [data-hero] exists
  console.log("Waiting for [data-hero] to mount...");
  for (let i = 0; i < 40; i++) {
    const check = await sendSession("Runtime.evaluate", {
      expression: `!!document.querySelector('[data-hero]')`,
      returnByValue: true
    });
    if (check.result?.result?.value) {
      console.log(`[data-hero] mounted after ${i * 200}ms!`);
      break;
    }
    await new Promise(r => setTimeout(r, 200));
  }

  // Allow 500ms for initial frame 0 decode
  await new Promise(r => setTimeout(r, 500));

  const snap0 = await sendSession("Page.captureScreenshot", { format: "png" });
  if (snap0.result?.data) {
    fs.writeFileSync("./scratch/mobile_hero_0_mounted.png", Buffer.from(snap0.result.data, "base64"));
    console.log("Saved scratch/mobile_hero_0_mounted.png");
  }

  // Now test incremental smooth scroll across 25 steps and measure frame responsiveness
  const scrollTestResult = await sendSession("Runtime.evaluate", {
    expression: `(async () => {
      const hero = document.querySelector('[data-hero]');
      const maxScroll = hero ? (hero.offsetHeight - window.innerHeight) : 2000;
      const steps = 25;
      const metrics = [];

      for (let i = 0; i <= steps; i++) {
        const y = Math.round((maxScroll / steps) * i);
        window.scrollTo(0, y);
        window.dispatchEvent(new Event('scroll'));
        await new Promise(r => setTimeout(r, 80));

        metrics.push({
          step: i,
          scrollProgress: (y / maxScroll).toFixed(2),
          scrollY: window.scrollY,
        });
      }
      return JSON.stringify(metrics);
    })()`,
    awaitPromise: true,
    returnByValue: true
  });

  console.log("Scroll test results sample:", scrollTestResult.result?.result?.value?.slice(0, 300));

  ws.close();
  chrome.kill();
  try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
}

run().catch(e => {
  console.error(e);
  chrome.kill();
});
