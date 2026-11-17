import {createRequire} from 'node:module';
import {mkdir,readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const {PrismaClient}=require('@prisma/client');
// This test writes synthetic fixtures. Never point it at a personal/production database.
const db=new URL(process.env.DATABASE_URL || '');
assert.ok(['127.0.0.1','localhost'].includes(db.hostname) && db.port==='5544','Requires the isolated local PostgreSQL test server on port 5544');
const prisma=new PrismaClient();
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
const origin=process.env.ATLAS_TEST_ORIGIN || 'http://localhost:3008';
const title=`Optional journal QA ${Date.now()}`;
const base={title,destination:'Test destination',startDate:'2026-11-01',memories:[{title:'A photograph',images:[`${origin}/images/people/stock-creator.webp`]}]};
let slug;
const errors=[];
async function publish(page,extra={}) {
 const response=await page.request.post(`${origin}/api/vault/export`,{headers:{'X-Atlas-Publish':'1','Origin':origin},data:{...base,existingSlug:slug,...extra}});
 assert.equal(response.status(),200,await response.text());const result=await response.json();slug=result.slug;return result;
}
async function ready(page) {
 await page.goto(`${origin}/trips/${slug}`,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.documentElement.dataset.publicReady===location.pathname&&!document.querySelector('.public-page-loader'),null,{timeout:60000});
}
try {
 await mkdir('work/qa-trip-optional',{recursive:true});
 const page=await browser.newPage({viewport:{width:1440,height:900}});page.on('pageerror',e=>errors.push(e.message));
 let tiles=0;
 await page.route('https://**.tile.openstreetmap.org/**',async route=>{tiles++;await route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><path fill="#e5e9e1" d="M0 0h256v256H0z"/></svg>'});});
 await publish(page,{itineraryDays:[{dayIndex:1,title:' ',description:''}]});
 const stored=await prisma.trip.findUnique({where:{slug},include:{tripDays:true}});
 assert.equal(stored.description,null);assert.equal(stored.tripDays.length,0);
 for(const width of [1440,390]) {
  await page.setViewportSize({width,height:width===1440?900:844});await ready(page);
  for(const selector of ['.td-route','.td-itinerary','.td-prologue','.td-route-record','.td-route-aside'])assert.equal(await page.locator(selector).count(),0,selector);
  assert.equal(await page.locator('.td-frame').count(),1);assert.equal(tiles,0);
  assert.ok(!(await page.locator('.td-cover-bottom').innerText()).includes('0 published stops'));
  await page.getByRole('button',{name:'View the gallery',exact:true}).click();await page.waitForURL(/#photo-journal$/);
  await page.waitForTimeout(1300);await page.locator('.td-frame').click();await page.locator('dialog[open]').waitFor();await page.keyboard.press('Escape');await page.locator('dialog[open]').waitFor({state:'detached'});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.screenshot({path:`work/qa-trip-optional/photos-${width}.png`,fullPage:true});
 }
 console.log('PASS photo-only desktop/mobile: no missing sections, no map requests, gallery navigation/lightbox and no overflow');
 await page.setViewportSize({width:1440,height:900});
 await publish(page,{description:'Lunch by the river.',totalDistanceKm:12,itineraryDays:[{dayIndex:1,title:'The river',description:'An afternoon with friends.'}],routeData:{legs:[{coordinates:[{latitude:30,longitude:79},{latitude:30.02,longitude:79.03}]}]}});
 await ready(page);assert.equal(await page.locator('.td-route').count(),1);assert.equal(await page.locator('.td-itinerary').count(),1);assert.equal(await page.locator('.td-prologue').count(),1);
 assert.equal(await page.locator('.td-metrics dt').count(),1);assert.equal(await page.locator('.td-metrics dt').innerText(),'Distance travelled');
 assert.ok(!(await page.locator('.td-route-record').innerText()).includes('Not recorded'));
 assert.equal(await page.locator('.td-route-aside').count(),0);assert.equal(await page.locator('.td-map-layout-wide .leaflet-container').count(),1);
 assert.match(await page.locator('.td-day-intro').innerText(),/afternoon/);
 console.log('PASS partial trip: authored details reappear, route works without stops and missing statistics stay absent');
 await publish(page,{preserveExistingRoute:true,preserveExistingItinerary:true});
 const retained=await prisma.trip.findUnique({where:{slug}});assert.equal(retained.totalDistanceKm,12);assert.ok(retained.routeData.legs.length);
 console.log('PASS media-only update preserves existing website route and totals when explicitly requested');

 await publish(page,{totalDistanceKm:0});await ready(page);
 assert.equal((await prisma.trip.findUnique({where:{slug}})).routeData,null);
 assert.equal(await page.locator('.td-map-stage,.td-itinerary,.td-prologue').count(),0);
 assert.equal(await page.locator('.td-metrics dt').count(),1);assert.match(await page.locator('.td-metrics dd').innerText(),/0/);
 console.log('PASS republishing clears removed route/days/description while a genuine zero metric remains');
 await publish(page,{memories:[]});await ready(page);
 assert.equal(await page.locator('.td-route,.td-itinerary,.td-prologue,.td-journal').count(),0);
 await page.getByRole('button',{name:'Explore the journal',exact:true}).click();await page.waitForURL(/#journal-ending$/);
 console.log('PASS empty journal: absent gallery/sections and a working remaining navigation target');
 const source='https://catalog.example/atlas/catalog/current.json';
 const common={title:'A public moment',description:'',tags:[],category:'expedition',collection:slug,size:100,publishedAt:'2026-11-17T00:00:00.000Z',metadataPolicy:'retained'};
 await page.route(source,route=>route.fulfill({headers:{'access-control-allow-origin':'*'},contentType:'application/json',body:JSON.stringify({format:'life-atlas-public-media',version:1,revision:'optional-media',updatedAt:common.publishedAt,items:[
  {...common,id:'published-photo',key:'galleries/photo.webp',url:'https://catalog.example/galleries/photo.webp',mimeType:'image/webp'},
  {...common,id:'published-video',key:'galleries/film.mp4',url:'https://catalog.example/galleries/film.mp4',mimeType:'video/mp4'},
 ]})}));
 await page.route('https://catalog.example/galleries/photo.webp',async route=>route.fulfill({headers:{'access-control-allow-origin':'*'},contentType:'image/webp',body:await readFile('public/images/people/stock-creator.webp')}));
 await page.route('https://catalog.example/galleries/film.mp4',async route=>route.fulfill({headers:{'access-control-allow-origin':'*'},contentType:'video/mp4',body:await readFile('public/films/hero/highlands.mp4')}));
 await page.goto(`${origin}/trips/${slug}?atlasCatalog=${encodeURIComponent(source)}`,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.documentElement.dataset.publicReady===location.pathname&&!document.querySelector('.public-page-loader'),null,{timeout:60000});
 assert.equal(await page.locator('.td-frame').count(),2);assert.equal(await page.locator('.td-route,.td-itinerary').count(),0);
 await page.getByRole('button',{name:'Films',exact:true}).click();assert.equal(await page.locator('.td-frame').count(),1);assert.equal(await page.locator('.td-frame video').count(),1);
 await page.getByRole('button',{name:'Photos',exact:true}).click();assert.equal(await page.locator('.td-frame img').count(),1);
 await page.evaluate(()=>localStorage.clear());
 console.log('PASS catalog-only trip: asynchronously published photos/videos appear, filter correctly and do not create absent sections');

 await page.goto(`${origin}/trips/himalayan-journey`,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.documentElement.dataset.publicReady===location.pathname&&!document.querySelector('.public-page-loader'),null,{timeout:60000});
 assert.equal(await page.locator('.td-route,.td-itinerary,.td-journal').count(),3);assert.equal(await page.locator('.td-metrics dt').count(),7);
 assert.deepEqual(errors,[]);console.log('PASS complete sample trip preserves all sections and browser has no uncaught errors');
} finally {
 await browser.close();
 if(slug){const trip=await prisma.trip.findUnique({where:{slug}});if(trip){await prisma.photo.deleteMany({where:{tripId:trip.id}});await prisma.timelineEvent.deleteMany({where:{referenceId:trip.id}});await prisma.trip.delete({where:{id:trip.id}});}}
 await prisma.$disconnect();
}
