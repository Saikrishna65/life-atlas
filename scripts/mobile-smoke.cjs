const {chromium}=require('@playwright/test');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve('mobile-dist');
const types={'.js':'text/javascript','.css':'text/css','.html':'text/html','.json':'application/json','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml'};
(async()=>{
 const server=http.createServer((req,res)=>{let file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!file.startsWith(root+path.sep))file=path.join(root,'index.html');if(!fs.existsSync(file)||!fs.statSync(file).isFile())file=path.join(root,'index.html');res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
 const browser=await chromium.launch({headless:true});
 try{
 const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});const page=await context.newPage();const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
 await page.goto(origin+'/secret');await page.getByRole('heading',{name:'Trip Vault',exact:true}).waitFor();
 await page.goto(origin+'/secret/vault');await page.getByRole('heading',{name:/Less planning/}).waitFor();await page.waitForFunction(async()=>{const r=indexedDB.open('life_atlas_trip_vault_db');return await new Promise(resolve=>{r.onsuccess=()=>{const ready=r.result.objectStoreNames.contains('trips');r.result.close();resolve(ready)};r.onerror=()=>resolve(false)})});
 // Initialize native-independent schemas using the real screens, then add local route fixtures.
 await page.goto(origin+'/secret/finance');await page.locator('.atlas-finance[aria-busy="false"]').waitFor();
 await page.evaluate(async()=>{
  const open=name=>new Promise((resolve,reject)=>{const r=indexedDB.open(name);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
  const put=async(name,store,value)=>{const db=await open(name);await new Promise((resolve,reject)=>{const tx=db.transaction(store,'readwrite');tx.objectStore(store).put(value);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});db.close()};
  const now=new Date().toISOString();await put('life_atlas_trip_vault_db','trips',{id:'offline-smoke',title:'Offline smoke trip',destination:'Coast',startDate:now,endDate:now,status:'PLANNING',travelStyle:'LEISURE',budgetTotal:10000,currency:'INR',createdAt:now,updatedAt:now});
  await put('life_atlas_music_db','playlists',{id:'offline-playlist',title:'Offline playlist',trackIds:[],createdAt:Date.now(),updatedAt:Date.now()});
 });
 const routes=['/secret','/secret/vault','/secret/vault/new','/secret/finance','/secret/studio','/secret/control-room','/secret/music','/secret/music/library','/secret/music/playlists','/secret/music/playlists/offline-playlist','/secret/music/settings',...['','plan','money','checklist','assistant','bookings','budget','documents','food','itinerary','memories','packing','reminders','rentals','routes','safety'].map(s=>'/secret/vault/offline-smoke'+(s?'/'+s:''))];
 for(const route of routes){await page.goto(origin+route);await page.waitForTimeout(300);await page.locator('#root > *').first().waitFor();assert.equal(await page.getByText('Unable to open this screen',{exact:true}).count(),0,route);assert.equal(await page.getByText('Screen not found.',{exact:false}).count(),0,route);console.log('Offline screen:',route)}
 await page.goto(origin+'/secret/vault/offline-smoke/packing');await page.waitForTimeout(400);await page.screenshot({path:'mobile-test-results/offline-packing.png',fullPage:true});
 // Test the bundle's online API routing without touching a real account or needing live credentials.
 await page.route('https://life-atlas-eight-five.vercel.app/api/music',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({success:true,tracks:[{audioUrl:'/api/music/stream/test'}],playlists:[]})}));
 const online=await page.evaluate(async()=>{const r=await fetch('/api/music');return {status:r.status,data:await r.json()}});assert.equal(online.status,200);assert.equal(online.data.tracks[0].audioUrl,'https://life-atlas-eight-five.vercel.app/api/music/stream/test');
 await page.evaluate(()=>Object.defineProperty(navigator,'onLine',{configurable:true,get:()=>false}));
 const offline=await page.evaluate(async()=>{const r=await fetch('/api/music');return r.status});assert.equal(offline,503);
 assert.deepEqual(errors,[]);console.log('Offline local routes, reload persistence and online API routing passed');
 await new Promise((resolve,reject)=>{const child=require('node:child_process').spawn(process.execPath,['scripts/control-room-responsive.cjs'],{stdio:'inherit',env:{...process.env,CONTROL_ROOM_TEST_ORIGIN:origin}});child.on('exit',code=>code===0?resolve():reject(new Error('Control Room responsive checks failed')));child.on('error',reject);});
 await new Promise((resolve,reject)=>{const child=require('node:child_process').spawn(process.execPath,['scripts/trip-redesign-smoke.cjs'],{stdio:'inherit',env:{...process.env,CONTROL_ROOM_TEST_ORIGIN:origin}});child.on('exit',code=>code===0?resolve():reject(new Error('Trip redesign checks failed')));child.on('error',reject);});
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});
