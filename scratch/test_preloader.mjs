import fs from "fs";
import { spawn } from "child_process";

const chromeCandidates = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
];
const chromePath = chromeCandidates.find(p => fs.existsSync(p)) || chromeCandidates[0];
const tempDir = `${process.env.TEMP}\\chrome-preloader-test-${Date.now()}`;
const port = 9347;

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

  // 1. Poll until preloader element exists in DOM
  console.log("Waiting for preloader to appear in DOM...");
  let preloaderFound = false;
  for (let i = 0; i < 80; i++) {
    const evalRes = await sendSession("Runtime.evaluate", {
      expression: "!!document.querySelector('[aria-label=\"Loading Life Atlas Home\"]')",
      returnByValue: true
    });
    if (evalRes.result?.result?.value) {
      preloaderFound = true;
      console.log(`Preloader confirmed mounted after ${(i + 1) * 100}ms!`);
      break;
    }
    await new Promise(r => setTimeout(r, 100));
  }

  if (!preloaderFound) {
    throw new Error("Preloader element did not mount within 8 seconds!");
  }

  // 2. Capture screenshot while preloader is active
  await new Promise(r => setTimeout(r, 200));
  const snapPreloader = await sendSession("Page.captureScreenshot", { format: "png" });
  if (snapPreloader.result?.data) {
    fs.writeFileSync("./scratch/test_preloader_active.png", Buffer.from(snapPreloader.result.data, "base64"));
    console.log("Saved scratch/test_preloader_active.png");
  }

  // 3. Poll until preloader element is completely unmounted (removed from DOM)
  console.log("Waiting for preloader to complete and unmount from DOM...");
  let unmounted = false;
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 200));
    const evalRes = await sendSession("Runtime.evaluate", {
      expression: "!!document.querySelector('[aria-label=\"Loading Life Atlas Home\"]')",
      returnByValue: true
    });
    if (!evalRes.result?.result?.value) {
      unmounted = true;
      console.log(`Preloader successfully unmounted after ${(i + 1) * 200}ms!`);
      break;
    }
  }

  if (!unmounted) {
    throw new Error("Preloader did not unmount within 12 seconds!");
  }

  // 4. Capture screenshot of the fully revealed home page
  await new Promise(r => setTimeout(r, 500));
  const snapRevealed = await sendSession("Page.captureScreenshot", { format: "png" });
  if (snapRevealed.result?.data) {
    fs.writeFileSync("./scratch/test_page_revealed.png", Buffer.from(snapRevealed.result.data, "base64"));
    console.log("Saved scratch/test_page_revealed.png");
  }

  // 5. Verify smooth scrolling works immediately on revealed page
  await sendSession("Input.dispatchMouseEvent", {
    type: "mouseWheel",
    x: 960,
    y: 540,
    deltaX: 0,
    deltaY: 700,
  });
  await new Promise(r => setTimeout(r, 400));

  const scrollY = await sendSession("Runtime.evaluate", {
    expression: "window.scrollY",
    returnByValue: true
  });
  console.log("Scroll position after mouse wheel on revealed page:", scrollY.result?.result?.value);

  ws.close();
  chrome.kill();
  try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
}

run().catch(e => {
  console.error(e);
  chrome.kill();
});
