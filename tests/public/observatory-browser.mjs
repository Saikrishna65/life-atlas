import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)('playwright');
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--enable-unsafe-swiftshader']});
await mkdir('work/qa-observatory',{recursive:true});
try {
 for(const profile of [{width:1440,height:900},{width:390,height:844},{width:1366,height:900,fallback:true}]) {
  const page=await browser.newPage({viewport:profile,reducedMotion:profile.fallback?'reduce':'no-preference'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  if(profile.fallback) await page.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return /webgl/.test(type)?null:original.call(this,type,...args);};});
  await page.goto('http://localhost:3008/#observatory');
  const section=page.locator('#observatory.observatory-v2');await section.waitFor();
  assert.equal(await section.locator('.observatory-browser,.observatory-destination-list,.observatory-pagination').count(),0);
  assert.equal(await section.getByRole('searchbox').count(),0);
  assert.equal(await section.locator('.observatory-stars').count(),0,'Fixed decorative dots are removed');
  if(profile.fallback) await section.getByText('The map is taking a rest. Explore the destinations beside it.').waitFor();
  else await section.locator('.observatory-core canvas').waitFor({timeout:45000});
  const first=await section.locator('.observatory-focus h3').innerText();
  const next=section.getByRole('button',{name:'Next place',exact:true});
  await next.click();
  assert.notEqual(await section.locator('.observatory-focus h3').innerText(),first);
  await section.getByRole('button',{name:'Previous place',exact:true}).click();
  assert.equal(await section.locator('.observatory-focus h3').innerText(),first);
  await next.focus();await page.keyboard.press('Enter');
  assert.notEqual(await section.locator('.observatory-focus h3').innerText(),first);
  assert.match(await section.getByRole('link',{name:/Open the journey/}).getAttribute('href'),/^\/trips\//);
  for(let i=0;i<3;i++) await next.click();
  if(!profile.fallback) assert.equal(await section.locator('.observatory-core canvas').count(),1,'Place stepping retains a single globe renderer');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await section.screenshot({path:`work/qa-observatory/clean-${profile.fallback?'fallback':profile.width}.png`});
  assert.deepEqual(errors,[]);
  console.log(`PASS ${profile.width}${profile.fallback?' fallback':''}: removed directory, original globe, place stepping, keyboard, journey links, overflow, no page errors`);
  await page.close();
 }
} finally {await browser.close();}
