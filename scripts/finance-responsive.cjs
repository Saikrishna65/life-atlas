const { chromium } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
(async () => {
  fs.mkdirSync('finance-qa', { recursive: true });
  const browser = await chromium.launch({ headless: true });
  let activePage;
  try {
    for (const width of [320, 390, 768, 1280]) {
      const page = await browser.newPage({ viewport: { width, height: 900 }, hasTouch: width <= 768, isMobile: width <= 600, reducedMotion: 'reduce' });
      activePage = page;
      page.on('pageerror', error => console.error('BROWSER ERROR:', error.message));
      page.on('console', message => { if (message.type() === 'error') console.error('BROWSER CONSOLE:', message.text()); });
      await page.goto('http://localhost:3001/secret/finance', { waitUntil: 'networkidle', timeout: 120000 });
      await page.getByRole('heading', { name: 'Atlas Finance', exact: true }).waitFor();
      await page.locator('.atlas-finance[aria-busy="false"]').waitFor({ timeout: 60000 });
      await page.screenshot({ path: `finance-qa/initial-${width}.png`, fullPage: true });
      await page.getByTitle('Add a new bank, cash, or credit account').click();
      await page.getByPlaceholder('e.g. HDFC Salary Account, Emergency Fund').fill('Kotak QA');
      await page.getByPlaceholder('e.g. SBI, ICICI').fill('Kotak');
      await page.getByPlaceholder('e.g. 4092').fill('1234');
      await page.getByRole('button', { name: 'Create Account', exact: true }).click();
      await page.getByRole('dialog').waitFor({ state: 'hidden' });
      const overflow = () => page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      assert.equal(await overflow(), false, `Overview overflows at ${width}`);
      await page.screenshot({ path: `finance-qa/overview-${width}.png`, fullPage: true });
      for (const tab of ['Activity', 'Budgets', 'Goals', 'Accounts']) {
        await page.getByRole('tab', { name: tab, exact: true }).click();
        assert.equal(await overflow(), false, `${tab} overflows at ${width}`);
      }
      await page.getByRole('tab', { name: 'Activity', exact: true }).click();
      const select = page.getByRole('combobox', { name: 'Filter account', exact: true });
      await select.click();
      const menu = page.getByRole('listbox');
      await menu.waitFor();
      const box = await menu.boundingBox();
      assert.ok(box.x >= 0 && box.x + box.width <= width + 1, `Dropdown outside viewport at ${width}`);
      await page.screenshot({ path: `finance-qa/dropdown-${width}.png`, fullPage: true });
      await select.press('ArrowDown');
      await select.press('Enter');
      assert.equal(await menu.count(), 0, 'Dropdown should close after keyboard selection');
      await select.click();
      const option = page.getByRole('option', { name: 'All Accounts', exact: true });
      if (width <= 600) await option.tap(); else await option.click();
      assert.equal(await menu.count(), 0, 'Dropdown should close after tapping an option');
      await page.getByRole('tab', { name: 'Overview', exact: true }).click();
      await page.getByRole('button', { name: 'Your approval inbox' }).click();
      await page.getByRole('heading', { name: 'Bank messages', exact: true }).waitFor();
      assert.equal(await overflow(), false, `Message dialog overflows at ${width}`);
      await page.screenshot({ path: `finance-qa/messages-${width}.png`, fullPage: true });
      await page.keyboard.press('Escape');
      assert.equal(await page.getByRole('dialog').count(), 0);
      await page.close();
      console.log(`Finance viewport ${width}: passed overview, tabs, dropdown keyboard selection, and message dialog`);
    }
  } catch (error) {
    if (activePage) {
      const screenshot = await activePage.screenshot({ path: 'finance-qa/failure.png', fullPage: true });
      const encoded = screenshot.toString('base64');
      for (let offset = 0; offset < encoded.length; offset += 16000) console.log(`ATLAS_QA_IMAGE_${String(offset / 16000).padStart(4, '0')}=${encoded.slice(offset, offset + 16000)}`);
      fs.writeFileSync('finance-qa/failure.html', await activePage.content());
      console.error('VISIBLE PAGE:', (await activePage.locator('body').innerText()).slice(-6000));
    }
    throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
