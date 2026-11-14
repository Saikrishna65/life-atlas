import { createRequire } from 'node:module';
import { mkdir, readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const { chromium } = createRequire(import.meta.url)('playwright');
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
await mkdir('work/qa-featured-journey', { recursive: true });
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
    if (profile.width === 320) await page.route('https://tile.openstreetmap.org/**', route => route.abort());
    await page.goto('http://localhost:3008/#on-the-road');
    const section = page.locator('.featured-journey');
    await section.waitFor();
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(2500);
    const landing = await section.evaluate(el => el.getBoundingClientRect().top);
    assert.ok(Math.abs(landing - 74) < 12, `Deep link must remain aligned after deferred scenes load: ${landing}`);
    assert.equal(await section.locator('.featured-stop').count(), 3);
    assert.equal(await page.locator('.atlas-passage').count(), 0);
    assert.equal(await section.evaluate(el => el.closest('.world-deferred').previousElementSibling.dataset.chapter), 'collected-moments');
    await section.evaluate(el => window.__lenis.scrollTo(window.scrollY + el.getBoundingClientRect().top - 74, { immediate: true, force: true }));
    if (profile.reducedMotion !== 'reduce') await page.waitForFunction(() => { const video = document.querySelector('.featured-cover video'); return video && video.currentTime > 0 && !video.paused; });
    await section.locator('.featured-cover').screenshot({ path: `work/qa-featured-journey/cover-${profile.width}.png` });
    await section.getByRole('button', { name: 'Follow the journey' }).click();
    await section.locator('.featured-leaflet').waitFor();
    await section.locator('.featured-route-drawn').first().waitFor({ state: 'attached' });
    await page.waitForTimeout(1300);
    assert.equal(await section.locator('.featured-leaflet').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(28, 45, 35)');
    await section.locator('.featured-map-sticky').screenshot({ path: `work/qa-featured-journey/map-${profile.width}.png` });
    const start = await section.evaluate(el => Number(getComputedStyle(el).getPropertyValue('--journey-route-progress')));
    await section.locator('.featured-stop-nav button').last().click();
    await page.waitForTimeout(1800);
    assert.match(await section.locator('.featured-stop-nav button[aria-current="step"]').innerText(), /03\s*Chandrashila/);
    const end = await section.evaluate(el => Number(getComputedStyle(el).getPropertyValue('--journey-route-progress')));
    if (profile.reducedMotion !== 'reduce') assert.ok(end > start, `Route must advance with scroll: ${start} -> ${end}`);
    else assert.equal(end, 1);
    const mapPosition = await section.locator('.featured-map-sticky').evaluate(el => getComputedStyle(el).position);
    assert.equal(mapPosition, profile.width > 800 && profile.reducedMotion !== 'reduce' ? 'sticky' : 'relative');
    if (profile.width === 320) assert.match(await section.locator('.featured-map-offline').innerText(), /unavailable/);
    await page.screenshot({ path: `work/qa-featured-journey/story-${profile.width}.png` });
    await section.locator('.featured-stop-photo').last().click();
    await page.getByRole('dialog').waitFor();
    assert.match(await page.getByRole('dialog').innerText(), /Chandrashila/i);
    await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('dialog').count(), 0);
    assert.equal(await section.getByRole('link', { name: 'Explore this journey' }).getAttribute('href'), '/trips/himalayan-journey');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No horizontal overflow');
    assert.deepEqual(errors, []);
    console.log(`PASS ${profile.width}x${profile.height}: cover film, placement, route drawing, stop navigation, map layout, viewer, trip link, reduced motion/offline fallback and no page errors`);
    await page.close();
  }
} finally { await browser.close(); }
