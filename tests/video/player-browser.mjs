// Source UI fixture: real scrolling/observers, synthetic provider pages; no real playback.
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)('playwright');
const result=await build({stdin:{contents:`import React from 'react';import{createRoot}from'react-dom/client';import Video from './src/components/video/AtlasVideoWeb';createRoot(document.getElementById('root')).render(<Video standalone/>);`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,outdir:'/virtual',format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"','process.env':'{}'},plugins:[{name:'link-fixture',setup(b){b.onResolve({filter:/^next\/link$/},()=>({path:'link',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:`import React from 'react';export default function Link(props){return React.createElement('a',props);}`,loader:'js',resolveDir:process.cwd()}));}}]});
const js=result.outputFiles.find(f=>f.path.endsWith('.js')).text,css=result.outputFiles.find(f=>f.path.endsWith('.css')).text;
const server=createServer(async(req,res)=>{
 if(req.url==='/api/video/suggestions'){res.setHeader('content-type','application/json');res.end('{"suggestions":[]}');return;}
 if(req.url==='/api/video/search'){res.setHeader('content-type','application/json');res.end(JSON.stringify({videos:[0,1,2].map(i=>({id:`fixture${String(i).padStart(4,'0')}`,title:`Playback fixture ${i}`,channel:'Test channel',duration:'2:30'}))}));return;}
 res.setHeader('content-type','text/html');res.end(`<meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}*{box-sizing:border-box}${css}</style><div id="root"></div><script>${js.replaceAll('</script','<\\/script')}</script>`);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const fakeApi=`window.__players=window.__players||[];window.YT={Player:class {
 constructor(iframe,options){this.iframe=iframe;this.events=options.events;this.destroyed=false;window.__players.push(this);queueMicrotask(()=>{if(!window.__holdReady)this.events.onReady({target:this});});}
 emit(data){this.events.onStateChange({target:this,data});}
 fail(data){this.events.onError({target:this,data});}
 playVideo(){this.emit(1);}
 getCurrentTime(){return 42;}
 destroy(){this.destroyed=true;this.iframe.remove();}
}};window.onYouTubeIframeAPIReady?.();`;
let browser;
try {
 browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 for(const width of [390,1280]) {
  const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'}),errors=[];let blockApi=true,apiCalls=0;
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',route=>{
   const url=new URL(route.request().url());if(url.hostname==='127.0.0.1')return route.continue();
   if(url.href==='https://www.youtube.com/iframe_api'){apiCalls++;return blockApi?route.abort():route.fulfill({contentType:'application/javascript',body:fakeApi});}
   if(url.hostname==='i.ytimg.com')return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="480" height="270"><rect width="480" height="270" fill="#779c8d"/><path d="M0 270L180 30L400 270Z" fill="#33594e"/></svg>'});
   if(url.hostname==='www.youtube-nocookie.com')return route.fulfill({contentType:'text/html',body:'<meta charset="utf-8"><body style="margin:0;background:#151d1a;color:white;display:grid;place-items:center;font:16px sans-serif"><p>Synthetic player — no real playback</p></body>'});
   return route.abort();
  });
  await page.goto(`http://127.0.0.1:${server.address().port}/video`);
  assert.equal(apiCalls,0,'No API/player requests before choosing a video');
  const nav=page.getByRole('navigation',{name:'Atlas Video navigation'}),input=page.getByRole('combobox');
  const search=async(value)=>{if(!await input.count())await nav.getByRole('button',{name:'Search',exact:true}).click();await input.fill(value);await input.press('Enter');};
  await search('mountains');await page.getByRole('button',{name:/Playback fixture 0/}).click();
  await page.getByRole('button',{name:'Reload player'}).waitFor();assert.equal(await page.locator('iframe').count(),1,'Failed SDK leaves the native embed usable');
  assert.equal(await page.locator('.video-playback').getAttribute('data-playback-state'),'error');
  blockApi=false;await page.getByRole('button',{name:'Reload player'}).click();await page.getByRole('button',{name:'Play video',exact:true}).waitFor();
  assert.equal(apiCalls,2,'Failed script loading can be retried');
  assert.equal(await page.locator('.video-playback').getAttribute('data-playback-state'),'ready','Frame/API readiness is not reported as playing');
  await page.evaluate(()=>window.__players.at(-1).events.onAutoplayBlocked({target:window.__players.at(-1)}));
  await page.getByText('Tap Play to start this video.',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Play video',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('.video-playback').dataset.playbackState==='playing');
  assert.ok(Number(await page.locator('.video-playback').getAttribute('data-startup-ms'))>=0);
  await page.evaluate(()=>window.__players.at(-1).emit(3));await page.getByText('Buffering…',{exact:true}).waitFor();
  await page.evaluate(()=>window.__players.at(-1).emit(1));
  await page.evaluate(()=>window.__players.at(-1).fail(150));await page.getByText(/owner doesn’t allow/).waitFor();
  await page.getByRole('button',{name:'Reload player'}).click();await page.getByRole('button',{name:'Play video',exact:true}).waitFor();
  assert.equal(new URL(await page.locator('iframe').getAttribute('src')).searchParams.get('start'),'42');
  assert.equal(await page.evaluate(()=>window.__players[0].destroyed),true);
  await page.evaluate(()=>window.__players[0].fail(100));assert.equal(await page.locator('.video-playback').getAttribute('data-playback-state'),'ready','Disposed players cannot overwrite the replacement state');
  await page.evaluate(()=>window.dispatchEvent(new Event('offline')));await page.getByText(/You’re offline/).waitFor();
  await page.evaluate(()=>window.dispatchEvent(new Event('online')));await page.getByText(/back online/).waitFor();
  await page.getByRole('button',{name:'Reload player'}).click();await page.getByRole('button',{name:'Play video',exact:true}).waitFor();
  await page.evaluate(()=>window.__players.at(-1).emit(0));await page.getByRole('button',{name:'Play again',exact:true}).waitFor();
  if(width>1000){await page.getByRole('button',{name:'Theater view',exact:true}).click();assert.equal(await page.locator('.video-watch').getAttribute('data-theater'),'true');await page.getByRole('button',{name:'Exit theater view',exact:true}).click();}
  await mkdir('work/qa-video-web',{recursive:true});await page.screenshot({path:`work/qa-video-web/player-${width}.png`});
  await page.getByRole('button',{name:'Close video'}).click();assert.equal(await page.locator('iframe').count(),0);
  assert.equal(await page.evaluate(()=>window.__players.every(player=>player.destroyed)),true,'Closing disposes every player');
  await nav.getByRole('button',{name:'You',exact:true}).click();
  await page.getByRole('checkbox',{name:/Play when opened/}).uncheck();await page.getByRole('checkbox',{name:/Show more videos/}).uncheck();
  assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('atlas-video-playback'))),{autoplay:false,related:false});
  await search('mountains');await page.getByRole('button',{name:/Playback fixture 0/}).click();await page.getByRole('button',{name:'Play video',exact:true}).waitFor();
  await page.clock.install();await page.evaluate(()=>{window.__holdReady=true;window.__players.at(-1).fail(5);});
  await page.getByRole('button',{name:'Reload player'}).click();await page.waitForFunction(()=>document.querySelector('.video-playback').dataset.playbackState==='connecting');
  await page.clock.fastForward(16000);await page.getByText(/taking longer than usual/).waitFor();
  await page.evaluate(()=>window.__holdReady=false);await page.getByRole('button',{name:'Reload player'}).click();await page.getByRole('button',{name:'Play video',exact:true}).waitFor();
  assert.equal(new URL(await page.locator('iframe').getAttribute('src')).searchParams.get('autoplay'),'0');assert.equal(await page.locator('.video-up-next').count(),0);
  assert.equal(apiCalls,2,'Already loaded official API is reused across videos and retries');
  assert.deepEqual(await page.evaluate(()=>Object.keys(localStorage)),['atlas-video-playback'],'Playback changes never save history');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
  await page.close();
 }
 console.log('PASS: lazy official API, SDK retry/native iframe fallback, readiness vs playing, blocked autoplay, buffering, embed errors, resume on retry, stale event isolation, offline/online, player disposal, theater layout and persisted playback toggles at 390/1280px. Provider events/playback are synthetic.');
} finally {if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
