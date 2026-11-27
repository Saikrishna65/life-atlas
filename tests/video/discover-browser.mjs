// Source UI fixture: real scrolling/observers, synthetic provider pages; no real playback.
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)('playwright');
const result=await build({stdin:{contents:`import React from 'react';import{createRoot}from'react-dom/client';import Video from './src/components/video/AtlasVideoWeb';createRoot(document.getElementById('root')).render(<Video standalone/>);`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,outdir:'/virtual',format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"','process.env':'{}'},plugins:[{name:'link-fixture',setup(b){b.onResolve({filter:/^next\/link$/},()=>({path:'link',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:`import React from 'react';export default function Link(props){return React.createElement('a',props);}`,loader:'js',resolveDir:process.cwd()}));}}]});
const js=result.outputFiles.find(f=>f.path.endsWith('.js')).text,css=result.outputFiles.find(f=>f.path.endsWith('.css')).text;
const calls=[];
const item=(topic,i)=>({id:`discover${String(i).padStart(3,'0')}`,title:`${topic} · Video ${i}`,channel:'Fixture channel',duration:'8:24'});
const server=createServer(async(req,res)=>{
 if(req.url==='/api/video/suggestions'){res.setHeader('content-type','application/json');res.end('{"suggestions":[]}');return;}
 if(req.url==='/api/video/search'){
  let body='';for await(const chunk of req)body+=chunk;
  const {query,continuation}=JSON.parse(body);calls.push({query,continuation});res.setHeader('content-type','application/json');
  if(query==='cooking recipes techniques' && calls.filter(call=>call.query===query).length%2===1){res.statusCode=503;res.end('{"error":"Unavailable"}');return;}
  if(query==='science explained documentary') await new Promise(resolve=>setTimeout(resolve,650));
  res.end(JSON.stringify({videos:Array.from({length:continuation?3:20},(_,i)=>item(query,continuation?i+20:i)),continuation:continuation?null:{token:'next-'+encodeURIComponent(query),visitorData:'anonymous'}}));return;
 }
 res.setHeader('content-type','text/html');res.end(`<meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}*{box-sizing:border-box}${css}</style><div id="root"></div><script>${js.replaceAll('</script','<\\/script')}</script>`);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try {
 browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 for(const width of [320,390,1280]) {
  const page=await browser.newPage({viewport:{width,height:850},reducedMotion:'reduce'}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',route=>{
   if(new URL(route.request().url()).hostname==='127.0.0.1')return route.continue();
   if(route.request().url().includes('i.ytimg.com'))return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="480" height="270"><rect width="480" height="270" fill="#779c8d"/><path d="M0 270L180 30L400 270Z" fill="#33594e"/></svg>'});
   return route.abort();
  });
  const before=calls.length;
  await page.goto(`http://127.0.0.1:${server.address().port}/video`);
  const nav=page.getByRole('navigation',{name:'Atlas Video navigation'}),discover=page.getByRole('region',{name:'Discover videos'});
  await nav.getByRole('button',{name:'Discover',exact:true}).click();
  await discover.getByRole('button',{name:'Travel',exact:true}).waitFor();
  await page.waitForTimeout(200);assert.equal(calls.length,before,'No provider requests before choosing a topic');
  await discover.getByRole('button',{name:'Travel',exact:true}).click();
  await page.waitForFunction(()=>document.querySelectorAll('.video-discover-feed .video-result').length===20);
  assert.deepEqual(await page.evaluate(()=>({...localStorage})),{'atlas-video-topic':'travel'});
  await mkdir('work/qa-video-web',{recursive:true});await page.screenshot({path:`work/qa-video-web/discover-${width}.png`});
  await discover.locator('.video-result').nth(10).scrollIntoViewIfNeeded();const position=await page.evaluate(()=>scrollY);
  await discover.locator('.video-result').nth(10).click();await page.getByRole('region',{name:'Video player'}).waitFor();
  await page.getByRole('complementary',{name:'More from this topic'}).waitFor();
  await page.getByRole('button',{name:'Close video'}).click();await page.waitForFunction(y=>Math.abs(scrollY-y)<3,position);
  if(await discover.locator('.video-pagination').count()) await discover.locator('.video-pagination').scrollIntoViewIfNeeded();await page.waitForFunction(()=>document.querySelectorAll('.video-discover-feed .video-result').length===23);
  await nav.getByRole('button',{name:'Search',exact:true}).click();
  const input=page.getByRole('combobox');await input.fill('my private query');await input.press('Enter');
  await page.getByRole('heading',{name:'my private query',exact:true}).waitFor();
  await page.waitForFunction(()=>document.querySelectorAll('.video-content > .video-results .video-result').length===20);
  const travelCalls=calls.filter(call=>call.query==='cinematic travel films').length;
  await nav.getByRole('button',{name:'Discover',exact:true}).click();assert.equal(await discover.locator('.video-result').count(),23);
  assert.equal(calls.filter(call=>call.query==='cinematic travel films').length,travelCalls,'Returning reuses current in-memory feed');
  const scienceRequest=page.waitForRequest(request=>request.url().endsWith('/api/video/search')&&request.postDataJSON().query==='science explained documentary');
  await discover.getByRole('button',{name:'Science',exact:true}).click();await scienceRequest;
  await discover.getByRole('button',{name:'Nature',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('.video-discover-feed .video-result h2')?.textContent.includes('wildlife'));
  await page.waitForTimeout(750);assert.ok((await discover.locator('.video-result h2').first().textContent()).includes('wildlife'),'Old topic cannot replace current topic');
  await page.reload();assert.equal(await discover.isVisible(),false);
  const reloadCount=calls.length;await page.waitForTimeout(150);assert.equal(calls.length,reloadCount,'Hidden Discover does not request saved topics');
  await nav.getByRole('button',{name:'Discover',exact:true}).click();await discover.getByRole('button',{name:'Nature',exact:true}).waitFor();
  await page.waitForFunction(()=>document.querySelectorAll('.video-discover-feed .video-result').length===20);
  await discover.getByRole('button',{name:'Forget my topic'}).click();assert.deepEqual(await page.evaluate(()=>Object.keys(localStorage)),[]);
  assert.equal(await discover.locator('.video-result').count(),0);
  await discover.getByRole('button',{name:'Cooking',exact:true}).click();await discover.getByRole('alert').waitFor();
  await discover.getByRole('button',{name:'Try again',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.video-discover-feed .video-result').length===20);
  await discover.getByRole('button',{name:'Forget my topic'}).click();assert.deepEqual(await page.evaluate(()=>Object.keys(localStorage)),[]);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.deepEqual(errors,[]);await page.close();
 }
 console.log('PASS: Discover opt-in, pagination, feed/search isolation, return scroll, topic cancellation, preference restore/reset, no history and 320/390/1280px layouts. Provider/playback are fixtures.');
} finally {if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
