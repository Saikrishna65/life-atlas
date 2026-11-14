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
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://videos.pexels.com/**', async route => route.fulfill({ contentType: 'video/mp4', body: await readFile('public/films/hero/highlands.mp4') }));
    await page.goto('http://localhost:3008/#collected-moments');
    const section = page.locator('.travel-scrapbook');
    await section.waitFor();
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(1600);
    assert.equal(await section.locator('.scrapbook-print').count(), 8);
    assert.equal(await section.locator('.scrapbook-film').count(), 3);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    const order = await page.evaluate(() => {
      const scene = document.querySelector('#collected-moments');
      return scene.closest('.world-deferred').previousElementSibling.dataset.chapter;
    });
    assert.equal(order, 'observatory');
    await section.screenshot({ path: `work/qa-scrapbook/${profile.width}.png`, timeout: 30000 });
    const first = section.locator('.scrapbook-print').first();
    await first.click();
    await page.getByRole('dialog').waitFor();
    assert.match(await page.getByRole('dialog').innerText(), /The long way up/i);
    await page.keyboard.press('ArrowRight');
    assert.match(await page.getByRole('dialog').innerText(), /Before the world wakes/i);
    await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('dialog').count(), 0);
    await section.locator('.scrapbook-film').first().click();
    assert.equal(await page.getByRole('dialog').locator('video[controls]').count(), 1);
    assert.equal(await page.getByRole('dialog').locator('video[autoplay]').count(), 0);
    await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('dialog').count(), 0);
    const images = await section.locator('img').evaluateAll(images => images.every(image => image.complete && image.naturalWidth > 0));
    assert.ok(images, 'Collage images must load');
    assert.deepEqual(errors, []);
    console.log(`PASS ${profile.width}x${profile.height} ${profile.reducedMotion}: placement, 8 frames, images, photo viewer, keyboard navigation, film controls, dismissal, overflow and page errors`);
    await page.close();
  }
} finally { await browser.close(); }
