import fs from "fs";
import { spawn } from "child_process";

const chromeCandidates = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
];
const chromePath = chromeCandidates.find(p => fs.existsSync(p)) || chromeCandidates[0];
const tempDir = `${process.env.TEMP}\\chrome-web-scroll-full-${Date.now()}`;
const port = 9343;

const chrome = spawn(chromePath, [
  "--headless=new",
  `--user-data-dir=${tempDir}`,
  `--remote-debugging-port=${port}`,
  "--window-size=1920,1080",
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

  console.log("Navigating to http://localhost:3001...");
  await sendSession("Page.navigate", { url: "http://localhost:3001" });
  await new Promise(r => setTimeout(r, 3000));

  const scrollPositions = [];

  // Scroll down 6 times in 400px increments
  for (let i = 1; i <= 6; i++) {
    await sendSession("Input.dispatchMouseEvent", {
      type: "mouseWheel",
      x: 960,
      y: 540,
      deltaX: 0,
      deltaY: 400,
    });
    await new Promise(r => setTimeout(r, 250));
    const pos = await sendSession("Runtime.evaluate", {
      expression: `window.scrollY`,
      returnByValue: true
    });
    scrollPositions.push({ action: `wheel down ${i}`, y: pos.result?.result?.value });
  }

  // Now scroll back up 4 times
  for (let i = 1; i <= 4; i++) {
    await sendSession("Input.dispatchMouseEvent", {
      type: "mouseWheel",
      x: 960,
      y: 540,
      deltaX: 0,
      deltaY: -400,
    });
    await new Promise(r => setTimeout(r, 250));
    const pos = await sendSession("Runtime.evaluate", {
      expression: `window.scrollY`,
      returnByValue: true
    });
    scrollPositions.push({ action: `wheel up ${i}`, y: pos.result?.result?.value });
  }

  console.log("Desktop scroll trajectory:", JSON.stringify(scrollPositions, null, 2));

  ws.close();
  chrome.kill();
  try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
}

run().catch(e => {
  console.error(e);
  chrome.kill();
});
