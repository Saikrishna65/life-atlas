// Tests source routing with React in Chromium. No app bundle, APK or cloud calls.
import { build } from "esbuild";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import assert from "node:assert/strict";
const { chromium } = createRequire(import.meta.url)("playwright");
const source = `
import React from 'react';
import {createRoot} from 'react-dom/client';
import {installLaunchRoutes} from './mobile/launch-routes';
import {navigate,usePathname} from './mobile/navigation';
const launches=installLaunchRoutes(window);
window.firstAtlasRoute=location.pathname;
window.atlasSession=crypto.randomUUID();
function App(){const path=usePathname();return <main><h1>{path}</h1></main>;}
setTimeout(()=>{
 launches.ready(route=>navigate(route,true));
 createRoot(document.getElementById('root')).render(<App/>);
},40);
`;
const result = await build({stdin:{contents:source,loader:"tsx",resolveDir:process.cwd()},bundle:true,write:false,format:"iife",jsx:"automatic",define:{"process.env.NODE_ENV":'"production"'}});
const server = createServer((_req,res) => {
  res.setHeader("content-type", "text/html");
  res.end(`<div id="root"></div><script>${result.outputFiles[0].text.replaceAll("</script", "<\\/script")}</script>`);
});
await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
let browser;
try {
  browser = await chromium.launch({executablePath:"/usr/bin/chromium",args:["--no-sandbox"]});
  for (const name of ["finance", "music", "gallery"]) {
    const page = await browser.newPage({viewport:{width:390,height:844}});
    let documents = 0;
    const errors = [];
    page.on("pageerror",error=>errors.push(error.message));
    page.on("request",request=>{if(request.isNavigationRequest()) documents++;});
    await page.addInitScript(route=>{window.AtlasModuleLaunch={getInitialRoute:()=>route};},`/secret/${name}`);
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.getByRole("heading",{name:`/secret/${name}`,exact:true}).waitFor();
    assert.equal(await page.evaluate(()=>window.firstAtlasRoute),`/secret/${name}`);
    const session = await page.evaluate(()=>window.atlasSession);
    for (const next of ["music", "gallery", "finance"]) {
      await page.evaluate(route=>{
        window.__atlasPendingRoute=route;
        window.dispatchEvent(new CustomEvent("atlas:open-route",{detail:route}));
      },`/secret/${next}`);
      await page.getByRole("heading",{name:`/secret/${next}`,exact:true}).waitFor();
    }
    assert.equal(await page.evaluate(()=>window.atlasSession),session);
    assert.equal(await page.evaluate(()=>"__atlasPendingRoute" in window),false);
    assert.equal(documents,1,"Warm switching must not reload the document");
    assert.deepEqual(errors,[]);
    await page.close();
  }
  console.log("PASS: three cold icon handoffs before React; nine warm router switches; one document per session; no console errors (Chromium source fixture).");
} finally {
  if(browser) await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
