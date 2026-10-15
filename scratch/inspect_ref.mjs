import fs from "fs";
import { spawn } from "child_process";

const chromeCandidates = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
];
const chromePath = chromeCandidates.find((p) => fs.existsSync(p)) || chromeCandidates[0];
const tempDir = `${process.env.TEMP}\\chrome-inspect-${Date.now()}`;
const port = 9335;

console.log("Launching headless Chrome to inspect https://travelnextlvl.de/en ...");
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
    console.error("Failed to connect to Chrome CDP");
    chrome.kill();
    return;
  }

  const ws = new WebSocket(wsUrl);
  let idCounter = 1;
  const pending = new Map();
  const networkRequests = [];

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.method === "Network.requestWillBeSent") {
      networkRequests.push(msg.params.request.url);
    }
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  };

  await new Promise((r) => {
    ws.onopen = r;
  });

  const send = (method, params = {}) => {
    const id = idCounter++;
    return new Promise((resolve) => {
      pending.set(id, resolve);
      ws.send(JSON.stringify({ id, method, params }));
    });
  };

  const {
    result: { targetId },
  } = await send("Target.createTarget", { url: "about:blank" });
  const {
    result: { sessionId },
  } = await send("Target.attachToTarget", { targetId, flatten: true });

  const sendSession = (method, params = {}) => {
    const id = idCounter++;
    return new Promise((resolve) => {
      pending.set(id, resolve);
      ws.send(JSON.stringify({ id, sessionId, method, params }));
    });
  };

  await sendSession("Network.enable");
  await sendSession("Page.enable");
  await sendSession("Runtime.enable");

  console.log("Navigating to https://travelnextlvl.de/ ...");
  await sendSession("Page.navigate", { url: "https://travelnextlvl.de/" });

  console.log("Waiting 6 seconds for page and 3D assets to load...");
  await new Promise((r) => setTimeout(r, 6000));

  const evalRes = await sendSession("Runtime.evaluate", {
    expression: `(() => {
      const canvases = Array.from(document.querySelectorAll('canvas')).map(c => ({
        width: c.width,
        height: c.height,
        className: c.className,
        id: c.id
      }));
      const videos = Array.from(document.querySelectorAll('video')).map(v => ({
        src: v.src || v.currentSrc,
        className: v.className
      }));
      const hero = document.querySelector('section, header, main, [class*="hero"]');
      return {
        title: document.title,
        canvases,
        videos,
        bodyHtmlSnippet: document.body.innerHTML.slice(0, 3000)
      };
    })()`,
    returnByValue: true,
  });

  console.log("DOM Evaluation Title:", evalRes.result?.value?.title);
  console.log("Canvases:", evalRes.result?.value?.canvases);
  console.log("Videos:", evalRes.result?.value?.videos);

  // Capture screenshot of reference site
  const snap = await sendSession("Page.captureScreenshot", { format: "png" });
  if (snap.result?.data) {
    fs.writeFileSync("./scratch/travelnextlvl_ref.png", Buffer.from(snap.result.data, "base64"));
    console.log("Saved reference screenshot to ./scratch/travelnextlvl_ref.png");
  }

  // Filter interesting network assets (.glb, .gltf, images, mp4, etc.)
  const assets = networkRequests.filter((url) =>
    /\.(glb|gltf|bin|hdr|exr|png|jpg|jpeg|webp|mp4|webm)(\?.*)?$/i.test(url)
  );
  console.log(`Interesting Assets Found (${assets.length}):`);
  assets.forEach((a) => console.log("  Asset:", a));

  fs.writeFileSync("./scratch/network_assets.json", JSON.stringify(networkRequests, null, 2));

  ws.close();
  chrome.kill();
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch {}
}

run().catch((e) => {
  console.error("Error inspecting:", e);
  chrome.kill();
});
