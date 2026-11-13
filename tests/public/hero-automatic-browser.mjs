import { createRequire } from "node:module";
import { readFile, mkdir } from "node:fs/promises";
import assert from "node:assert/strict";
const { chromium } = createRequire(import.meta.url)("playwright");
const browser = await chromium.launch({ executablePath:"/usr/bin/chromium", args:["--no-sandbox", "--enable-unsafe-swiftshader"] });
await mkdir("work/qa-hero-auto", {recursive:true});
const errors=[];
try {
 const page=await browser.newPage({viewport:{width:1920,height:1080}}); page.on("pageerror", e=>errors.push(e.message));
 const requests=[];
 await page.route("https://videos.pexels.com/**", async route=>{
  requests.push(route.request().url());
  await route.fulfill({contentType:"video/mp4",body:await readFile(`public/films/hero/${route.request().url().includes("40202545") ? "coast" : "highlands"}.mp4`)});
 });
 await page.goto("http://localhost:3008", {waitUntil:"domcontentloaded"});
 await page.waitForFunction(()=>document.querySelector('video[data-film-index="0"]')?.currentTime>1.7);
 const next=page.locator('video[data-film-index="1"]');
 await page.waitForFunction(()=>document.querySelector('video[data-film-index="1"]')?.readyState>=3);
 assert.ok(await next.evaluate(v=>v.paused && v.currentTime===0));
 assert.equal(await page.locator('.trip-film-selectors button').first().getAttribute('aria-pressed'),'true');
 const preloaded=requests.some(url=>url.includes("40202545")); assert.ok(preloaded);
 // Normal playback takes over after a seek near the automatic threshold. No selector click.
 await page.locator('video[data-film-index="0"]').evaluate(v=>{v.currentTime=7.95;});
 await page.waitForFunction(()=>document.querySelector('video[data-film-index="1"]')?.dataset.showing==='true');
 await page.waitForTimeout(450);
 const outgoing=page.locator('video[data-film-index="0"]');
 assert.ok(await outgoing.evaluate(v=>!v.paused && !v.ended && v.currentTime<v.duration));
 assert.ok(await next.evaluate(v=>!v.paused && v.currentTime>0));
 const opacity=await next.evaluate(v=>Number(getComputedStyle(v).opacity)); assert.ok(opacity>0 && opacity<1, `opacity ${opacity}`);
 await page.waitForTimeout(1150);
 await page.getByRole('button',{name:'Pause trip films',exact:true}).click();
 assert.equal(await outgoing.getAttribute('src'),null);
 const material=await page.locator('.trip-film-navigation > div').first().evaluate(el=>({background:getComputedStyle(el).backgroundColor,blur:getComputedStyle(el).backdropFilter}));
 assert.equal(material.blur,'blur(2px)');
 for(const selector of ['.trip-film-round','.trip-film-aside-label','.trip-film-journal-tile','.trip-film-photo-tile','.trip-film-world-link','.trip-film-cta > span','.trip-film-cta > svg']){
   assert.equal(await page.locator(selector).first().evaluate(el=>getComputedStyle(el).backgroundColor),material.background,selector);
 }
 assert.equal(await page.getByRole('link',{name:'Photo Gallery',exact:true}).getAttribute('href'),'/photography');
 assert.equal(await page.getByRole('link',{name:'Explore the Globe',exact:true}).getAttribute('href'),'/#observatory');
 const latest=await page.locator('.trip-film-world-link').getAttribute('href');
 assert.match(latest,/^\/trips\//);
 const firstTitle=(await page.locator('.trip-film-selectors button').first().getAttribute('aria-label')).replace('Show trip 1: ','');
 assert.ok((await page.locator('.trip-film-world-link').innerText()).includes(firstTitle));
 assert.ok(await page.locator('.trip-film-main h1').evaluate(el=>getComputedStyle(el).fontFamily.toLowerCase().includes('jakarta')));
 await page.screenshot({path:'work/qa-hero-auto/desktop.png'});
 await page.locator('.trip-film-discover').screenshot({path:'work/qa-hero-auto/cards.png'});
 await page.getByRole('link',{name:'Explore the Globe',exact:true}).click();
 await page.waitForFunction(()=>!!document.querySelector('#observatory .observatory-heading'));
 const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});mobile.on('pageerror',e=>errors.push(e.message));
 await mobile.route('https://videos.pexels.com/**',route=>route.abort());
 await mobile.goto('http://localhost:3008',{waitUntil:'networkidle'});
 assert.ok(await mobile.locator('video[data-showing="true"]').evaluate(v=>v.paused));
 assert.ok(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await mobile.screenshot({path:'work/qa-hero-auto/mobile.png'});
 assert.deepEqual(errors,[]);
 console.log('PASS automatic next-video preload while paused, automatic overlapping playback before clip end, measured dissolve, source release, 2px navbar blur, matching card/button materials, gallery/globe/latest-trip links, Jakarta typography, mobile/reduced motion and no browser exceptions. Stock responses used local video fixtures.');
} finally {await browser.close();}
