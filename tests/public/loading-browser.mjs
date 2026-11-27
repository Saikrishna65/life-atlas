import {createRequire} from 'node:module';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const tile='<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><path fill="#e5e9e1" d="M0 0h256v256H0z"/><path stroke="#ccd6c9" d="M0 128h256M128 0v256"/></svg>';
const {chromium}=createRequire(import.meta.url)('playwright');
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--enable-unsafe-swiftshader']});
await mkdir('work/qa-public-loading',{recursive:true});
const measurements=[];
const ready=async(page,path)=>{
 await page.waitForFunction(path=>document.documentElement.dataset.publicReady===path&&!document.querySelector('.public-page-loader'),path,{timeout:90000});
 assert.equal(await page.locator('main').first().evaluate(el=>el.inert),false);
 assert.equal(await page.evaluate(()=>window.__lenis?.isStopped),false);
 assert.equal(await page.locator('main [data-public-ready="pending"]').evaluateAll(nodes=>nodes.filter(node=>{for(let p=node.parentElement;p&&p.tagName!=='MAIN';p=p.parentElement)if(p.hidden||p.style.display==='none')return false;return true;}).length),0);
};
const fixture=async page=>{
 await page.route('https://videos.pexels.com/**',async route=>route.fulfill({body:await readFile('public/films/hero/highlands.mp4'),contentType:'video/mp4'}));
 await page.route('https://*.tile.openstreetmap.org/**',route=>route.fulfill({body:tile,contentType:'image/svg+xml'}));
 await page.route('https://tile.openstreetmap.org/**',route=>route.fulfill({body:tile,contentType:'image/svg+xml'}));
};
try{
 for(const width of [1440,390]){
  const page=await browser.newPage({viewport:{width,height:900}});const errors=[];page.on('pageerror',e=>errors.push(`${e.message} at ${page.url()}`));await fixture(page);
  let releaseNavigation;const navigationGate=new Promise(resolve=>releaseNavigation=resolve);
  if(width===1440)await page.route('**/trips/**',async route=>{if(route.request().url().includes('_rsc='))await navigationGate;await route.continue();});
  let release;const gate=new Promise(resolve=>release=resolve);let held=false;
  await page.route('**/_next/image?*',async route=>{
   if(decodeURIComponent(route.request().url()).includes('/images/people/stock-creator.webp')){held=true;await gate;}
   await route.continue();
  });
  const started=Date.now();await page.goto('http://localhost:3008/',{waitUntil:'domcontentloaded',timeout:90000});
  await page.getByRole('status',{name:'Preparing Atlas'}).waitFor();
  await page.waitForTimeout(width===1440?Math.max(0,19500-(Date.now()-started)):5000);
  assert.equal(held,true,'Below-fold photo was requested before scrolling');
  assert.equal(await page.locator('.public-page-loader').count(),1,'Loader never exits while a real asset is pending');
  assert.equal(await page.locator('main').first().evaluate(el=>el.inert),true);
  assert.equal(await page.locator('.trip-film-stage video').first().evaluate(el=>el.paused),true,'Hero waits behind the loader');
  if(width===1440){await page.getByRole('button',{name:'Open available content',exact:true}).waitFor();await page.screenshot({path:'work/qa-public-loading/stalled.png'});await page.setViewportSize({width:844,height:390});await page.waitForTimeout(500);assert.ok(await page.getByRole('button',{name:'Open available content',exact:true}).evaluate(el=>el.getBoundingClientRect().bottom<=innerHeight),'Recovery controls fit landscape');await page.screenshot({path:'work/qa-public-loading/landscape.png'});await page.setViewportSize({width,height:900});await page.waitForTimeout(500);}
  release();await ready(page,'/');
  assert.equal(await page.locator('.world-loading').count(),0);
  assert.equal(await page.evaluate(()=>{const ready=performance.getEntriesByName('atlas:ready:/').at(-1).startTime;return performance.getEntriesByType('resource').filter(r=>r.name.includes('_rsc=')&&r.startTime<ready).length;}),0,'Destination prefetches wait for the current page to finish');
  assert.equal(await page.locator('#globe-section').getAttribute('data-public-ready'),'ready');
  assert.ok(await page.locator('main img').evaluateAll(images=>images.every(image=>image.complete&&image.naturalWidth>0)));
  assert.ok(await page.locator('main video[src]').evaluateAll(videos=>videos.every(video=>video.readyState>=2)));
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:`work/qa-public-loading/home-${width}.png`});
  measurements.push(await page.evaluate(()=>({path:location.pathname,width:innerWidth,readyAt:performance.getEntriesByName('atlas:ready:/').at(-1)?.startTime,jsBytes:performance.getEntriesByType('resource').filter(r=>r.initiatorType==='script').reduce((sum,r)=>sum+r.encodedBodySize,0),images:document.querySelectorAll('main img').length,globeReady:!!window.__globeReady})));
  if(width===1440){
   await page.evaluate(()=>{const hidden=document.createElement('div');hidden.style.display='none';hidden.dataset.testInactive='true';hidden.innerHTML='<span data-public-ready="pending"></span><img loading="lazy" src="/never-load-hidden.jpg" alt="Retained page" />';document.querySelector('main').append(hidden);});
   await page.locator('#memories').evaluate(el=>window.__lenis.scrollTo(scrollY+el.getBoundingClientRect().top,{immediate:true,force:true}));await page.waitForTimeout(1200);
   await page.getByRole('button',{name:'Find a journey',exact:true}).click();
   await page.getByRole('dialog',{name:'Find a journey'}).getByRole('link').first().click();
   await page.waitForTimeout(500);assert.equal(await page.locator('dialog[open]').count(),0,'Dialog closes before route streaming');
   assert.equal(await page.locator('.public-page-loader').count(),1,'Loader covers a pending dialog navigation');
   releaseNavigation();await page.waitForURL('**/trips/himalayan-journey');await ready(page,'/trips/himalayan-journey');
   await page.evaluate(()=>document.querySelector('[data-test-inactive]')?.remove());
  }
  await page.goto('http://localhost:3008/trips',{waitUntil:'domcontentloaded'});await ready(page,'/trips');
  await page.locator('main a[href="/trips/himalayan-journey"]').first().click();
  await page.waitForURL('**/trips/himalayan-journey');await ready(page,'/trips/himalayan-journey');
  assert.equal(await page.locator('.geographic-route').getAttribute('data-public-ready'),'ready');
  assert.equal(await page.locator('.td-auto-film').first().evaluate(el=>el.readyState>=2),true);
  await page.getByRole('button',{name:'Follow the journey',exact:true}).click();await page.waitForTimeout(1300);
  assert.equal(await page.locator('.public-page-loader').count(),0,'Same-page section navigation does not reload the page');
  await page.goBack();await ready(page,'/trips');
  assert.deepEqual(errors,[]);console.log(`PASS ${width}: blocked-photo gate, no early timeout, full chapter preparation, fonts/media/globe readiness, first-frame playback, trip navigation/map, same-page links, back, overflow and no page errors`);
  await page.close();
 }
 const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});await fixture(page);
 await page.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return /webgl/.test(type)?null:original.call(this,type,...args);};});
 await page.goto('http://localhost:3008/',{waitUntil:'domcontentloaded'});await ready(page,'/');
 assert.equal(await page.locator('#globe-section').getAttribute('data-public-ready'),'error');
 assert.equal(await page.evaluate(()=>document.documentElement.dataset.publicReadyMode),'degraded');
 assert.ok(await page.locator('.trip-film-stage video').evaluateAll(videos=>videos.every(video=>video.paused)));
 console.log('PASS reduced motion + WebGL failure: page opens with the accessible fallback and paused films');await page.close();
 const unavailable=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});await fixture(unavailable);
 await unavailable.route('**/_next/image?*',async route=>decodeURIComponent(route.request().url()).includes('stock-creator.webp')?route.abort():route.continue());
 await unavailable.goto('http://localhost:3008/',{waitUntil:'domcontentloaded'});await ready(unavailable,'/');
 assert.equal(await unavailable.evaluate(()=>document.documentElement.dataset.publicReadyMode),'degraded');
 console.log('PASS failed image: unavailable media settles without an infinite loader and reports degraded readiness');await unavailable.close();
 const partial=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});await fixture(partial);
 let releasePartial;const pending=new Promise(resolve=>releasePartial=resolve);
 await partial.route('**/_next/image?*',async route=>{if(decodeURIComponent(route.request().url()).includes('stock-creator.webp'))await pending;await route.continue();});
 await partial.goto('http://localhost:3008/',{waitUntil:'domcontentloaded'});
 await partial.getByRole('button',{name:'Open available content',exact:true}).click({timeout:45000});
 await ready(partial,'/');assert.equal(await partial.evaluate(()=>document.documentElement.dataset.publicReadyMode),'partial');
 releasePartial();await partial.waitForTimeout(500);await partial.close();console.log('PASS stalled request recovery: explicit partial opening restores scrolling without claiming complete readiness');
 const shared=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});await fixture(shared);let manifests=0;
 await shared.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return /webgl/.test(type)?null:original.call(this,type,...args);};});
 await shared.route('https://catalog.example/atlas/catalog/current.json',async route=>{manifests++;await route.fulfill({headers:{'access-control-allow-origin':'*'},contentType:'application/json',body:JSON.stringify({format:'life-atlas-public-media',version:1,revision:'test',updatedAt:'2026-11-16T00:00:00.000Z',items:[]})});});
 await shared.goto('http://localhost:3008/?atlasCatalog=https%3A%2F%2Fcatalog.example%2Fatlas%2Fcatalog%2Fcurrent.json',{waitUntil:'domcontentloaded'});await ready(shared,'/');assert.equal(manifests,1);await shared.close();console.log('PASS manifest deduplication: hero, ribbon and published collection share one validated request');
 const geography=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});await fixture(geography);
 const geographyErrors=[];geography.on('pageerror',error=>geographyErrors.push(error.message));
 await geography.route('**/data/countries.geojson',route=>route.abort());
 await geography.goto('http://localhost:3008/',{waitUntil:'domcontentloaded'});await ready(geography,'/');
 assert.equal(await geography.evaluate(()=>document.documentElement.dataset.publicReadyMode),'degraded');
 await geography.getByText('The map is taking a rest. Explore the destinations beside it.').waitFor();assert.deepEqual(geographyErrors,[]);
 await geography.close();console.log('PASS failed globe geography: accessible fallback and degraded readiness without uncaught errors');
 const filmFallback=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});
 const filmErrors=[];filmFallback.on('pageerror',error=>filmErrors.push(error.message));
 await filmFallback.route('https://videos.pexels.com/**',route=>route.abort());
 await filmFallback.goto('http://localhost:3008/',{waitUntil:'domcontentloaded'});await ready(filmFallback,'/');
 assert.ok(await filmFallback.locator('.trip-film-stage video').evaluateAll(videos=>videos.every(video=>video.readyState>=2&&video.getAttribute('src').startsWith('/films/hero/'))));
 assert.deepEqual(filmErrors,[]);await filmFallback.close();console.log('PASS video CDN failure: loader waits for decoded local fallback frames');
 await writeFile('work/qa-public-loading/measurements.json',JSON.stringify(measurements,null,2));
}finally{await browser.close();}
