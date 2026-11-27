// Source UI fixture: real scrolling/observers, synthetic provider pages; no real playback.
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)('playwright');
const result=await build({stdin:{contents:`import React from 'react';import{createRoot}from'react-dom/client';import Video from './src/components/video/AtlasVideoWeb';createRoot(document.getElementById('root')).render(<Video standalone/>);`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,outdir:'/virtual',format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"','process.env':'{}'},plugins:[{name:'link-fixture',setup(b){b.onResolve({filter:/^next\/link$/},()=>({path:'link',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:`import React from 'react';export default function Link(props){return React.createElement('a',props);}`,loader:'js',resolveDir:process.cwd()}));}}]});
const js=result.outputFiles.find(f=>f.path.endsWith('.js')).text,css=result.outputFiles.find(f=>f.path.endsWith('.css')).text;
const calls=[],attempts=new Map();
const item=i=>({id:`fixture${String(i).padStart(4,'0')}`,title:`Video ${i} · A different view of the world`,channel:'Fixture channel',duration:'8:24'});
const cursor=token=>({token,visitorData:'anonymous-fixture'});
const server=createServer(async(req,res)=>{
 if(req.url==='/api/video/suggestions'){res.setHeader('content-type','application/json');res.end('{"suggestions":[]}');return;}
 if(req.url==='/api/video/search'){
  let body='';for await(const chunk of req)body+=chunk;
  const {query,continuation}=JSON.parse(body),token=continuation?.token||'first',key=query+':'+token;
  calls.push({query,token});attempts.set(key,(attempts.get(key)||0)+1);res.setHeader('content-type','application/json');
  if(query==='replacement'){res.end(JSON.stringify({videos:[{...item(99),title:'Replacement result'}],continuation:null}));return;}
  if(token==='first'){res.end(JSON.stringify({videos:Array.from({length:20},(_,i)=>item(i)),continuation:cursor(query.startsWith('slow')?'slow-2':'page-2')}));return;}
  if(token==='slow-2'){await new Promise(resolve=>setTimeout(resolve,900));res.end(JSON.stringify({videos:[{...item(98),title:'Stale page result'}],continuation:null}));return;}
  if(token==='page-2'){res.end(JSON.stringify({videos:Array.from({length:21},(_,i)=>item(i+19)),continuation:cursor('page-3')}));return;}
  if(token==='page-3'&&attempts.get(key)===1){res.statusCode=503;res.end('{"error":"Fixture page failure"}');return;}
  res.end(JSON.stringify({videos:Array.from({length:11},(_,i)=>item(i+39)),continuation:null}));return;
 }
 res.setHeader('content-type','text/html');res.end(`<meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}*{box-sizing:border-box}${css}</style><div id="root"></div><script>${js.replaceAll('</script','<\\/script')}</script>`);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try{
 browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 for(const width of [390,1280,1920]){
  const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce',isMobile:width===390,hasTouch:width===390}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',route=>{
   const url=new URL(route.request().url());if(url.hostname==='127.0.0.1')return route.continue();
   if(url.hostname==='i.ytimg.com'){
    const index=Number(url.pathname.match(/fixture(\d+)/)?.[1]||0),hue=(index*31)%360;
    return route.fulfill({contentType:'image/svg+xml',body:`<svg xmlns="http://www.w3.org/2000/svg" width="480" height="270"><rect width="480" height="270" fill="hsl(${hue} 22% 68%)"/><path d="M0 230L160 45L260 170L360 75L480 230V270H0Z" fill="hsl(${hue} 25% 30%)"/><circle cx="370" cy="55" r="24" fill="#f4e8c9"/><text x="20" y="245" fill="white" font-family="sans-serif" font-size="16">Fixture ${index}</text></svg>`});
   }
   return route.abort();
  });
  await page.goto(`http://127.0.0.1:${server.address().port}/video`);
  const input=page.getByRole('combobox',{name:'Search videos or paste a YouTube link'}),nav=page.getByRole('navigation',{name:'Atlas Video navigation'}),search=nav.getByRole('button',{name:'Search',exact:true});
  const query='feed-'+width;
  await input.fill(query);await input.press('Enter');await page.waitForFunction(()=>document.querySelectorAll('.video-result').length===20);
  assert.equal(await input.count(),0,'Search dock collapses after submission');assert.equal(await search.getAttribute('aria-pressed'),'false');
  await search.click();assert.equal(await input.count(),1);await search.click();assert.equal(await input.count(),0,'Active Search button toggles off');
  assert.equal(await page.locator('.video-result').count(),20);
  const content=await page.locator('.video-content').boundingBox();assert.ok(content.width>width*.88,'Feed uses the screen width');
  await mkdir('work/qa-video-web',{recursive:true});await page.screenshot({path:`work/qa-video-web/feed-${width}.png`,fullPage:false});
  // Keep a result in view, open it and return to the same scroll position.
  await page.locator('.video-result').nth(12).scrollIntoViewIfNeeded();
  const position=await page.evaluate(()=>scrollY);
  await page.locator('.video-result').nth(12).click();await page.getByRole('region',{name:'Video player'}).waitFor();
  assert.equal(await page.getByRole('link',{name:/Open on YouTube/i}).count(),0);
  const frame=await page.locator('iframe').boundingBox(),related=await page.getByRole('complementary',{name:'More from this search'}).boundingBox();
  assert.ok(frame.height>150&&frame.width>300);
  if(width>1000)assert.ok(related.x>=frame.x+frame.width,'Related videos sit beside the player on desktop');
  else assert.ok(related.y>=frame.y+frame.height,'Related videos stack below on mobile');
  await page.screenshot({path:`work/qa-video-web/watch-${width}.png`,fullPage:false});
  await page.getByRole('button',{name:'Close video'}).click();await page.waitForFunction(y=>Math.abs(scrollY-y)<3,position);
  await page.locator('.video-pagination').scrollIntoViewIfNeeded();await page.waitForFunction(()=>document.querySelectorAll('.video-result').length===40);
  await page.waitForTimeout(200);
  assert.equal(calls.filter(call=>call.query===query&&call.token==='page-2').length,1,'One request for a continuation even if the observer fires repeatedly');
  await page.locator('.video-pagination').scrollIntoViewIfNeeded();await page.getByRole('button',{name:'Retry loading videos'}).waitFor();
  assert.equal(await page.locator('.video-result').count(),40,'Page failure preserves current results');
  await page.getByRole('button',{name:'Retry loading videos'}).click();await page.waitForFunction(()=>document.querySelectorAll('.video-result').length===50);
  assert.equal(await page.locator('.video-pagination').count(),0,'End of results stops pagination');
  await search.click();await input.fill('slow-'+width);await input.press('Enter');await page.waitForFunction(()=>document.querySelectorAll('.video-result').length===20);
  const pending=page.waitForRequest(request=>request.url().endsWith('/api/video/search')&&request.postDataJSON().continuation?.token==='slow-2');
  await page.locator('.video-pagination').scrollIntoViewIfNeeded();await pending;
  await search.click();await input.fill('replacement');await input.press('Enter');await page.getByRole('heading',{name:'Replacement result'}).waitFor();
  await page.waitForTimeout(1000);assert.equal(await page.locator('.video-result').count(),1);assert.equal(await page.getByText('Stale page result',{exact:true}).count(),0);
  assert.deepEqual(await page.evaluate(()=>Object.keys(localStorage)),[]);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.deepEqual(errors,[]);await page.close();
 }
 console.log('PASS: real scroll-triggered pages, deduplication, retry preserving results, end detection, query cancellation, full-width grid, responsive watch sidebar, no external YouTube button, Search toggling and result scroll restoration at 390/1280/1920px. Provider pages and playback are fixtures.');
}finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
