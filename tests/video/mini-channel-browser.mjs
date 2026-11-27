// Source UI fixture: real scrolling/observers, synthetic provider pages; no real playback.
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)('playwright');
const result=await build({stdin:{contents:`import React from 'react';import{createRoot}from'react-dom/client';import Video from './src/components/video/AtlasVideoWeb';createRoot(document.getElementById('root')).render(<Video standalone/>);`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,outdir:'/virtual',format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"','process.env':'{}'},plugins:[{name:'link-fixture',setup(b){b.onResolve({filter:/^next\/link$/},()=>({path:'link',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:`import React from 'react';export default function Link(props){return React.createElement('a',props);}`,loader:'js',resolveDir:process.cwd()}));}}]});
const js=result.outputFiles.find(f=>f.path.endsWith('.js')).text,css=result.outputFiles.find(f=>f.path.endsWith('.css')).text;
const creator='UC'+'a'.repeat(22),other='UC'+'b'.repeat(22),calls=[];
const video=(i,id=creator)=>({id:`fixture${String(i).padStart(4,'0')}`,title:`Channel film ${i}`,channel:id===creator?'Test Creator':'Other Creator',channelId:id,duration:'2:30'});
const server=createServer(async(req,res)=>{
 if(req.url==='/api/video/suggestions'){res.setHeader('content-type','application/json');res.end('{"suggestions":[]}');return;}
 if(req.url==='/api/video/search'){res.setHeader('content-type','application/json');res.end(JSON.stringify({videos:[video(0),video(1),video(2,other)]}));return;}
 if(req.url==='/api/video/channel'){
  let text='';for await(const chunk of req)text+=chunk;const body=JSON.parse(text);calls.push(body);res.setHeader('content-type','application/json');
  if(body.channelId===other){await new Promise(resolve=>setTimeout(resolve,450));res.end(JSON.stringify({channel:{id:other,title:'Other Creator',description:'Other channel'},videos:[video(99,other)]}));return;}
  if(calls.filter(call=>call.channelId===creator&&!call.continuation).length===1&&!body.continuation){res.statusCode=503;res.end('{"error":"Fixture unavailable"}');return;}
  res.end(JSON.stringify({channel:{id:creator,title:'Test Creator',description:'A short introduction to the films.'},videos:body.continuation?[video(19),video(20),video(21)]:Array.from({length:20},(_,i)=>video(i)),continuation:body.continuation?null:{token:'channel-page-two',visitorData:'anonymous'}}));return;
 }
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
 for(const width of [320,390,1280]) {
  calls.length=0;
  const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',route=>{
   const url=new URL(route.request().url());if(url.hostname==='127.0.0.1')return route.continue();
   if(url.href==='https://www.youtube.com/iframe_api')return route.fulfill({contentType:'application/javascript',body:fakeApi});
   if(url.hostname==='i.ytimg.com')return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="480" height="270"><rect width="480" height="270" fill="#779c8d"/><path d="M0 270L180 30L400 270Z" fill="#33594e"/></svg>'});
   if(url.hostname==='www.youtube-nocookie.com')return route.fulfill({contentType:'text/html',body:'<meta charset="utf-8"><body style="margin:0;background:#151d1a;color:white;display:grid;place-items:center;font:12px sans-serif"><p>Synthetic player - no real playback</p></body>'});
   return route.abort();
  });
  await page.goto(`http://127.0.0.1:${server.address().port}/video`);
  const nav=page.getByRole('navigation',{name:'Atlas Video navigation'}),input=page.getByRole('combobox'),channel=page.getByRole('region',{name:'Channel page'});
  await input.fill('nature');await input.press('Enter');await page.getByRole('button',{name:'Channel film 0',exact:true}).click();
  await page.getByRole('button',{name:'Play video',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('.video-playback').dataset.playbackState==='playing');
  await page.evaluate(()=>{window.__originalFrame=document.querySelector('iframe');});
  const unchanged=async()=>assert.equal(await page.evaluate(()=>document.querySelector('iframe')===window.__originalFrame&&window.__players.length===1&&!window.__players[0].destroyed),true,'Browsing must preserve the exact iframe and API player');
  await page.getByRole('button',{name:'Minimize video'}).click();await page.getByRole('region',{name:'Mini player'}).waitFor();await unchanged();
  let box=await page.locator('iframe').boundingBox();assert.ok(box.width>=200&&box.height>=200,'Mini embed retains a usable player viewport');
  await nav.getByRole('button',{name:'You',exact:true}).click();await unchanged();
  await nav.getByRole('button',{name:'Discover',exact:true}).click();await unchanged();
  await nav.getByRole('button',{name:'Search',exact:true}).click();await unchanged();
  const request=page.waitForRequest(request=>request.url().endsWith('/api/video/channel'));
  await page.locator('button.video-card-channel:visible').filter({hasText:'Test Creator'}).first().click();await request;
  await channel.getByRole('alert').waitFor();await channel.getByRole('button',{name:'Try again',exact:true}).click();
  await channel.getByRole('heading',{name:'Test Creator',exact:true}).waitFor();
  await page.waitForFunction(()=>document.querySelectorAll('.video-channel-page .video-result').length===20);await unchanged();
  await page.getByRole('button',{name:'Expand mini player'}).click();await page.getByRole('region',{name:'Video player'}).waitFor();await unchanged();
  await page.getByRole('button',{name:'Minimize video'}).click();await channel.waitFor({state:'visible'});await unchanged();
  await page.getByRole('button',{name:'Close mini player'}).click();assert.equal(await page.locator('iframe').count(),0);assert.equal(await page.evaluate(()=>window.__players[0].destroyed),true);
  await channel.getByText('About this channel',{exact:true}).click();await channel.getByText('A short introduction to the films.',{exact:true}).waitFor();
  await channel.locator('.video-pagination').scrollIntoViewIfNeeded();await page.waitForFunction(()=>document.querySelectorAll('.video-channel-page .video-result').length===22);
  assert.equal(calls.filter(call=>call.continuation).length,1,'Channel continuation runs exactly once');
  await channel.locator('.video-result-open').nth(10).scrollIntoViewIfNeeded();const position=await page.evaluate(()=>scrollY);
  await channel.locator('.video-result-open').nth(10).click();await page.getByRole('region',{name:'Video player'}).waitFor();
  await page.getByRole('complementary',{name:'More from this channel'}).waitFor();
  await page.getByRole('button',{name:'Minimize video'}).click();await channel.waitFor({state:'visible'});await page.waitForFunction(y=>Math.abs(scrollY-y)<3,position);
  await mkdir('work/qa-video-web',{recursive:true});await page.screenshot({path:`work/qa-video-web/channel-mini-${width}.png`});
  await page.getByRole('button',{name:'Close mini player'}).click();await channel.getByRole('button',{name:'Back to videos'}).click();
  await page.getByRole('heading',{name:'nature',exact:true}).waitFor();
  // A different channel mounts a separate request; returning and opening A cannot show B's late response.
  const pending=page.waitForRequest(request=>request.url().endsWith('/api/video/channel')&&request.postDataJSON().channelId===other);
  await page.locator('button.video-card-channel:visible').filter({hasText:'Other Creator'}).click();await pending;
  await channel.getByRole('button',{name:'Back to videos'}).click();
  await page.locator('button.video-card-channel:visible').filter({hasText:'Test Creator'}).first().click();
  await channel.getByRole('heading',{name:'Test Creator',exact:true}).waitFor();await page.waitForTimeout(600);
  assert.equal(await channel.getByRole('heading',{name:'Other Creator',exact:true}).count(),0);
  assert.deepEqual(await page.evaluate(()=>Object.keys(localStorage)),[],'No channel/search/watch history is saved');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
  await page.reload();assert.equal(await page.locator('iframe').count(),0);assert.equal(await page.getByRole('region',{name:'Channel page'}).count(),0);await page.close();
 }
 console.log('PASS: exact iframe/API continuity through search/Discover/settings/channel, expand/minimize/close, minimum mini viewport, channel ID navigation, retry, pagination/deduplication, channel scroll return, replacement-request isolation, no history/reload state at 320/390/1280px. Playback/provider are fixtures.');
} finally {if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
