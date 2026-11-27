import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
const { chromium } = createRequire(import.meta.url)('playwright');
const root = path.resolve('mobile-dist');
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
try {
 for (const width of [390, 1280]) {
  const context = await browser.newContext({ viewport: { width, height: 940 }, reducedMotion: 'reduce', timezoneId: 'Asia/Kolkata' }); const errors = [];
  await context.route('**/*', async route => {
   const url = new URL(route.request().url()); if (url.origin !== 'https://atlas.test' || url.pathname.startsWith('/api/')) return route.fulfill({ status: 403, body: 'Offline synthetic monthly review test' });
   const file = path.resolve(root, url.pathname.startsWith('/secret') ? 'index.html' : decodeURIComponent(url.pathname.slice(1))); if (!file.startsWith(root + path.sep)) return route.abort();
   try { return route.fulfill({ contentType: ({ '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' })[path.extname(file)] ?? 'application/octet-stream', body: await fs.readFile(file) }); } catch { return route.fulfill({ status: 404, body: '' }); }
  });
  const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
  await page.clock.install({ time: new Date('2026-11-26T12:00:00Z') });
  await page.goto('https://atlas.test/secret/finance/review'); await page.getByRole('heading', { name: 'No recorded activity for this month.' }).waitFor();
  assert.equal(await page.getByLabel('Next month', { exact: true }).isDisabled(), true);
  await page.evaluate(async () => {
   const db = await new Promise((resolve, reject) => { const r = indexedDB.open('life_atlas_finance_db'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
   const date = '2026-11-10T10:00:00Z', account = { id: 'synthetic-bank', name: 'Synthetic bank', accountType: 'bank', currency: 'INR', status: 'active', openingBalancePaise: 1000000, currentBalancePaise: 1000000, openingBalanceDate: date, createdAt: date, updatedAt: date, version: 1 };
   const transaction = (id, amountPaise, extra = {}) => ({ id, accountId: account.id, currency: 'INR', status: 'posted', direction: 'outflow', source: 'manual', amountPaise, categoryId: 'cat_food_dining', description: id, occurredAt: date, createdAt: date, updatedAt: date, version: 1, reviewRequired: false, ...extra });
   const rows = [transaction('Cafe River', 200000, { merchant: 'Cafe River' }), transaction('Annual bill payment', 40000, { paymentKind: 'automatic_bill', recurringRuleId: 'annual', categoryId: 'cat_housing_rent' }), transaction('Check this payment', 10000, { reviewRequired: true }), transaction('Refund', 20000, { direction: 'inflow', paymentKind: 'refund' }), transaction('Salary', 500000, { direction: 'inflow' }), transaction('USD only', 9900, { currency: 'USD' }), transaction('Hold', 50000, { status: 'pending' }), transaction('Own transfer', 200000, { transferGroupId: 'own' }), ...[1, 5, 10].map(day => transaction(`History ${day}`, 20000, { occurredAt: `2026-10-${String(day).padStart(2, '0')}T10:00:00Z`, merchant: 'Cafe River' })), transaction('Late October', 900000, { occurredAt: '2026-10-30T10:00:00Z' })];
   await new Promise((resolve, reject) => { const tx = db.transaction(['accounts', 'transactions', 'recurring_rules'], 'readwrite'); tx.objectStore('accounts').put(account); for (const row of rows) tx.objectStore('transactions').put(row); tx.objectStore('recurring_rules').put({ id: 'annual', accountId: account.id, currency: 'INR', direction: 'outflow', amountPaise: 120000, frequency: 'yearly', interval: 1, startDate: '2026-01-01T10:00:00Z', nextDueDate: '2027-01-01T10:00:00Z', description: 'Annual subscription', autoPost: false, status: 'confirmed', createdAt: date, updatedAt: date }); tx.oncomplete = resolve; tx.onabort = () => reject(tx.error); }); db.close(); window.dispatchEvent(new Event('finance-ledger-updated'));
  });
  await page.waitForFunction(() => document.querySelector('.mr-hero h2')?.textContent === '₹2,300.00');
  assert.match(await page.locator('.mr-change').textContent(), /₹1,700.00 more/);
  assert.match(await page.locator('.mr-quality').textContent(), /1 pending entry and 1 transfer excluded/);
  assert.equal(await page.locator('.mr-flags details').count(), 2);
  await page.locator('.mr-flags summary').first().click(); await page.getByText(/At least 3× your earlier merchant median/).waitFor();
  assert.match(await page.locator('.mr-regular-total strong').textContent(), /₹400.00/);
  await page.locator('.mr-commitments summary').click(); assert.match(await page.locator('.mr-commitments summary').textContent(), /₹100.00/);
  await page.screenshot({ path: `docs/finance-monthly/previews/review-${width}.png`, fullPage: true });
  const before = await page.evaluate(async () => { const db = await new Promise(resolve => { const r = indexedDB.open('life_atlas_finance_db'); r.onsuccess = () => resolve(r.result); }); const stores = ['accounts', 'transactions', 'recurring_rules', 'audit_log', 'sync_outbox']; return Promise.all(stores.map(store => new Promise(resolve => { const r = db.transaction(store).objectStore(store).getAll(); r.onsuccess = () => resolve(JSON.stringify(r.result)); }))); });
  await page.getByRole('button', { name: 'Previous month', exact: true }).click(); await page.waitForFunction(() => document.querySelector('.mr-hero h2')?.textContent === '₹9,600.00');
  await page.getByRole('button', { name: 'Next month', exact: true }).click(); await page.waitForFunction(() => document.querySelector('.mr-hero h2')?.textContent === '₹2,300.00');
  await page.getByLabel('Currency', { exact: true }).selectOption('USD'); await page.waitForFunction(() => document.querySelector('.mr-hero h2')?.textContent === '$99.00'); assert.equal(await page.locator('.mr-flags details').count(), 0);
  await page.getByLabel('Currency', { exact: true }).selectOption('INR'); await page.getByRole('button', { name: 'Refresh', exact: true }).click(); await page.waitForFunction(() => document.querySelector('.mr-header button')?.textContent === 'Refresh');
  const after = await page.evaluate(async () => { const db = await new Promise(resolve => { const r = indexedDB.open('life_atlas_finance_db'); r.onsuccess = () => resolve(r.result); }); return Promise.all(['accounts', 'transactions', 'recurring_rules', 'audit_log', 'sync_outbox'].map(store => new Promise(resolve => { const r = db.transaction(store).objectStore(store).getAll(); r.onsuccess = () => resolve(JSON.stringify(r.result)); }))); });
  assert.deepEqual(after, before, 'Review never changes finance records');
  await context.grantPermissions(['clipboard-read', 'clipboard-write']); await page.getByRole('button', { name: 'Copy summary', exact: true }).click(); await page.getByRole('status').filter({ hasText: 'Review copied.' }).waitFor(); assert.match(await page.evaluate(() => navigator.clipboard.readText()), /Recorded spending: ₹2,300.00/);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false); assert.deepEqual(errors, []); await context.close();
  console.log(`PASS ${width}px: empty review, accurate totals and MTD comparison, category/regular-bill details, explained unusual payments, monthly equivalent, month/currency navigation, refresh, clipboard summary; no record mutations, overflow or page errors. Synthetic data only.`);
 }
} finally { await browser.close(); }
