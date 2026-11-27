// Source-only browser fixture; iframe requests are blocked, no actual YouTube playback is claimed.
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)('playwright');
const result=await build({stdin:{contents:`import React from 'react';import{createRoot}from'react-dom/client';import Video from './src/components/video/AtlasVideoWeb';createRoot(document.getElementById('root')).render(<Video standalone/>);`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,outdir:'/virtual',format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"','process.env':'{}'},plugins:[{name:'link-fixture',setup(b){b.onResolve({filter:/^next\/link$/},()=>({path:'link',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:`import React from 'react';export default function Link(props){return React.createElement('a',props);}`,loader:'js',resolveDir:process.cwd()}));}}]});
const js=result.outputFiles.find(f=>f.path.endsWith('.js')).text,css=result.outputFiles.find(f=>f.path.endsWith('.css')).text;
let searches=0;
const server=createServer(async(req,res)=>{
 if(req.url==='/api/video/search'){
  assert.equal(req.method,'POST');let body='';for await(const chunk of req)body+=chunk;
  const query=JSON.parse(body).query;assert.ok(['mountains','slow','latest'].includes(query));searches++;
  if(query==='slow')await new Promise(resolve=>setTimeout(resolve,900));
  const title=query==='latest'?'Newest request result':query==='slow'?'Old request result':'Browser test video';
  res.setHeader('content-type','application/json');res.end(JSON.stringify({videos:[{id:'dQw4w9WgXcQ',title,channel:'Test channel',thumbnail:'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',duration:'2:00'}]}));return;
 }
 res.setHeader('content-type','text/html');res.end(`<meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}*{box-sizing:border-box}${css}</style><div id="root"></div><script>${js.replaceAll('</script','<\\/script')}</script>`);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try{
 browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 for(const width of [390,1280]){
  const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
  const beforeQueries=searches;
  await page.goto(`http://127.0.0.1:${server.address().port}/video`);
  await page.getByRole('heading',{name:/Something.*worth your time/ }).waitFor();
  assert.equal(await page.getByRole('link',{name:'Back to Atlas',exact:true}).getAttribute('href'),'/');
  await mkdir('work/qa-video-web',{recursive:true});
  await page.screenshot({path:`work/qa-video-web/video-home-${width}.png`,fullPage:true});
  const input=page.getByRole('textbox',{name:'Search videos or paste a YouTube link'});
  await input.focus();
  await page.evaluate(()=>{Object.defineProperty(visualViewport,'height',{value:innerHeight-260,configurable:true});visualViewport.dispatchEvent(new Event('resize'));});
  assert.equal(await page.locator('.video-web').getAttribute('data-keyboard'),'true');
  assert.equal(await page.getByRole('navigation',{name:'Atlas Video navigation'}).isVisible(),false);
  assert.equal(await page.evaluate(()=>{const r=document.querySelector('.video-search').getBoundingClientRect();return r.bottom<=innerHeight-260;}),true,'Search remains above a simulated keyboard');
  await page.evaluate(()=>{delete visualViewport.height;visualViewport.dispatchEvent(new Event('resize'));});
  assert.equal(await page.getByRole('navigation',{name:'Atlas Video navigation'}).isVisible(),true);
  await input.fill('https://youtu.be/dQw4w9WgXcQ');await input.press('Enter');
  await page.getByRole('region',{name:'Video player'}).waitFor();
  assert.match(await page.locator('iframe').getAttribute('src'),/^https:\/\/www.youtube-nocookie.com\/embed\/dQw4w9WgXcQ\?/);
  assert.equal(searches,beforeQueries,'Pasting a video link requires no search request');
  await page.getByRole('button',{name:'Close video',exact:true}).click();
  await input.fill('mountains');await input.press('Enter');
  await page.getByRole('button',{name:/Browser test video/}).click();
  await page.getByRole('region',{name:'Video player'}).getByRole('heading',{name:'Browser test video'}).waitFor();
  await page.getByRole('navigation',{name:'Atlas Video navigation'}).getByRole('button',{name:'Search',exact:true}).click();
  await input.fill('slow');await input.press('Enter');await page.getByRole('status').filter({hasText:'Finding videos'}).waitFor();
  await input.fill('latest');await input.press('Enter');await page.getByRole('button',{name:/Newest request result/}).waitFor();
  await page.waitForTimeout(1000);
  assert.equal(await page.getByRole('button',{name:/Old request result/}).count(),0,'A stale response cannot replace the current search');
  await input.fill('slow');await input.press('Enter');await page.getByRole('button',{name:'Cancel search'}).click();
  await page.getByRole('heading',{name:/Something.*worth your time/}).waitFor();
  await page.getByRole('button',{name:'You',exact:true}).click();
  await page.getByRole('radio',{name:'Ink',exact:true}).check();
  await page.getByRole('radio',{name:'Paper',exact:true}).check();
  assert.deepEqual(await page.evaluate(()=>Object.keys(localStorage)),['atlas-video-web-theme']);
  assert.equal(await page.locator('iframe').count(),0);
  await page.getByRole('button',{name:'Search',exact:true}).click();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await mkdir('work/qa-video-web',{recursive:true});
  await page.screenshot({path:`work/qa-video-web/video-${width}.png`,fullPage:true});
  await page.reload();await page.getByRole('heading',{name:/Something.*worth your time/ }).waitFor();
  assert.equal(await input.inputValue(),'');assert.equal(await page.locator('iframe').count(),0);
  assert.deepEqual(errors,[]);await page.close();
 }
 console.log('PASS: standalone browser player at mobile/desktop widths, local link parsing, POST search, iframe allowlist, theme-only storage, no retained query/player on reload, request replacement, cancellation and simulated keyboard clearance. External playback not tested.');
}finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
