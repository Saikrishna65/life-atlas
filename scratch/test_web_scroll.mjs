import fs from "fs";
import { spawn } from "child_process";

const chromeCandidates = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
];
const chromePath = chromeCandidates.find(p => fs.existsSync(p)) || chromeCandidates[0];
const tempDir = `${process.env.TEMP}\\chrome-web-scroll-${Date.now()}`;
const port = 9342;

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

  console.log("Navigating to http://localhost:3001 in desktop web mode (1920x1080)...");
  await sendSession("Page.navigate", { url: "http://localhost:3001" });
  await new Promise(r => setTimeout(r, 4000));

  // Inspect Lenis state, html/body styles, and test wheel scroll
  const inspectRes = await sendSession("Runtime.evaluate", {
    expression: `(() => {
      const html = document.documentElement;
      const body = document.body;
      return JSON.stringify({
        htmlClasses: html.className,
        htmlStyle: html.getAttribute('style'),
        htmlOverflow: window.getComputedStyle(html).overflow,
        htmlHeight: window.getComputedStyle(html).height,
        bodyHeight: window.getComputedStyle(body).height,
        bodyScrollHeight: body.scrollHeight,
        htmlScrollHeight: html.scrollHeight,
        windowScrollY: window.scrollY,
      });
    })()`,
    returnByValue: true
  });
  console.log("Document scroll metrics:", inspectRes.result?.result?.value);

  // Dispatch mouse wheel event
  console.log("Dispatching mouse wheel event (deltaY: 500)...");
  await sendSession("Input.dispatchMouseEvent", {
    type: "mouseWheel",
    x: 500,
    y: 500,
    deltaX: 0,
    deltaY: 500,
  });
  await new Promise(r => setTimeout(r, 1000));

  const afterWheel = await sendSession("Runtime.evaluate", {
    expression: `window.scrollY`,
    returnByValue: true
  });
  console.log("window.scrollY after mouse wheel:", afterWheel.result?.result?.value);

  ws.close();
  chrome.kill();
  try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
}

run().catch(e => {
  console.error(e);
  chrome.kill();
});
