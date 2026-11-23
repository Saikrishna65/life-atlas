import { build } from "esbuild";
import { createRequire } from "node:module";
import { createServer } from "node:http";
import assert from "node:assert/strict";
const { chromium } = createRequire(import.meta.url)("playwright");
const fixture = `localStorage.setItem('life_atlas_guardian_pin','synthetic-retired-pin');window.policy={app:false,gallery:false,privateSections:false,cloudCredentials:false,publishing:false,deletion:false,backups:false,aiActions:false};window.prompts=0;window.verified=false;window.cancel=false;window.mounts=0;window.security={getPolicy:async()=>structuredClone(policy),setPolicy:async({policy:next})=>{if((Object.values(policy).some(Boolean)||Object.values(next).some(Boolean))&&!verified){prompts++;if(window.cancel)throw Error('AUTHENTICATION_CANCELLED');verified=true;}policy=next;return structuredClone(policy);},authorize:async({scope})=>{if((policy.app||policy[scope])&&!verified){prompts++;if(window.cancel)throw Error('AUTHENTICATION_CANCELLED');verified=true;}},lock:async()=>{verified=false}};`;
const entry = `import React,{useEffect}from'react';import{createRoot}from'react-dom/client';import Guard from './src/components/secret/SecretAppGuard';import Settings from './src/components/control-room/AuthenticationSettings';function Content(){useEffect(()=>{window.mounts++},[]);return <><h1>Private content</h1><Settings/></>}createRoot(document.getElementById('root')).render(<Guard><Content/></Guard>);`;
const bundle = await build({
  stdin: { contents: entry, resolveDir: process.cwd(), loader: "tsx" },
  bundle: true,
  write: false,
  format: "iife",
  jsx: "automatic",
  plugins: [
    {
      name: "security-fixtures",
      setup(b) {
        b.onResolve(
          { filter: /^(@capacitor\/core|next\/navigation)$/ },
          (args) => ({ path: args.path, namespace: "fixture" }),
        );
        b.onLoad({ filter: /.*/, namespace: "fixture" }, (args) => ({
          contents:
            args.path === "@capacitor/core"
              ? `export const Capacitor={isNativePlatform:()=>true,isPluginAvailable:name=>name==='AtlasSecurity'};export const registerPlugin=()=>window.security;`
              : `import{useSyncExternalStore}from'react';const sub=fn=>{addEventListener('popstate',fn);return()=>removeEventListener('popstate',fn)};export const usePathname=()=>useSyncExternalStore(sub,()=>location.pathname);`,
          loader: "js",
          resolveDir: process.cwd(),
        }));
      },
    },
  ],
});
const server = createServer((req, res) => {
  res.setHeader("content-type", "text/html");
  res.end(
    `<meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script>${fixture}</script><script>${bundle.outputFiles[0].text.replaceAll("</script", "<\\/script")}</script>`,
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
  await page.goto(
    `http://127.0.0.1:${server.address().port}/secret/control-room`,
  );
  await page.getByRole("heading", { name: "Private content" }).waitFor();
  assert.equal(
    await page.evaluate(() => localStorage.getItem("life_atlas_guardian_pin")),
    null,
    "The retired plaintext PIN is removed",
  );
  const options = page.locator("input[type=checkbox]");
  assert.equal(await options.count(), 8);
  assert.equal(await page.locator("input[type=checkbox]:checked").count(), 0);
  assert.equal(await page.evaluate(() => prompts), 0);
  await page.evaluate(() => {
    history.pushState({}, "", "/secret/gallery");
    dispatchEvent(new PopStateEvent("popstate"));
  });
  await page.waitForTimeout(100);
  assert.equal(
    await page.evaluate(() => mounts),
    1,
    "Default navigation retains the mounted workspace",
  );
  assert.equal(await page.evaluate(() => prompts), 0);
  await page
    .getByRole("checkbox", { name: "Deleting files", exact: true })
    .check();
  await page.waitForFunction(() => policy.deletion);
  await page
    .getByRole("checkbox", { name: "Deleting files", exact: true })
    .waitFor();
  assert.equal(await page.evaluate(() => prompts), 1);
  await page.evaluate(() => {
    window.cancel = true;
    window.verified = false;
  });
  await page
    .getByRole("checkbox", { name: "Publishing to the website", exact: true })
    .click();
  await page.getByRole("alert").waitFor();
  assert.equal(await page.evaluate(() => policy.publishing), false);
  await page.evaluate(() => {
    window.cancel = false;
  });
  await page
    .getByRole("checkbox", {
      name: "Gallery and private cloud library",
      exact: true,
    })
    .check();
  await page.waitForFunction(() => policy.gallery);
  await page.getByRole("heading", { name: "Private content" }).waitFor();
  await page.evaluate(() => {
    window.verified = false;
    window.cancel = true;
    history.pushState({}, "", "/secret/control-room");
    dispatchEvent(new PopStateEvent("popstate"));
  });
  await page.waitForTimeout(50);
  await page.evaluate(() => {
    history.pushState({}, "", "/secret/gallery/library");
    dispatchEvent(new PopStateEvent("popstate"));
  });
  await page.getByRole("button", { name: "Unlock with my device" }).waitFor();
  assert.equal(
    await page.getByRole("heading", { name: "Private content" }).count(),
    0,
    "Cancelled optional protection does not reveal content",
  );
  await page.evaluate(() => {
    window.cancel = false;
  });
  await page.getByRole("button", { name: "Unlock with my device" }).click();
  await page.getByRole("heading", { name: "Private content" }).waitFor();
  assert.deepEqual(errors, []);
  console.log(
    "PASS: eight default-off settings; prompt-free default navigation without remount; verified policy updates; cancellation preserves settings; protected Gallery gate and retry. Native calls are fixtures.",
  );
} finally {
  if (browser) await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
