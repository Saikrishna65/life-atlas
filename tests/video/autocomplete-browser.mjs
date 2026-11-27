// Source fixture only. The suggestion/search HTTP responses are synthetic, not live YouTube.
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const { chromium } = createRequire(import.meta.url)('playwright');
const result=await build({stdin:{contents:`import React from 'react';import{createRoot}from'react-dom/client';import Video from './src/components/video/AtlasVideoWeb';createRoot(document.getElementById('root')).render(<Video standalone/>);`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,outdir:'/virtual',format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"','process.env':'{}'},plugins:[{name:'link-fixture',setup(b){b.onResolve({filter:/^next\/link$/},()=>({path:'link',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:`import React from 'react';export default function Link(props){return React.createElement('a',props);}`,loader:'js',resolveDir:process.cwd()}));}}]});
const js=result.outputFiles.find(f=>f.path.endsWith('.js')).text,css=result.outputFiles.find(f=>f.path.endsWith('.css')).text;
const completions=[],searches=[];
const server=createServer(async(req,res)=>{
 if(req.url==='/api/video/suggestions'||req.url==='/api/video/search'){
  assert.equal(req.method,'POST');let body='';for await(const chunk of req)body+=chunk;
  const {query}=JSON.parse(body);res.setHeader('content-type','application/json');
  if(req.url==='/api/video/search'){
   searches.push(query);res.end(JSON.stringify({videos:[]}));return;
  }
  completions.push(query);
  if(query==='old')await new Promise(resolve=>setTimeout(resolve,900));
  if(query==='offline'){res.statusCode=503;res.end('{}');return;}
  res.end(JSON.stringify({suggestions:query==='nature'?['nature documentary','nature sounds','nature photography','nature rain sounds','nature videos']:[query+' ideas',query+' videos']}));return;
 }
 res.setHeader('content-type','text/html');res.end(`<meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}*{box-sizing:border-box}${css}</style><div id="root"></div><script>${js.replaceAll('</script','<\\/script')}</script>`);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const url=`http://127.0.0.1:${server.address().port}/video`;
let browser;
try{
 browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 for(const width of [390,1280]){
  const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce',hasTouch:width===390,isMobile:width===390}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
  await page.goto(url);
  const input=page.getByRole('combobox',{name:'Search videos or paste a YouTube link'});
  const clear=page.getByRole('button',{name:'Clear search',exact:true});
  const base=completions.length;
  await input.focus();await input.pressSequentially('nature',{delay:25});
  await page.getByRole('option',{name:'nature documentary',exact:true}).waitFor();
  assert.deepEqual(completions.slice(base),['nature'],'Rapid typing produces one completion request');
  assert.equal(await input.getAttribute('aria-expanded'),'true');
  await input.press('ArrowDown');
  assert.equal(await page.getByRole('option',{name:'nature documentary',exact:true}).getAttribute('aria-selected'),'true');
  assert.equal(await input.getAttribute('aria-activedescendant'),await page.getByRole('option',{name:'nature documentary',exact:true}).getAttribute('id'));
  await input.press('Enter');
  await page.getByRole('heading',{name:'nature documentary',exact:true}).waitFor();
  assert.equal(searches.at(-1),'nature documentary');assert.equal(await input.getAttribute('aria-expanded'),'false');
  await clear.click();await input.fill('nature');await page.getByRole('option',{name:'nature sounds',exact:true}).waitFor();
  const beforeFill=searches.length;
  const fill=page.getByRole('button',{name:'Fill search with nature sounds',exact:true});
  if(width===390)await fill.tap();else await fill.click();
  assert.equal(await input.inputValue(),'nature sounds');assert.equal(searches.length,beforeFill,'Fill does not execute search');
  assert.equal(await input.evaluate(el=>document.activeElement===el),true);
  await input.press('Escape');await page.waitForTimeout(350);assert.equal(await input.getAttribute('aria-expanded'),'false');
  await input.fill('nature');await page.getByRole('option',{name:'nature documentary',exact:true}).waitFor();
  await input.press('ArrowDown');await input.press('ArrowRight');assert.equal(await input.inputValue(),'nature documentary');
  assert.equal(searches.length,beforeFill);await input.press('Escape');
  await clear.click();await input.fill('nature');await page.getByRole('option',{name:'nature sounds',exact:true}).waitFor();
  const option=page.getByRole('option',{name:'nature sounds',exact:true});
  if(width===390)await option.tap();else await option.click();
  await page.getByRole('heading',{name:'nature sounds',exact:true}).waitFor();assert.equal(searches.at(-1),'nature sounds');
  await clear.click();
  const oldRequest=page.waitForRequest(request=>request.url().endsWith('/api/video/suggestions')&&request.postDataJSON().query==='old');
  await input.fill('old');await oldRequest;await input.fill('new');await page.getByRole('option',{name:'new ideas',exact:true}).waitFor();
  await page.waitForTimeout(1000);assert.equal(await page.getByRole('option',{name:'old ideas',exact:true}).count(),0,'Stale completion cannot replace a new prefix');
  await clear.click();
  const beforeComposition=completions.length;
  await input.dispatchEvent('compositionstart');await input.fill('compose');await page.waitForTimeout(350);
  assert.equal(completions.length,beforeComposition,'IME composition does not send fragments');
  await input.dispatchEvent('compositionend');await page.getByRole('option',{name:'compose ideas',exact:true}).waitFor();
  await page.getByRole('heading',{name:/Something.*worth your time/}).click();assert.equal(await input.getAttribute('aria-expanded'),'false');
  await input.fill('offline');await page.waitForResponse(response=>response.url().endsWith('/api/video/suggestions')&&response.status()===503);
  assert.equal(await page.getByRole('listbox').count(),0);await input.press('Enter');
  await page.getByRole('heading',{name:'offline',exact:true}).waitFor();assert.equal(searches.at(-1),'offline','Ordinary search works when suggestions fail');
  await clear.click();const beforeURL=completions.length;await input.fill('https://youtu.be/dQw4w9WgXcQ');await page.waitForTimeout(350);
  assert.equal(completions.length,beforeURL,'A pasted link is never sent for completion');
  await clear.click();await input.fill('nature');await page.getByRole('option',{name:'nature sounds',exact:true}).waitFor();
  const popup=await page.locator('.video-completion-panel').boundingBox(),form=await page.locator('.video-search').boundingBox();
  assert.ok(popup.y>=0&&popup.y+popup.height<form.y,'Completion panel is above the search field and inside viewport');
  await page.evaluate(()=>{Object.defineProperty(visualViewport,'height',{value:220,configurable:true});visualViewport.dispatchEvent(new Event('resize'));});
  const keyboardPopup=await page.locator('.video-completion-panel').boundingBox();
  assert.ok(keyboardPopup.y>=0,'Suggestion panel stays on-screen above a simulated tall keyboard');
  await input.press('ArrowUp');await page.waitForFunction(()=>document.querySelector('.video-completion-scroll').scrollTop>0);
  assert.equal(await page.getByRole('option',{name:'nature videos',exact:true}).getAttribute('aria-selected'),'true');
  await page.evaluate(()=>{delete visualViewport.height;visualViewport.dispatchEvent(new Event('resize'));});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await mkdir('work/qa-video-web',{recursive:true});await page.screenshot({path:`work/qa-video-web/autocomplete-${width}.png`,fullPage:true});
  assert.deepEqual(await page.evaluate(()=>Object.keys(localStorage)),[],'Autocomplete does not persist text or history');
  await page.reload();assert.equal(await input.inputValue(),'');assert.equal(await page.getByRole('listbox').count(),0);
  assert.deepEqual(errors,[]);await page.close();
 }
 console.log('PASS: debounced completion, mouse/touch selection, fill-only arrows, keyboard navigation/ARIA, Escape/outside dismissal, IME deferral, stale responses, provider failure fallback, URL suppression and no persisted history at 390/1280px.');
}finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
