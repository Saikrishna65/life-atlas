import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
const { chromium } = createRequire(import.meta.url)('playwright');
const root = path.resolve('mobile-dist');
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
try {
  for (const width of [390, 1280]) {
    const context = await browser.newContext({ viewport: { width, height: 940 }, reducedMotion: 'reduce' }); const errors = [];
    await context.route('**/*', async route => {
      const url = new URL(route.request().url()); if (url.origin !== 'https://atlas.test' || url.pathname.startsWith('/api/')) return route.fulfill({ status: 403, body: 'Offline synthetic UI test' });
      const file = path.resolve(root, url.pathname.startsWith('/secret') ? 'index.html' : decodeURIComponent(url.pathname.slice(1))); if (!file.startsWith(root + path.sep)) return route.abort();
      try { return route.fulfill({ contentType: ({ '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' })[path.extname(file)] ?? 'application/octet-stream', body: await fs.readFile(file) }); } catch { return route.fulfill({ status: 404, body: '' }); }
    });
    const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
    await page.goto('https://atlas.test/secret/finance/shared');
    await page.getByRole('heading', { name: 'Start with your people' }).waitFor();
    await page.getByRole('button', { name: 'Create a group' }).click();
    let dialog = page.getByRole('dialog'); await dialog.getByLabel('Group name').fill('Weekend in the hills');
    await dialog.getByLabel('Other people').fill('Aarav\nMaya'); await dialog.getByRole('button', { name: 'Save', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' }); await page.getByRole('heading', { name: 'Weekend in the hills' }).waitFor();
    await page.getByRole('button', { name: 'Add expense', exact: true }).click();
    dialog = page.getByRole('dialog'); await dialog.getByLabel('What was it for?').fill('Dinner after the hike'); await dialog.getByLabel('Total (INR)').fill('900');
    await dialog.getByText('All ₹900.00 allocated.', { exact: false }).waitFor();
    const box = await dialog.boundingBox(); assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= width + 1);
    await fs.mkdir('docs/finance-shared/previews', { recursive: true }); await page.screenshot({ path: `docs/finance-shared/previews/split-${width}.png` });
    await dialog.getByRole('button', { name: 'Save', exact: true }).click(); await dialog.waitFor({ state: 'hidden' });
    assert.match(await page.locator('.shared-group').textContent(), /You get back ₹600.00/);
    await page.getByRole('button', { name: 'Edit Dinner after the hike' }).click();
    dialog = page.getByRole('dialog'); await dialog.getByLabel('Split method').selectOption('exact');
    for (const person of ['You', 'Aarav', 'Maya']) await dialog.getByLabel(`${person} share`).fill('300');
    await dialog.getByRole('button', { name: 'Save', exact: true }).click(); await dialog.waitFor({ state: 'hidden' });
    await page.locator('.shared-payment').first().getByRole('button', { name: 'Record', exact: true }).click();
    dialog = page.getByRole('dialog'); await dialog.getByLabel('Amount (INR)').fill('100'); await dialog.getByLabel('This money has already been paid.').check(); await dialog.getByRole('button', { name: 'Record payment', exact: true }).click(); await dialog.waitFor({ state: 'hidden' });
    assert.match(await page.locator('.shared-group').textContent(), /You get back ₹500.00/);
    await page.getByRole('button', { name: 'Edit Dinner after the hike' }).click(); dialog = page.getByRole('dialog');
    await dialog.getByLabel('Split method').selectOption('percentage'); await dialog.getByLabel('You percentage').fill('50'); await dialog.getByLabel('Aarav percentage').fill('25'); await dialog.getByLabel('Maya percentage').fill('25');
    await dialog.getByRole('button', { name: 'Save', exact: true }).click(); await dialog.waitFor({ state: 'hidden' }); assert.match(await page.locator('.shared-group').textContent(), /You get back ₹350.00/);
    await page.reload(); await page.locator('.shared-group').click(); await page.getByRole('heading', { name: 'Weekend in the hills' }).waitFor();
    assert.match(await page.locator('.shared-group').textContent(), /You get back ₹350.00/);
    await page.screenshot({ path: `docs/finance-shared/previews/group-${width}.png` });
    await page.getByRole('button', { name: 'Cancel Dinner after the hike' }).click(); await page.getByRole('dialog').getByRole('button', { name: 'Cancel record', exact: true }).click(); await page.getByRole('dialog').waitFor({ state: 'hidden' });
    assert.match(await page.locator('.shared-group').textContent(), /You owe ₹100.00/); await page.getByText('Cancelled · kept in history').waitFor();
    await page.getByRole('button', { name: 'Manage people' }).click(); await page.getByRole('dialog').getByLabel('Your name').fill('Alex'); await page.getByRole('dialog').getByRole('button', { name: 'Save', exact: true }).click(); await page.getByRole('dialog').waitFor({ state: 'hidden' });
    await page.getByRole('button', { name: 'Add expense', exact: true }).click(); await page.getByRole('dialog').getByLabel('What was it for?').fill('Keep this draft'); await page.evaluate(() => window.dispatchEvent(new Event('finance-shared-updated'))); assert.equal(await page.getByRole('dialog').getByLabel('What was it for?').inputValue(), 'Keep this draft');
    await page.keyboard.press('Escape'); await page.getByRole('dialog').waitFor({ state: 'hidden' });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.getByRole('button', { name: 'Add expense', exact: true }).click();
    await page.evaluate(() => window.dispatchEvent(new Event('atlas:back', { cancelable: true })));
    await page.getByRole('dialog').waitFor({ state: 'hidden' }); assert.equal(new URL(page.url()).pathname, '/secret/finance/shared');
    const counts = await page.evaluate(async () => { const db = await new Promise(resolve => { const r = indexedDB.open('life_atlas_finance_db'); r.onsuccess = () => resolve(r.result); }); return Promise.all(['accounts', 'transactions', 'shared_groups'].map(store => new Promise(resolve => { const r = db.transaction(store).objectStore(store).count(); r.onsuccess = () => resolve(r.result); }))); });
    assert.deepEqual(counts, [0, 0, 1]); assert.deepEqual(errors, []); await context.close();
    console.log(`PASS ${width}px: group creation, equal/exact/percentage splits, partial payment, expense edit, cancellation/refund balances, persistence, people rename, draft retention, Escape/native-back event, modal bounds, no overflow or page errors; bank ledger unchanged.`);
  }
} finally { await browser.close(); }
