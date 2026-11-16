import { createRequire } from 'node:module';
import { mkdir, readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const { chromium } = createRequire(import.meta.url)('playwright');
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
await mkdir('work/qa-scrapbook', { recursive: true });
try {
  for (const profile of [
    { width: 1440, height: 900, reducedMotion: 'no-preference' },
    { width: 390, height: 844, reducedMotion: 'no-preference' },
    { width: 320, height: 568, reducedMotion: 'reduce' },
  ]) {
    const page = await browser.newPage({ viewport: profile, reducedMotion: profile.reducedMotion });
    const errors = [];
    page.on('pageerror', error => errors.push(error.stack || error.message));
    await page.route('https://videos.pexels.com/**', async route => route.fulfill({ contentType: 'video/mp4', body: await readFile('public/films/hero/highlands.mp4') }));
    await page.goto('http://localhost:3008/#collected-moments');
    const section = page.locator('.travel-scrapbook');
    await section.waitFor();
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(1600);
    assert.equal(await section.locator('.scrapbook-print,.scrapbook-stage').count(), 0);
    assert.ok(await section.locator('.scrapbook-strip-item img').count()>0);
    assert.ok(await section.locator('.scrapbook-strip-item video').count()>0);
    assert.ok(await section.evaluate(el=>el.querySelector('.scrapbook-heading').compareDocumentPosition(el.querySelector('.scrapbook-strips')) & Node.DOCUMENT_POSITION_FOLLOWING),'Heading introduces the ribbon');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    const order = await page.evaluate(() => {
      const scene = document.querySelector('#collected-moments');
      return scene.closest('.world-deferred').previousElementSibling.dataset.chapter;
    });
    assert.equal(order, 'observatory');
    assert.match(await section.locator('h2').innerText(), /I GO PLACES/);
    assert.doesNotMatch(await section.locator('h2').innerText(), /WE|WITH US/);
    assert.equal(await section.locator('.scrapbook-strip').count(), 1);
    assert.equal(await section.locator('.scrapbook-topline,.scrapbook-bottomline').count(),0);
    assert.equal(await section.locator('.scrapbook-strip-group').count(), 1);
    assert.equal((await section.locator('.scrapbook-strip-item, .scrapbook-print').allInnerTexts()).join('').trim(), '');
    const strip = section.locator('.scrapbook-strip').first();
    await strip.scrollIntoViewIfNeeded();
    await page.mouse.move(0,0);
    await page.waitForTimeout(500);
    if (profile.reducedMotion === 'reduce') {
      assert.equal(await strip.getAttribute('data-curved'),'false');
      assert.equal(await strip.locator('.scrapbook-strip-item').first().evaluate(el=>getComputedStyle(el).transform),'none');
    } else {
      assert.equal(await strip.getAttribute('data-curved'),'true');
      const card=strip.locator('.scrapbook-strip-item').first();
      const start=await card.getAttribute('style');
      await page.waitForTimeout(500);
      assert.notEqual(await card.getAttribute('style'),start,'Ribbon advances continuously');
      const scales=await strip.locator('.scrapbook-strip-item').evaluateAll(cards=>cards.filter(el=>getComputedStyle(el).visibility==='visible').map(el=>el.getBoundingClientRect().height));
      assert.ok(Math.max(...scales)/Math.min(...scales)>1.2,'Edge frames grow relative to central frames');
      const bounds=await card.boundingBox();
      await page.mouse.move(bounds.x+bounds.width/2,bounds.y+bounds.height/2);
      await page.waitForTimeout(200);
      const held=await card.getAttribute('style');
      await page.waitForTimeout(300);
      assert.equal(await card.getAttribute('style'),held,'Hover pauses the ribbon');
      const stripBounds=await strip.boundingBox();
      await page.mouse.move(stripBounds.x+stripBounds.width/2,stripBounds.y+8);
      await page.waitForTimeout(500);
      assert.notEqual(await card.getAttribute('style'),held,'Empty space inside the strip does not pause it');
      await page.mouse.move(0,0);
    }
    await strip.screenshot({path:`work/qa-scrapbook/ribbon-${profile.width}.png`});
    await page.getByRole('button', { name: 'Pause films & strip' }).click();
    await strip.scrollIntoViewIfNeeded();
    assert.ok(await strip.locator('video').evaluateAll(videos=>videos.every(video=>video.paused)),'Global pause stops ribbon films');
    await section.screenshot({ path: `work/qa-scrapbook/${profile.width}.png`, timeout:30000 });
    const photoIndex=await strip.locator('.scrapbook-strip-item').evaluateAll(cards=>cards.findIndex(el=>{const r=el.getBoundingClientRect();return el.querySelector('img') && getComputedStyle(el).visibility!=='hidden' && r.left+r.width/2>20 && r.left+r.width/2<innerWidth-20;}));
    assert.ok(photoIndex>=0);
    const first=strip.locator('.scrapbook-strip-item').nth(photoIndex);
    await first.click();
    const dialog=page.getByRole('dialog');
    await dialog.waitFor();
    const before=await dialog.innerText();
    await page.keyboard.press('ArrowRight');
    assert.notEqual(await dialog.innerText(),before);
    for(let i=0;i<30 && await dialog.locator('video').count()===0;i++) await page.keyboard.press('ArrowRight');
    assert.equal(await dialog.locator('video[controls][autoplay]').count(),1,'Films remain reachable through the viewer');
    await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('dialog').count(),0);
    assert.ok(await first.evaluate(el=>document.activeElement===el),'Viewer restores ribbon focus');
    assert.deepEqual(errors, []);
    console.log(`PASS ${profile.width}x${profile.height} ${profile.reducedMotion}: heading-first composition, curved ribbon, photo viewer, keyboard navigation, film controls, dismissal, overflow and page errors`);
    await page.close();
  }
} finally { await browser.close(); }
