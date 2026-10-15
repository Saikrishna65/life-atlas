import fs from "fs";
import { spawn } from "child_process";

const chromeCandidates = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
];
const chromePath = chromeCandidates.find((p) => fs.existsSync(p)) || chromeCandidates[0];
const tempDir = `${process.env.TEMP}\\chrome-css-inspect-${Date.now()}`;
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

  await sendSession("Page.enable");
  await sendSession("Runtime.enable");
  await sendSession("Page.navigate", { url: "https://travelnextlvl.de/" });
  await new Promise((r) => setTimeout(r, 5000));

  const res = await sendSession("Runtime.evaluate", {
    expression: `(() => {
      const hero = document.querySelector('.hero_b');
      const door = document.querySelector('.interaction_door');
      const canvas = document.querySelector('canvas');
      
      const getStyles = (el) => {
        if (!el) return null;
        const s = window.getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return {
          width: r.width,
          height: r.height,
          top: r.top,
          left: r.left,
          position: s.position,
          overflow: s.overflow,
          display: s.display,
          justifyContent: s.justifyContent,
          alignItems: s.alignItems,
          transform: s.transform
        };
      };

      return {
        hero: getStyles(hero),
        door: getStyles(door),
        canvas: getStyles(canvas),
        heroHTML: hero ? hero.outerHTML : null
      };
    })()`,
    returnByValue: true
  });

  fs.writeFileSync("./scratch/ref_styles.json", JSON.stringify(res.result?.value || res, null, 2));
  console.log("Saved ref styles to ./scratch/ref_styles.json");

  ws.close();
  chrome.kill();
  try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
}

run().catch((e) => {
  console.error(e);
  chrome.kill();
});
