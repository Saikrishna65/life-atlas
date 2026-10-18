import fs from "fs";
import { spawn } from "child_process";

const chromeCandidates = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
];
const chromePath = chromeCandidates.find(p => fs.existsSync(p)) || chromeCandidates[0];
const tempDir = `${process.env.TEMP}\\chrome-debug-preloader-${Date.now()}`;
const port = 9345;

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
    if (msg.method === "Runtime.consoleAPICalled") {
      console.log("[CONSOLE]", msg.params.type, msg.params.args.map(a => a.value || a.description).join(" "));
    }
    if (msg.method === "Runtime.exceptionThrown") {
      console.log("[EXCEPTION]", msg.params.exceptionDetails);
    }
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  };

  await new Promise(res => { ws.onopen = res; });
  const send = (method, params = {}) => {
    const id = idCounter++;
    return new Promise(res => {
      pending.set(id, res);
      ws.send(JSON.stringify({ id, method, params }));
    });
  };

  const { result: { targetId } } = await send("Target.createTarget", { url: "about:blank" });
  const { result: { sessionId } } = await send("Target.attachToTarget", { targetId, flatten: true });
  const sendSession = (method, params = {}) => {
    const id = idCounter++;
    return new Promise(res => {
      pending.set(id, res);
      ws.send(JSON.stringify({ id, sessionId, method, params }));
    });
  };

  await sendSession("Runtime.enable");
  await sendSession("Page.enable");
  await sendSession("Page.navigate", { url: "http://localhost:3001" });

  for (let t = 1; t <= 12; t++) {
    await new Promise(r => setTimeout(r, 500));
    const evalRes = await sendSession("Runtime.evaluate", {
      expression: `(() => {
        const el = document.querySelector('[aria-label="Loading Life Atlas Home"]');
        return {
          t_sec: ${t * 0.5},
          preloaderFound: !!el,
          preloaderOpacity: el ? window.getComputedStyle(el).opacity : null,
          preloaderText: el ? el.innerText.replace(/\\n+/g, ' | ') : null
        };
      })()`,
      returnByValue: true
    });
    console.log(evalRes.result?.result?.value);
  }

  ws.close();
  chrome.kill();
  try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
}

run().catch(e => {
  console.error(e);
  chrome.kill();
});
