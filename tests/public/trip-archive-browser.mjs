import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)('playwright');
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
await mkdir('work/qa-trip-archive',{recursive:true});
try {
 for(const profile of [{width:1440,height:900,reducedMotion:'no-preference'},{width:390,height:844,reducedMotion:'no-preference'},{width:320,height:700,reducedMotion:'reduce'}]) {
  const page=await browser.newPage({viewport:profile,reducedMotion:profile.reducedMotion});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://localhost:3008/#memories');
  const archive=page.locator('.trip-archive-reel');await archive.waitFor();
  await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(1300);
  await archive.locator('.archive-scroll').evaluate(el=>window.__lenis.scrollTo(scrollY+el.getBoundingClientRect().top,{immediate:true,force:true}));
  await page.waitForTimeout(1200);
  assert.equal(await archive.evaluate(el=>el.closest('.world-deferred').previousElementSibling.dataset.chapter),'people');
  assert.equal(await archive.locator('.memory-wall,.memory-salon,.archive-stamp').count(),0);
  assert.equal(await archive.locator('.archive-reel-panel').count(),9);
  const active=()=>archive.locator('.archive-reel-panel[aria-hidden="false"]');
  const firstHref=await active().getAttribute('href');assert.equal(firstHref,'/trips/himalayan-journey');
  if(profile.reducedMotion!=='reduce') {
   const planes=await archive.locator('.archive-reel-panel').evaluateAll(panels=>panels.map(el=>getComputedStyle(el).transform));
   assert.ok(planes.some(matrix=>matrix.startsWith('matrix3d')),'Folded covers use real perspective transforms');
   assert.ok(await archive.locator('.archive-reel-panel').evaluateAll(panels=>panels.every(el=>getComputedStyle(el).backfaceVisibility==='visible')),'Both sides of folded planes render');
  } else assert.equal(await archive.locator('.archive-stage').evaluate(el=>getComputedStyle(el).position),'relative');
  await archive.getByRole('button',{name:'Next archive journey',exact:true}).click();
  await page.waitForTimeout(1900);
  assert.notEqual(await active().getAttribute('href'),firstHref);
  await archive.getByRole('button',{name:'Previous archive journey',exact:true}).click();
  await page.waitForTimeout(1900);assert.equal(await active().getAttribute('href'),firstHref);
  await archive.getByRole('button',{name:'Next archive journey',exact:true}).focus();
  await page.keyboard.press('ArrowRight');await page.waitForTimeout(1900);
  assert.notEqual(await active().getAttribute('href'),firstHref,'Keyboard advances the reel');
  await archive.locator('.archive-stage').screenshot({path:`work/qa-trip-archive/reel-${profile.width}.png`});
  if(profile.width===1440) {
   const beforeScroll=await active().getAttribute('href');
   await archive.locator('.archive-scroll').evaluate(el=>window.__lenis.scrollTo(scrollY+el.getBoundingClientRect().top+(el.offsetHeight-innerHeight)*.5,{immediate:true,force:true}));
   await page.waitForTimeout(1200);
   assert.notEqual(await active().getAttribute('href'),beforeScroll,'Normal page scroll turns the reel');
   await archive.locator('.archive-stage').screenshot({path:'work/qa-trip-archive/reel-middle.png'});
  }
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await archive.getByRole('button',{name:'Find a journey',exact:true}).click();
  const dialog=page.getByRole('dialog');await dialog.waitFor();
  await dialog.getByRole('searchbox',{name:'Search trips'}).fill('Kyoto');
  assert.ok(await dialog.locator('.archive-finder-results a').count()>0);
  assert.ok((await dialog.locator('.archive-finder-results a').allInnerTexts()).every(text=>/Kyoto/i.test(text)));
  await dialog.getByRole('searchbox',{name:'Search trips'}).fill('nonexistent-place-489');
  assert.equal(await dialog.locator('.archive-finder-results a').count(),0);
  await dialog.getByRole('button',{name:'Clear filters'}).click();
  await dialog.getByRole('combobox',{name:'Filter trips by destination'}).selectOption('Japan');
  assert.ok((await dialog.locator('.archive-finder-results a').allInnerTexts()).every(text=>/Tokyo|Kyoto|Fuji|Osaka/i.test(text)));
  await dialog.getByRole('combobox',{name:'Filter trips by destination'}).selectOption('All places');
  await dialog.getByRole('combobox',{name:'Sort trips'}).selectOption('A–Z');
  const titles=await dialog.locator('.archive-finder-results strong').allTextContents();
  assert.deepEqual(titles,[...titles].sort((a,b)=>a.localeCompare(b)));
  await dialog.getByRole('button',{name:'Unfold more journeys'}).click();
  assert.equal(await dialog.locator('.archive-finder-results a').count(),18);
  assert.equal(await archive.locator('.archive-reel-panel').count(),18);
  await page.keyboard.press('Escape');assert.equal(await page.getByRole('dialog').count(),0);
  assert.ok(await archive.getByRole('button',{name:'Find a journey'}).evaluate(el=>el===document.activeElement));
  if(profile.width===1440) {
   const href=await archive.locator('.archive-caption a').getAttribute('href');
   await archive.locator('.archive-caption a').click();
   await page.waitForURL(`**${href}`);
   await page.locator('.trip-detail-v3:visible').waitFor();
  }
  assert.deepEqual(errors,[]);
  console.log(`PASS ${profile.width}: perspective reel, controls, keyboard, reduced-motion, search/filter/sort/empty/reset, expand, modal focus, overflow and no page errors`);
  await page.close();
 }
} finally {await browser.close();}
