import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
await mkdir('work/qa-photo-depth',{recursive:true});
const {chromium}=createRequire(import.meta.url)('playwright');
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
try{
 for(const width of [1440,390]){
  const page=await browser.newPage({viewport:{width,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://localhost:3008/#through-the-lens',{waitUntil:'domcontentloaded',timeout:90000});
  const section=page.locator('#through-the-lens:not(.photo-depth-loading)');await section.waitFor({timeout:30000});
  for(const id of ['observatory','collected-moments','people','memories','beyond']) await page.evaluate(id=>window.dispatchEvent(new CustomEvent('world-chapter-request',{detail:id})),id);
  await page.locator('.archive-scroll').waitFor();await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(5500);
  assert.equal(await page.locator('#living-world [data-chapter]').first().getAttribute('data-chapter'),'through-the-lens');
  assert.equal(await section.locator('.photo-depth-frame').count(),27);
  const transforms=[];
  for(const progress of [0,.25,.5,.75,1]){
   await section.evaluate((el,p)=>{window.__lenis.resize();window.__lenis.scrollTo(scrollY+el.getBoundingClientRect().top+(el.offsetHeight-innerHeight)*p,{immediate:true,force:true});},progress);
   await page.waitForTimeout(1800);
   const state=await section.evaluate(el=>({scroll:scrollY,top:el.getBoundingClientRect().top,height:el.offsetHeight,progress:Number(el.dataset.progress),stage:el.querySelector('.photo-depth-stage').getBoundingClientRect().top,transform:el.querySelector('.photo-depth-world').style.transform,visible:[...el.querySelectorAll('.photo-depth-frame')].filter(f=>getComputedStyle(f).visibility==='visible').length}));
   assert.ok(Math.abs(state.progress-progress)<.04,JSON.stringify({progress,state}));assert.ok(Math.abs(state.stage)<2);transforms.push(state.transform);
   await page.screenshot({path:`work/qa-photo-depth/${width}-${progress}.png`});
  }
  assert.notEqual(transforms[0],transforms[2]);
  const settled=section.locator('.photo-depth-frame').nth(13);await settled.click();
  const dialog=page.getByRole('dialog',{name:'Through the lens'});await dialog.waitFor();
  await page.waitForFunction(()=>{const image=document.querySelector('.photo-depth-original img');return image?.complete&&image.naturalWidth>0;},{},{timeout:45000});
  const before=await dialog.locator('img').getAttribute('src');await page.keyboard.press('ArrowRight');await page.waitForTimeout(400);assert.notEqual(before,await dialog.locator('img').getAttribute('src'));
  await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
  await section.evaluate(el=>window.__lenis.scrollTo(scrollY+el.getBoundingClientRect().top,{immediate:true,force:true}));await page.waitForTimeout(1800);
  assert.ok(await section.evaluate(el=>Number(el.dataset.progress)<.03));
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  const images=await section.locator('img').evaluateAll(images=>images.filter(i=>i.complete&&i.naturalWidth===0).map(i=>i.src));assert.deepEqual(images,[]);
  assert.deepEqual(errors,[]);
  console.log(`PASS ${width}: placement, 27 depth planes, 5 scroll samples, pinned viewport, reverse, modal, keyboard, images, overflow and console`);await page.close();
 }
 const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});await page.goto('http://localhost:3008/#through-the-lens',{waitUntil:'domcontentloaded'});
 const section=page.locator('#through-the-lens:not(.photo-depth-loading)');await section.waitFor();
 assert.equal(await section.locator('.photo-depth-stage').evaluate(el=>getComputedStyle(el).position),'relative');
 assert.equal(await section.locator('.photo-depth-frame').first().evaluate(el=>getComputedStyle(el).transform),'none');
 assert.equal(await section.locator('.photo-depth-frame[data-repeat="true"]').first().evaluate(el=>getComputedStyle(el).display),'none');
 await section.locator('.photo-depth-frame').first().click();await page.getByRole('dialog',{name:'Through the lens'}).waitFor();await page.keyboard.press('Escape');
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));console.log('PASS reduced motion: static, deduplicated gallery and keyboard-dismissable viewer');
}finally{await browser.close();}
