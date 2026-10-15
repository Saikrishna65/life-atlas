import fs from "fs";
import { spawn } from "child_process";

const chromeCandidates = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
];
const chromePath = chromeCandidates.find((p) => fs.existsSync(p)) || chromeCandidates[0];
const tempDir = `${process.env.TEMP}\\chrome-inspect-hero-${Date.now()}`;
const port = 9336;

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
      // Find all elements in the first screen / viewport
      const elements = Array.from(document.querySelectorAll('*')).filter(el => {
        const rect = el.getBoundingClientRect();
        return rect.top >= 0 && rect.top < 1080 && rect.width > 100 && rect.height > 100;
      });

      const heroInfo = elements.map(el => {
        const style = window.getComputedStyle(el);
        return {
          tag: el.tagName,
          id: el.id,
          className: el.className,
          bgImage: style.backgroundImage,
          bgColor: style.backgroundColor,
          position: style.position,
          zIndex: style.zIndex,
          src: el.src || null,
          hasChildren: el.children.length
        };
      }).filter(info => 
        (info.bgImage && info.bgImage !== 'none') || 
        info.tag === 'IMG' || 
        info.tag === 'VIDEO' || 
        info.tag === 'CANVAS' ||
        info.tag === 'IFRAME' ||
        /hero/i.test(info.className)
      );

      // Extract all image/video URLs on the entire page
      const allImages = Array.from(document.images).map(img => ({
        src: img.src,
        className: img.className,
        width: img.width,
        height: img.height
      }));

      // Check for Spline or 3D script tags
      const scripts = Array.from(document.scripts).map(s => s.src).filter(Boolean);

      return {
        heroInfo,
        allImages: allImages.slice(0, 20),
        scripts: scripts.slice(0, 20),
        first1000CharsOfBody: document.body.innerHTML.slice(0, 2000)
      };
    })()`,
    returnByValue: true
  });

  if (res.result?.exceptionDetails) {
    console.error("Evaluation Exception:", res.result.exceptionDetails);
  }
  fs.writeFileSync("./scratch/hero_inspection.json", JSON.stringify(res.result?.value || res, null, 2));
  console.log("Hero Inspection Result saved to ./scratch/hero_inspection.json");

  ws.close();
  chrome.kill();
  try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
}

run().catch((e) => {
  console.error(e);
  chrome.kill();
});
