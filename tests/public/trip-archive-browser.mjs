import { createRequire } from 'node:module';
import { readFile, mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const { chromium } = createRequire(import.meta.url)('playwright');
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
await mkdir('work/qa-trip-archive', { recursive: true });
try {
  for (const width of [1440, 390, 320]) {
    const page = await browser.newPage({ viewport: { width, height: width > 700 ? 900 : 844 }, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://videos.pexels.com/**', async route => route.fulfill({ contentType: 'video/mp4', body: await readFile('public/films/hero/highlands.mp4') }));
    await page.goto('http://localhost:3008/#memories');
    const archive = page.locator('.trip-archive');
    await archive.waitFor();
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(700);
    assert.equal(await page.locator('.world-expeditions, .featured-journey, [data-chapter="on-the-road"]').count(), 0);
    assert.equal(await archive.evaluate(el => el.closest('.world-deferred').previousElementSibling.dataset.chapter), 'collected-moments');
    assert.equal(await page.getByText('Some roads stay', { exact: false }).count(), 0);
    assert.equal(await archive.locator('.trip-archive-entry').count(), 9);
    assert.equal(await archive.locator('.trip-archive-entry h3').count(), 9);
    assert.equal(await archive.locator('.memory-film-strip').count(), 0);
    const first = archive.locator('.trip-archive-entry').first();
    assert.equal(await first.getAttribute('href'), '/trips/himalayan-journey');
    assert.match(await first.innerText(), /The Himalayan Journey/i);
    const titleBox = await first.locator('h3').boundingBox();
    const imageBox = await first.locator('.memory-image-wrap').boundingBox();
    assert.ok(titleBox.y < imageBox.y, 'Trip titles lead the cover images');
    const bounds = await first.boundingBox();
    await page.evaluate(y => window.__lenis.scrollTo(y, { immediate: true, force: true }), bounds.y + await page.evaluate(() => scrollY) - 100);
    await page.screenshot({ path: `work/qa-trip-archive/${width}.png` });
    await page.getByRole('searchbox', { name: 'Search trips' }).fill('Kyoto');
    assert.ok(await archive.locator('.trip-archive-entry').count() > 0);
    assert.ok((await archive.locator('.trip-archive-entry').allInnerTexts()).every(text => /Kyoto/i.test(text)));
    await page.getByRole('searchbox', { name: 'Search trips' }).fill('nonexistent-place-489');
    assert.equal(await archive.locator('.trip-archive-entry').count(), 0);
    await archive.getByRole('button', { name: 'Clear filters' }).click();
    assert.equal(await archive.locator('.trip-archive-entry').count(), 9);
    await page.getByRole('combobox', { name: 'Filter trips by destination' }).selectOption('Japan');
    assert.ok((await archive.locator('.trip-archive-entry').allInnerTexts()).every(text => /Tokyo|Kyoto|Fuji|Osaka/i.test(text)));
    await page.getByRole('combobox', { name: 'Filter trips by destination' }).selectOption('All places');
    await page.getByRole('combobox', { name: 'Sort trips' }).selectOption('A–Z');
    const titles = await archive.locator('.trip-archive-entry h3').allTextContents();
    assert.deepEqual(titles, [...titles].sort((a, b) => a.localeCompare(b)));
    await archive.getByRole('button', { name: 'Unfold more journeys' }).click();
    assert.equal(await archive.locator('.trip-archive-entry').count(), 18);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('world-chapter-request', { detail: 'beyond' })));
    await page.locator('.world-beyond').waitFor({ state: 'attached' });
    assert.equal(await page.locator('.world-colophon, .public-footer').count(), 0);
    const closing = await page.locator('.world-beyond').evaluate(el => ({
      padding: getComputedStyle(el).paddingBottom,
      minHeight: getComputedStyle(el).minHeight,
      margin: getComputedStyle(el.querySelector('.beyond-words')).marginBottom,
      gap: el.getBoundingClientRect().bottom - el.querySelector('.beyond-words').getBoundingClientRect().bottom,
    }));
    assert.equal(closing.padding, '0px');
    assert.equal(closing.minHeight, '0px');
    assert.equal(closing.margin, '0px');
    assert.ok(Math.abs(closing.gap) < 2, `No blank space below closing content: ${closing.gap}`);
    assert.equal(await page.locator('.world-beyond a[href="#memories"]').count(), 1);
    assert.deepEqual(errors, []);
    console.log(`PASS ${width}px: trip links, archive layout, search/empty/reset, destination filter, sorting, pagination, removed sections/footer and no page errors`);
    await page.close();
  }
} finally { await browser.close(); }
