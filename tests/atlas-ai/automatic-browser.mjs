// Component test only: no APK/mobile/production build and no real cloud/native calls.
import { build } from "esbuild";
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
const { chromium } = createRequire(import.meta.url)("playwright");
const fixture = `window.record={revision:0};window.calls={open:0,save:0};window.appEvents={};window.player={pause:()=>{}};window.security={openAssistant:async()=>{calls.open++;return structuredClone(record)},saveAssistant:async input=>{if(input.revision!==record.revision)throw Error('ASSISTANT_CHANGED');calls.save++;record={revision:record.revision+1,data:structuredClone(input.data)};return structuredClone(record)}};`;
const mocks = {
  "@capacitor/core": `export const Capacitor={isNativePlatform:()=>true,getPlatform:()=>"web",isPluginAvailable:name=>name==='AtlasSecurity'};export const CapacitorHttp={request:async()=>{throw Error('Unexpected network')}};export class WebPlugin{};export class CapacitorException extends Error{};export const registerPlugin=()=>window.security;`,
  "@capacitor/app": `export const App={addListener:async(name,callback)=>{window.appEvents[name]=callback;return{remove:async()=>{delete window.appEvents[name]}}}};`,
  "next/navigation": `const router={push:()=>{},back:()=>{},replace:()=>{}};export const useRouter=()=>router;`,
  "@/lib/music/MusicPlayerContext": `export const useMusicPlayer=()=>window.player;`,
  "@/components/secret/ModelManager": `export default function ModelManager(){return null;}`,
};
const bundle = await build({
  stdin: {
    contents: `import React from'react';import{createRoot}from'react-dom/client';import Page from './src/app/secret/atlas/page';createRoot(document.getElementById('root')).render(<Page/>);`,
    resolveDir: process.cwd(),
    loader: "tsx",
  },
  bundle: true,
  write: false,
  outdir: "work/qa-auth-ai",
  format: "iife",
  jsx: "automatic",
  plugins: [
    {
      name: "assistant-fixture",
      setup(b) {
        b.onResolve({ filter: /.*/ }, (args) =>
          mocks[args.path]
            ? { path: args.path, namespace: "fixture" }
            : undefined,
        );
        b.onLoad({ filter: /.*/, namespace: "fixture" }, (args) => ({
          contents: mocks[args.path],
          loader: "tsx",
          resolveDir: process.cwd(),
        }));
        b.onLoad({ filter: /\.module\.css$/ }, (args) => ({
          contents: readFileSync(args.path, "utf8"),
          loader: "local-css",
        }));
      },
    },
  ],
});
const js = bundle.outputFiles.find((file) => file.path.endsWith(".js")).text,
  css =
    bundle.outputFiles.find((file) => file.path.endsWith(".css"))?.text || "";
const server = createServer((req, res) => {
  res.setHeader("content-type", "text/html");
  res.end(
    `<meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><div id="root"></div><script>${fixture}</script><script>${js.replaceAll("</script", "<\\/script")}</script>`,
  );
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
let browser;
try {
  browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } }),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/secret/atlas`);
  await page
    .getByRole("button", { name: "New conversation", exact: true })
    .waitFor();
  assert.equal(await page.locator("input[type=password]").count(), 0);
  await page
    .getByRole("button", { name: "New conversation", exact: true })
    .click();
  await page
    .getByLabel("Message to Atlas")
    .fill("Synthetic private note without a phrase");
  await page.getByRole("button", { name: "Save message", exact: true }).click();
  await page
    .getByRole("log")
    .getByText("Synthetic private note without a phrase", { exact: true })
    .waitFor();
  await page.evaluate(() => appEvents.appStateChange({ isActive: false }));
  await page.getByText("Opening conversations…", { exact: true }).waitFor();
  assert.equal(await page.getByRole("log").count(), 0);
  await page.evaluate(() => appEvents.appStateChange({ isActive: true }));
  await page
    .getByRole("log")
    .getByText("Synthetic private note without a phrase", { exact: true })
    .waitFor();
  assert.equal(await page.locator("input[type=password]").count(), 0);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: automatic assistant opening, conversation save and automatic foreground reopen without any password field; native storage calls use fixtures.",
  );
} finally {
  if (browser) await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
