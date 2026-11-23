import {createRequire} from 'node:module';
const {chromium} = createRequire(import.meta.url)('playwright');
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
// Run after build:mobile. Every browser request is fulfilled locally or denied.
const root = path.resolve('mobile-dist');
const browser = await chromium.launch({executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox','--disable-dev-shm-usage']});
try {
  const context = await browser.newContext({viewport: {width: 390, height: 844}, reducedMotion: 'reduce'});
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== 'https://atlas.test' || url.pathname.startsWith('/api/')) return route.fulfill({status: 403, contentType: 'application/json', body: '{"error":"Offline synthetic test: network disabled"}'});
    const relative = url.pathname.startsWith('/secret') ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
    const file = path.resolve(root, relative);
    if (!file.startsWith(root + path.sep)) return route.abort();
    const mime = {'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.jpg':'image/jpeg','.png':'image/png'};
    try { return route.fulfill({status: 200, contentType: mime[path.extname(file)] ?? 'application/octet-stream', body: await fs.readFile(file)}); }
    catch {return route.fulfill({status: 404, body: ''});}
  });
  const page = await context.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  for(const route of ['/secret/music','/secret/finance','/secret/vault']) {
    await page.goto('https://atlas.test'+route);
    const orb=page.getByRole('link',{name:'Open Atlas local assistant'});
    await orb.waitFor();
    const rect=await orb.boundingBox();assert.ok(rect&&rect.y+rect.height<844-75,'Orb clears bottom navigation');
    await orb.click();
    await page.getByRole('heading',{name:'Your assistant'}).waitFor();
    assert.equal(await page.getByRole('link',{name:'Open Atlas local assistant'}).count(),0);
    await page.getByRole('button',{name:'Back to Atlas',exact:true}).click();
    await page.waitForURL('https://atlas.test'+route);
    await page.getByRole('link',{name:'Open Atlas local assistant'}).waitFor();
    await page.evaluate(()=>{const input=document.createElement('input');input.id='keyboard-probe';document.body.append(input);input.focus();});
    await page.getByRole('link',{name:'Open Atlas local assistant'}).waitFor({state:'detached'});
    await page.evaluate(()=>document.getElementById('keyboard-probe').remove());
    await page.getByRole('link',{name:'Open Atlas local assistant'}).waitFor();
    await page.evaluate(()=>{const dialog=document.createElement('div');dialog.id='security-probe';dialog.setAttribute('data-atlas-security-screen','');document.body.append(dialog);});
    await page.getByRole('link',{name:'Open Atlas local assistant'}).waitFor({state:'detached'});
    await page.evaluate(()=>document.getElementById('security-probe').remove());
  }
  await page.goto('https://atlas.test/secret/atlas');
  await page.getByRole('heading',{name:'Your assistant'}).waitFor();
  assert.equal(await page.locator('input[type=password]').count(),0,'Browser does not offer a separate Atlas password');
  await page.getByRole('button',{name:'Open assistant',exact:true}).click();
  await page.getByRole('alert').first().waitFor();
  assert.equal(await page.getByRole('button',{name:'New conversation',exact:true}).count(),0,'Browser has no plaintext substitute for the native encrypted store');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  assert.equal(overflow,false,'Mobile layout must not overflow horizontally');
  assert.deepEqual(errors,[]);
  console.log('PASS: mobile section navigation, assistant orb visibility, no password setup or browser plaintext fallback, and responsive layout; all network blocked. Native encrypted persistence is covered separately.');
  await context.close();
} finally { await browser.close(); }
