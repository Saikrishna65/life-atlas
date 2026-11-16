import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)('playwright');
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
await mkdir('work/qa-people',{recursive:true});
try {
 for(const profile of [{width:1440,height:900,reducedMotion:'no-preference'},{width:390,height:844,reducedMotion:'no-preference'},{width:320,height:568,reducedMotion:'reduce'}]) {
  const page=await browser.newPage({viewport:profile,reducedMotion:profile.reducedMotion});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://localhost:3008/#people');
  const section=page.locator('#people.people-moments');await section.waitFor();
  await page.evaluate(()=>document.fonts.ready);
  assert.equal(await section.locator('.people-print').count(),8);
  assert.match(await section.innerText(),/SAMPLE STOCK PHOTOGRAPHY/);
  const previous=await section.evaluate(el=>el.closest('.world-deferred').previousElementSibling.dataset.chapter);
  assert.equal(previous,'collected-moments');
  const next=await section.evaluate(el=>el.closest('.world-deferred').nextElementSibling.dataset.chapter);
  assert.equal(next,'memories');
  assert.equal((await section.locator('.people-print').allInnerTexts()).join(''),'');
  const route=section.locator('.people-route path');
  assert.equal(await route.count(),1);
  const initialOffset=await route.evaluate(el=>parseFloat(getComputedStyle(el).strokeDashoffset));
  for(const img of await section.locator('.people-print img').all()) {
   await img.scrollIntoViewIfNeeded();
   await img.evaluate(el=>el.complete&&el.naturalWidth?Promise.resolve():new Promise((resolve,reject)=>{el.onload=resolve;el.onerror=reject;}));
  }
  await page.waitForTimeout(1200);
  if(profile.reducedMotion!=='reduce') {
    const afterOffset=await route.evaluate(el=>parseFloat(getComputedStyle(el).strokeDashoffset));
    assert.ok(afterOffset<initialOffset,'Background line draws with scroll');
  }
  if(profile.width<=800) assert.ok(await section.locator('.people-float').evaluateAll(frames=>frames.every(el=>getComputedStyle(el).transform==='none')));
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await section.locator('.people-heading').scrollIntoViewIfNeeded();
  await page.waitForTimeout(1200);
  await section.screenshot({path:`work/qa-people/section-${profile.width}.png`});
  const first=section.locator('.people-print').first();await first.click();
  const dialog=page.getByRole('dialog');await dialog.waitFor();
  assert.match(await dialog.innerText(),/Real stock photography/);
  await page.getByRole('button',{name:'Next people photo'}).click();
  assert.match(await dialog.innerText(),/2 \/ 8/);
  await page.keyboard.press('ArrowLeft');assert.match(await dialog.innerText(),/1 \/ 8/);
  await page.keyboard.press('ArrowLeft');assert.match(await dialog.innerText(),/8 \/ 8/);
  await dialog.screenshot({path:`work/qa-people/viewer-${profile.width}.png`});
  await page.keyboard.press('Escape');assert.equal(await page.getByRole('dialog').count(),0);
  assert.ok(await first.evaluate(el=>el===document.activeElement));
  assert.deepEqual(errors,[]);
  console.log(`PASS ${profile.width}: section order, 8 local photos, mobile/reduced motion, viewer, keyboard, focus, disclosure, overflow, no page errors`);
  await page.close();
 }
} finally {await browser.close();}
