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
  await context.route('**/*',async route=>{
   const url=new URL(route.request().url());if(url.origin!=='https://atlas.test'||url.pathname.startsWith('/api/'))return route.fulfill({status:403,body:'Offline test: network denied'});
   const relative=url.pathname.startsWith('/secret')?'index.html':decodeURIComponent(url.pathname.slice(1));const file=path.resolve(root,relative);
   if(!file.startsWith(root+path.sep))return route.abort();
   try{return route.fulfill({status:200,contentType:({'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml'})[path.extname(file)]??'application/octet-stream',body:await fs.readFile(file)});}catch{return route.fulfill({status:404,body:''});}
  });
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('https://atlas.test/secret/control-room/intelligence');
  await page.getByRole('heading',{name:'Intelligence Lab'}).waitFor();
  await page.getByRole('heading',{name:'Dolphin 3.0 · 1B',exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Download',exact:true}).count(),11);
  assert.ok(await page.getByRole('button',{name:'Download',exact:true}).first().isDisabled());
  await page.getByLabel('Search models').fill('Qwen3 · 1.7B');assert.equal(await page.locator('.il-models article').count(),1);await page.getByLabel('Search models').fill('');
  await fs.mkdir('docs/local-intelligence/previews',{recursive:true});
  await page.screenshot({path:`docs/local-intelligence/previews/lab-${width===390?'mobile':'desktop'}.png`,fullPage:false});
  await page.getByRole('button',{name:'Playground',exact:true}).click();await page.getByLabel('Message',{exact:true}).fill('Hello');assert.ok(await page.getByRole('button',{name:'Send',exact:true}).isDisabled());await page.getByRole('button',{name:'Clear',exact:true}).click();
  await page.getByRole('button',{name:'Compare',exact:true}).click();await page.getByText('Evaluation cases · 100',{exact:true}).click();assert.equal(await page.locator('details').filter({hasText:'Evaluation cases · 100'}).locator('strong').count(),100);
  await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('heading',{name:'Model residency'}).waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'No horizontal overflow');
  assert.deepEqual(errors,[]);await context.close();
 }
 console.log('PASS: offline Lab at 390px and 1280px; model search, safe unavailable controls, tabs, 100-case browser, settings and no console errors. Native inference is not simulated.');
}finally{await browser.close();}
