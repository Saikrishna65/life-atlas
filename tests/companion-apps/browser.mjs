import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
const {chromium}=createRequire(import.meta.url)('playwright');
const root=path.resolve('mobile-dist');
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
try{
 for(const width of [390,1280]){
  const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
  const errors=[];let searches=0;
  await context.route('**/*',async route=>{
   const url=new URL(route.request().url());
   if(url.pathname==='/api/apps/catalog')return route.fulfill({json:{schemaVersion:1,packages:[]}});
   if(url.pathname==='/api/video/search'){
    assert.equal(route.request().method(),'POST');assert.equal(route.request().postDataJSON().query,'mountains');searches++;
    return route.fulfill({json:{videos:[{id:'dQw4w9WgXcQ',title:'UI test video fixture',channel:'Test channel',thumbnail:'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',duration:'1:23'}]}});
   }
   if(url.origin!=='https://atlas.test'||url.pathname.startsWith('/api/'))return route.fulfill({status:403,body:'Offline UI test; external playback is not simulated'});
   const relative=url.pathname.startsWith('/secret')?'index.html':decodeURIComponent(url.pathname.slice(1));const file=path.resolve(root,relative);
   if(!file.startsWith(root+path.sep))return route.abort();
   try{return route.fulfill({contentType:({'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png'})[path.extname(file)]??'application/octet-stream',body:await fs.readFile(file)})}catch{return route.fulfill({status:404,body:''})}
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto('https://atlas.test/secret/apps');await page.getByRole('heading',{name:'Atlas Video',exact:true}).waitFor();
  await page.getByRole('button',{name:'Check Android release',exact:true}).click();await page.getByText(/first signed Android release hasn’t been published/).waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await fs.mkdir('docs/atlas-apps/previews',{recursive:true});
  await page.screenshot({path:`docs/atlas-apps/previews/apps-${width}.png`});
  await page.getByRole('link',{name:'Open web player'}).click();await page.getByRole('heading',{name:'Just press play.'}).waitFor();
  await page.getByRole('textbox',{name:'Search videos or paste a YouTube link'}).fill('mountains');await page.locator('form').getByRole('button',{name:'Search',exact:true}).click();
  await page.getByRole('button',{name:'UI test video fixture'}).click();await page.locator('iframe').waitFor();
  assert.match(await page.locator('iframe').getAttribute('src'),/^https:\/\/www.youtube-nocookie.com\/embed\/dQw4w9WgXcQ\?/);assert.equal(searches,1);
  await page.getByRole('button',{name:'Close video'}).click();
  await page.getByRole('button',{name:'You',exact:true}).click();await page.getByRole('radio',{name:'Paper',exact:true}).check();
  assert.deepEqual(await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('atlas-video-web-'))),['atlas-video-web-theme']);
  await page.getByRole('button',{name:'Search',exact:true}).last().click();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.screenshot({path:`docs/atlas-apps/previews/video-${width}.png`});
  await page.reload();await page.getByRole('heading',{name:'Just press play.'}).waitFor();assert.equal(await page.getByRole('textbox',{name:'Search videos or paste a YouTube link'}).inputValue(),'');assert.equal(await page.locator('iframe').count(),0);
  assert.deepEqual(errors,[]);await context.close();
 }
 console.log('PASS Apps and Video UI at 390/1280px: navigation, empty release, search fixture, embed URL, themes, no history persistence, no overflow/page errors. Real YouTube streaming and Android installation not tested.');
}finally{await browser.close()}
