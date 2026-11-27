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
   const url = new URL(route.request().url()); if (url.origin !== 'https://atlas.test' || url.pathname.startsWith('/api/')) return route.fulfill({ status: 403, body: 'Offline synthetic split test' });
   const file = path.resolve(root, url.pathname.startsWith('/secret') ? 'index.html' : decodeURIComponent(url.pathname.slice(1))); if (!file.startsWith(root + path.sep)) return route.abort();
   try { return route.fulfill({ contentType: ({ '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' })[path.extname(file)] ?? 'application/octet-stream', body: await fs.readFile(file) }); } catch { return route.fulfill({ status: 404, body: '' }); }
  });
  const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
  await page.goto('https://atlas.test/secret/finance'); await page.getByRole('heading', { name: 'Atlas Finance', exact: true }).waitFor();
  await page.waitForFunction(() => document.querySelector('.atlas-finance')?.getAttribute('aria-busy') === 'false');
  await page.evaluate(async () => {
   const db = await new Promise(resolve => { const r = indexedDB.open('life_atlas_finance_db'); r.onsuccess = () => resolve(r.result); }); const now = new Date().toISOString();
   await new Promise((resolve, reject) => { const tx = db.transaction(['accounts', 'shared_groups'], 'readwrite'); tx.objectStore('accounts').put({ id: 'room-bank', name: 'Room bank', accountType: 'bank', currency: 'INR', status: 'active', openingBalancePaise: 500000, currentBalancePaise: 500000, openingBalanceDate: now, createdAt: now, updatedAt: now, version: 1 }); tx.objectStore('shared_groups').put({ schemaVersion: 1, id: 'room', title: 'Room expenses', currency: 'INR', selfId: 'me', members: [{ id: 'me', name: 'You' }, { id: 'friend', name: 'Ravi' }], expenses: [], settlements: [], createdAt: now, updatedAt: now, version: 1 }); tx.oncomplete = resolve; tx.onabort = () => reject(tx.error); }); db.close(); window.dispatchEvent(new Event('finance-ledger-updated'));
  });
  await page.getByText('Room bank', { exact: true }).first().waitFor();
  async function choose(label, option) { await page.getByRole('combobox', { name: label, exact: true }).click(); await page.getByRole('option', { name: option }).click(); }
  await page.getByRole('button', { name: 'Your approval inbox', exact: true }).click();
  await page.getByRole('dialog').locator('.review-more summary').click(); await page.getByRole('button', { name: 'Paste a message', exact: true }).click();
  await page.getByRole('dialog').locator('textarea').fill('Debited Rs. 1000.00 from Kotak Bank A/c ...XX1234 to GROCERY via UPI. Ref: 429182736451 on 27-Nov-26. Avl Bal: Rs 4,000.00');
  await page.getByRole('button', { name: 'Parse Transaction', exact: true }).click(); await page.getByRole('combobox', { name: 'Payment account', exact: true }).waitFor();
  await choose('Payment account', /Room bank/); await choose('Payment category', 'Groceries'); await choose('Split with', /Room expenses/);
  await page.getByText('Ravi · ₹500.00', { exact: true }).waitFor();
  await page.screenshot({ path: `docs/finance-split-review/previews/approve-${width}.png` });
  await page.getByRole('button', { name: 'Confirm & Record into Ledger', exact: true }).click(); await page.getByText(/Transaction recorded into ledger/).waitFor();
  await page.getByRole('button', { name: 'Close message import', exact: true }).click();
  await page.getByRole('tab', { name: 'Activity', exact: true }).click(); await page.locator('.af-activity-row').filter({ hasText: /Grocery/i }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: 'Edit', exact: true }).click(); await page.getByRole('dialog').getByLabel('Amount', { exact: true }).fill('800');
  await page.getByRole('button', { name: 'Save Correction', exact: true }).click(); await page.getByRole('dialog').waitFor({ state: 'hidden' });
  await page.getByRole('tab', { name: 'Overview', exact: true }).click(); await page.getByRole('button', { name: 'Add transaction', exact: true }).click();
  await page.getByRole('dialog').getByLabel('Amount', { exact: true }).fill('200'); await page.getByPlaceholder('e.g. Groceries at Zepto, Train Ticket').fill('Shared vegetables'); await choose('Select: Uncategorized', 'Groceries'); await choose('Split with', /Room expenses/);
  await page.getByRole('button', { name: 'Record Transaction', exact: true }).click(); await page.getByRole('dialog').waitFor({ state: 'hidden' });
  await page.goto('https://atlas.test/secret/finance/shared'); await page.locator('.shared-group').filter({ hasText: 'Room expenses' }).click();
  assert.match(await page.locator('.shared-group').textContent(), /You get back ₹500.00/); assert.equal(await page.locator('.shared-record').count(), 2); assert.equal(await page.getByRole('button', { name: /^Edit Grocery/i }).count(), 0);
  await page.screenshot({ path: `docs/finance-split-review/previews/group-${width}.png` });
  await page.goto('https://atlas.test/secret/finance'); await page.getByRole('tab', { name: 'Activity', exact: true }).click(); await page.locator('.af-activity-row').filter({ hasText: /Grocery/i }).first().click(); await page.getByRole('dialog').getByRole('button', { name: 'Edit', exact: true }).click();
  await choose('Split with', 'Just me'); await page.getByRole('button', { name: 'Save Correction', exact: true }).click(); await page.getByRole('dialog').waitFor({ state: 'hidden' });
  const data = await page.evaluate(async () => { const db = await new Promise(resolve => { const r = indexedDB.open('life_atlas_finance_db'); r.onsuccess = () => resolve(r.result); }); return Promise.all(['accounts', 'transactions', 'shared_groups'].map(store => new Promise(resolve => { const r = db.transaction(store).objectStore(store).getAll(); r.onsuccess = () => resolve(r.result); }))); });
  assert.equal(data[1].length, 2); assert.equal(data[0][0].currentBalancePaise, 400000); assert.equal(data[2][0].expenses.filter(e => !e.voidedAt).length, 1); assert.equal(data[2][0].expenses.filter(e => e.voidedAt).length, 1);
  await page.evaluate(async () => {
   const db = await new Promise(resolve => { const r = indexedDB.open('life_atlas_finance_db'); r.onsuccess = () => resolve(r.result); }); const now = new Date().toISOString();
   await new Promise(resolve => { const tx = db.transaction('transactions', 'readwrite'); tx.objectStore('transactions').put({ id: 'needs-category', accountId: 'room-bank', currency: 'INR', amountPaise: 30000, status: 'posted', direction: 'outflow', source: 'manual', description: 'Room electricity', occurredAt: now, createdAt: now, updatedAt: now, version: 1, reviewRequired: true }); tx.oncomplete = resolve; }); db.close(); window.dispatchEvent(new Event('finance-ledger-updated'));
  });
  await page.getByRole('tab', { name: 'Overview', exact: true }).click(); await page.locator('.af-utility-section>summary').click(); await page.getByRole('button', { name: /Category rules/ }).click();
  await page.getByRole('dialog', { name: 'Categories & rules' }).waitFor(); await choose('Category for Room electricity', 'Utilities & Bills'); await choose('Split with', /Room expenses/); await page.getByRole('button', { name: 'Save review', exact: true }).click();
  await page.getByText('Category and split saved.', { exact: true }).waitFor(); await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false); assert.deepEqual(errors, []); await context.close();
  console.log(`PASS ${width}px: pasted bank approval with category + equal split, live preview, correction propagation, manual expense split, group persistence/source controls, Just me cancellation, category-review category + split save, no duplicate bank spending, no overflow/page errors. Synthetic data only.`);
 }
} finally { await browser.close(); }
