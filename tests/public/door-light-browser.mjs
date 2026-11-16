import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)('playwright');
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
await mkdir('work/qa-door-light',{recursive:true});
try {
 for(const {width,height} of [{width:1440,height:900},{width:390,height:844},{width:320,height:568},{width:900,height:600}]) {
  const page=await browser.newPage({viewport:{width,height}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://localhost:3008/#beyond',{waitUntil:'domcontentloaded',timeout:90000});
  const section=page.locator('#beyond.beyond-physical');await section.waitFor();
  for(const id of ['observatory','collected-moments','people','memories']) await page.evaluate(id=>window.dispatchEvent(new CustomEvent('world-chapter-request',{detail:id})),id);
  await page.locator('.archive-scroll').waitFor();await page.locator('.travel-scrapbook').waitFor();await page.locator('.people-moments').waitFor();
  await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(1700);
  await section.evaluate(el=>window.__lenis.scrollTo(scrollY+el.getBoundingClientRect().top-innerHeight*.6,{immediate:true,force:true}));
  await page.waitForTimeout(1300);
  assert.ok(await section.evaluate(el=>Number(el.dataset.closure)<.01),'Door remains open before the section reaches the midpoint');
  const states=[];
  for(const progress of [0,.25,.5,.75,1]) {
   await section.evaluate((el,p)=>{
    const abs=scrollY+el.getBoundingClientRect().top;
    const start=abs-innerHeight*.5,end=abs+el.offsetHeight-innerHeight;
    window.__lenis.scrollTo(start+(end-start)*p,{immediate:true,force:true});
   },progress);
   await page.waitForTimeout(1500);
   const state=await section.evaluate(el=>({closed:Number(el.dataset.closure),dark:Number(getComputedStyle(el.querySelector('.beyond-room-shadow')).opacity),light:Number(getComputedStyle(el).getPropertyValue('--beyond-light')),transform:el.querySelector('.door-leaf').style.transform,ink:getComputedStyle(el.querySelector('.kinetic-heading')).color}));
   states.push(state);
   assert.ok(Math.abs(state.closed-progress)<.04,JSON.stringify({progress,state}));
   assert.ok(Math.abs(state.dark+state.light-1)<.005);
   await page.screenshot({path:`work/qa-door-light/${width}-${progress}.png`});
  }
  assert.ok(states[0].dark<.02 && states[4].dark>.98);
  const framing=await section.locator('.beyond-stage').evaluate(el=>{const r=el.getBoundingClientRect();return {top:r.top,bottom:r.bottom,height:r.height,viewport:innerHeight};});
  assert.ok(Math.abs(framing.top)<2 && framing.bottom>=framing.viewport-1,JSON.stringify(framing));
  const controlsFit=await section.evaluate(el=>{const r=el.querySelector('.beyond-words > .world-link').getBoundingClientRect();return r.top>=0 && r.bottom<=innerHeight+1;});
  assert.ok(controlsFit,'Ending controls fit within the final viewport');
  assert.ok(await section.evaluate(el=>{const r=el.querySelector('.beyond-door').getBoundingClientRect();const text=el.querySelector('.beyond-words').getBoundingClientRect();return r.bottom<=text.top+8;}),'Door and text do not overlap');
  assert.ok(states[0].transform.includes('-72') || states[0].closed<.01);
  assert.notEqual(states[0].ink,states[4].ink);
  for(let i=1;i<states.length;i++) assert.ok(states[i].dark>states[i-1].dark,'Darkness increases progressively');
  assert.equal(await page.locator('.travel-scrapbook').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(238, 239, 236)','Other sections retain the paper background');
  await section.evaluate(el=>window.__lenis.scrollTo(scrollY+el.getBoundingClientRect().top-innerHeight*.5,{immediate:true,force:true}));
  await page.waitForTimeout(1500);assert.ok(await section.evaluate(el=>Number(getComputedStyle(el.querySelector('.beyond-room-shadow')).opacity)<.03),'Scrolling back restores daylight');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);
  console.log(`PASS ${width}: angle-linked light/shadow, 5 scroll samples, reverse scroll, local-only darkness, controls present, overflow, no page errors`);
  assert.equal(await section.getByRole('button',{name:'Start another journey'}).count(),1);
  await page.close();
 }
 const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});
 await page.goto('http://localhost:3008/#beyond',{waitUntil:'domcontentloaded',timeout:90000});const section=page.locator('#beyond.beyond-physical');await section.waitFor();
 assert.equal(await section.locator('.beyond-room-shadow').evaluate(el=>getComputedStyle(el).opacity),'0');
 assert.equal(await section.locator('.door-leaf').evaluate(el=>getComputedStyle(el).transform),'none');
 console.log('PASS reduced motion: static light ending and closed door');await page.close();
} finally {await browser.close();}
