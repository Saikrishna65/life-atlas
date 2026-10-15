import fs from "fs";
import { spawn } from "child_process";

const chromeCandidates = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
];
const chromePath = chromeCandidates.find((p) => fs.existsSync(p)) || chromeCandidates[0];
const tempDir = `${process.env.TEMP}\\chrome-door-prototype-${Date.now()}`;
const port = 9338;

const chrome = spawn(
  chromePath,
  [
    "--headless=new",
    `--user-data-dir=${tempDir}`,
    `--remote-debugging-port=${port}`,
    "--window-size=1920,1080",
    "about:blank",
  ],
  { stdio: "ignore" }
);

async function run() {
  let wsUrl = null;
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`);
      const data = await res.json();
      wsUrl = data.webSocketDebuggerUrl;
      if (wsUrl) break;
    } catch {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  if (!wsUrl) {
    throw new Error("Could not connect to Chrome debugging WebSocket");
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

  await new Promise((r) => { ws.onopen = r; });
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

  // Monitor console messages & exceptions
  const consoleLogs = [];
  ws.addEventListener("message", (event) => {
    const msg = JSON.parse(event.data);
    if (msg.method === "Runtime.consoleAPICalled") {
      consoleLogs.push({ type: msg.params.type, args: msg.params.args });
    }
    if (msg.method === "Runtime.exceptionThrown") {
      consoleLogs.push({ type: "exception", details: msg.params.exceptionDetails });
    }
  });

  await sendSession("Page.enable");
  await sendSession("Runtime.enable");

  console.log("Navigating to http://localhost:3001/prototype/hero-door ...");
  await sendSession("Page.navigate", { url: "http://localhost:3001/prototype/hero-door" });

  // Wait 4 seconds for full Three.js initialization and shader compilation
  await new Promise((r) => setTimeout(r, 4500));

  // 1. Capture 3D Prototype (Open 65 deg with typography)
  console.log("Capturing 3D Prototype (Open 65 deg)...");
  const snap1 = await sendSession("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync("./scratch/prototype_open_65deg.png", Buffer.from(snap1.result.data, "base64"));

  // 2. Click "Closed (0 deg)" in toolbar
  console.log("Switching to Closed (0 deg)...");
  await sendSession("Runtime.evaluate", {
    expression: `(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const closedBtn = btns.find(b => b.textContent.includes('Closed'));
      if (closedBtn) closedBtn.click();
    })()`,
  });
  await new Promise((r) => setTimeout(r, 1000));
  const snap2 = await sendSession("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync("./scratch/prototype_closed_0deg.png", Buffer.from(snap2.result.data, "base64"));

  // 3. Switch back to 65 deg and toggle "Side-by-Side" mode
  console.log("Switching to Side-by-Side comparison mode...");
  await sendSession("Runtime.evaluate", {
    expression: `(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const refOpenBtn = btns.find(b => b.textContent.includes('Reference (65'));
      if (refOpenBtn) refOpenBtn.click();
      const sbsBtn = btns.find(b => b.textContent.includes('Side-by-Side'));
      if (sbsBtn) sbsBtn.click();
    })()`,
  });
  await new Promise((r) => setTimeout(r, 1200));
  const snap3 = await sendSession("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync("./scratch/prototype_side_by_side.png", Buffer.from(snap3.result.data, "base64"));

  // Save console log summary
  fs.writeFileSync("./scratch/prototype_console_logs.json", JSON.stringify(consoleLogs, null, 2));
  console.log("All screenshots and logs captured successfully!");

  ws.close();
  chrome.kill();
  try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
}

run().catch((e) => {
  console.error("Capture script error:", e);
  chrome.kill();
});
