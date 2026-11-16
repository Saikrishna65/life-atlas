import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)('playwright');
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
await mkdir('work/qa-public-paper',{recursive:true});
try {
 for(const width of [1440,390]) {
  const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://localhost:3008/#collected-moments');
  for(const id of ['observatory','collected-moments','people','memories','beyond']) await page.evaluate(id=>window.dispatchEvent(new CustomEvent('world-chapter-request',{detail:id})),id);
  for(const selector of ['.observatory-v2','.travel-scrapbook','.people-moments','.trip-archive-reel','.world-beyond']) {
   const section=page.locator(selector);await section.waitFor();
   assert.equal(await section.evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(238, 239, 236)',`${selector} shares the archive canvas`);
   await section.evaluate(el=>window.__lenis.scrollTo(scrollY+el.getBoundingClientRect().top,{immediate:true,force:true}));
   await page.waitForTimeout(300);
   await page.screenshot({path:`work/qa-public-paper/${selector.slice(1)}-${width}.png`});
   if(selector==='.world-beyond') assert.ok(await section.evaluate(el=>el.querySelector('.beyond-words > .world-link').getBoundingClientRect().bottom<=el.getBoundingClientRect().bottom+2),'Closing controls remain inside their section');
  }
  assert.equal(await page.locator('.world-section-bar,.observatory-topline').count(),0);
  const contrast=await page.evaluate(()=>{
   const linear=value=>{const c=value/255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4;};
   const lum=rgb=>rgb.slice(0,3).map(linear).reduce((sum,c,i)=>sum+c*[.2126,.7152,.0722][i],0);
   const paper=lum([238,239,236]);
   return ['.observatory-heading .kinetic-heading','.scrapbook-title','.people-heading h2','.beyond-words .kinetic-heading','.people-heading p','.scrapbook-heading p'].map(selector=>{
    const color=getComputedStyle(document.querySelector(selector)).color;
    const rgb=color.match(/[\d.]+/g).map(Number).map(value=>color.startsWith('color(srgb')?value*255:value);
    const ink=lum(rgb);return {selector,ratio:(Math.max(paper,ink)+.05)/(Math.min(paper,ink)+.05)};
   });
  });
  assert.ok(contrast.every(item=>item.ratio>=4.5),JSON.stringify(contrast));
  assert.equal(await page.getByText('The last mile brings you home.',{exact:true}).count(),0);
  assert.equal(await page.locator('.people-heading p').evaluate(el=>getComputedStyle(el).color),'rgb(83, 102, 90)');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.goto('http://localhost:3008/photography');
  await page.locator('.public-page').waitFor();
  assert.equal(await page.locator('.public-page').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(238, 239, 236)');
  assert.equal(await page.locator('.world-section-bar').count(),0);
  await page.goto('http://localhost:3008/trips/himalayan-journey');
  const detail=page.locator('.trip-detail-v3:visible');await detail.waitFor();
  for(const selector of ['.td-itinerary','.td-journal','.td-ending']) assert.equal(await detail.locator(selector).evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(238, 239, 236)');
  assert.equal(await detail.locator('.td-cover').evaluate(el=>getComputedStyle(el).color),'rgb(255, 255, 255)','Cover retains white text over imagery');
  assert.equal(await detail.locator('.td-cover video').count(),1);
  assert.deepEqual(errors,[]);
  console.log(`PASS ${width}: public paper backgrounds, readable ink, section bars removed, collection pages, trip sections, cover preserved, overflow and no page errors`);
  await page.close();
 }
} finally {await browser.close();}
