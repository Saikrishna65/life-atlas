import fs from "fs";
import path from "path";
import { spawn } from "child_process";

const chromePath = `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`;
const tempDir = `${process.env.TEMP}\\chrome-cdp-profile-${Date.now()}`;
const port = 9333;

console.log("Launching headless Chrome...");
const chrome = spawn(chromePath, [
  "--headless=new",
  `--user-data-dir=${tempDir}`,
  `--remote-debugging-port=${port}`,
  "--window-size=1920,1080",
  "--disable-gpu=false",
  "--enable-webgl",
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

  if (!wsUrl) {
    console.error("Failed to connect to Chrome CDP");
    chrome.kill();
    return;
  }

  const ws = new WebSocket(wsUrl);
  let idCounter = 1;
  const pending = new Map();

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.method === "Runtime.consoleAPICalled") {
      console.log("[Browser Console]", ...msg.params.args.map(a => a.value || a.description));
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
  console.log("Navigating to http://localhost:3000...");
  await sendSession("Page.navigate", { url: "http://localhost:3000" });

  console.log("Waiting 5 seconds for WebGL scene and textures to settle...");
  await new Promise(r => setTimeout(r, 5500));

  console.log("Capturing screenshot...");
  const snapRes = await sendSession("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
  });

  const base64Data = snapRes.result?.data;
  if (base64Data) {
    const outPath = path.resolve("./public/images/hero_stage1_actual.png");
    fs.writeFileSync(outPath, Buffer.from(base64Data, "base64"));
    console.log("Screenshot successfully saved to:", outPath);
  } else {
    console.error("Screenshot data was empty:", snapRes);
  }

  ws.close();
  chrome.kill();
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch {}
}

run().catch((err) => {
  console.error("Error during capture:", err);
  chrome.kill();
});
