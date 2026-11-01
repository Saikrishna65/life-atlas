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
      if (width === 390 || width === 1280) {
        const preview = (await page.screenshot({ type: 'jpeg', quality: 75 })).toString('base64');
        for (let offset = 0; offset < preview.length; offset += 16000) console.log(`ATLAS_PREVIEW_${width}_${String(offset / 16000).padStart(4, '0')}=${preview.slice(offset, offset + 16000)}`);
      }
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
    for (const width of [390, 1280]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      activePage = page;
      await page.goto('http://localhost:3001/secret/finance?demo=1', { waitUntil: 'networkidle', timeout: 120000 });
      await page.locator('.atlas-finance[aria-busy="false"]').waitFor({ timeout: 60000 });
      await page.getByText('Demo workspace', { exact: true }).waitFor();
      await page.getByRole('tab', { name: 'Accounts', exact: true }).click();
      assert.equal(await page.locator('.af-account-grid .af-account').count(), 4);
      await page.getByRole('tab', { name: 'Goals', exact: true }).click();
      assert.equal(await page.locator('.af-goal').count(), 3);
      await page.getByRole('tab', { name: 'Budgets', exact: true }).click();
      assert.ok(await page.locator('.af-plan').count() >= 3);
      await page.getByRole('tab', { name: 'Overview', exact: true }).click();
      for (const [id, name] of [['ocean','Ocean teal'],['royal','Royal blue'],['emerald','Emerald'],['graphite','Warm graphite']]) {
        await page.locator('.finance-theme-picker summary').click();
        await page.getByRole('button', { name, exact: true }).click();
        assert.equal(await page.locator('.atlas-finance').getAttribute('data-finance-theme'), id);
        await page.waitForFunction(theme => document.documentElement.dataset.financeTheme === theme, id);
        await page.locator('.finance-theme-picker summary').click();
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `${name} overflows`);
        await page.screenshot({ path: `finance-qa/theme-${id}-${width}.png`, fullPage: true });
      }
      await page.reload({ waitUntil: 'networkidle' });
      await page.locator('.atlas-finance[aria-busy="false"]').waitFor({ timeout: 60000 });
      assert.equal(await page.locator('.atlas-finance').getAttribute('data-finance-theme'), 'graphite', 'Theme must persist after reload');
      await page.locator('.finance-theme-picker summary').click();
      await page.getByRole('button', { name: 'Ocean teal', exact: true }).click();
      await page.locator('.finance-theme-picker summary').click();
      console.log(`Theme viewport ${width}: all four palettes switched without overflow; selection survived reload`);
      await page.getByRole('button', { name: 'Bank', exact: true }).click();
      await page.getByText('Bank balance', { exact: true }).waitFor();
      await page.getByRole('button', { name: 'Savings', exact: true }).click();
      await page.getByText('Savings balance', { exact: true }).waitFor();
      await page.getByRole('button', { name: 'All accounts', exact: true }).click();
      const typography = await page.evaluate(() => ['.glass-flow small', '.af-entry-description small', '.balance-panel-content>div>p'].map(selector => {
        const node = document.querySelector(selector); const style = getComputedStyle(node);
        const luminance = color => {const rgb=color.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];};
        let parent=node, background='rgb(16, 24, 34)';
        while(parent){const bg=getComputedStyle(parent).backgroundColor;if(bg!=='transparent' && !bg.endsWith(', 0)')){background=bg;break;}parent=parent.parentElement;}
        const fg=luminance(style.color), bg=luminance(background);
        return {selector,size:parseFloat(style.fontSize),contrast:(Math.max(fg,bg)+.05)/(Math.min(fg,bg)+.05)};
      }));
      for (const item of typography) { assert.ok(item.size >= 12, `${item.selector} is too small`); assert.ok(item.contrast >= 4.5, `${item.selector} has low contrast`); }
      await page.evaluate(() => window.scrollTo(0,0));
      await page.screenshot({ path: `finance-qa/reference-overview-${width}.png`, fullPage: true });
      const home = (await page.screenshot({ type: 'jpeg', quality: 80 })).toString('base64');
      for (let offset = 0; offset < home.length; offset += 16000) console.log(`ATLAS_HOME_${width}_${String(offset / 16000).padStart(4, '0')}=${home.slice(offset, offset + 16000)}`);
      await page.getByRole('button', { name: 'Your approval inbox' }).click();
      await page.locator('.finance-review-card').first().waitFor();
      assert.equal(await page.locator('.finance-review-card').count(), 3);
      await page.screenshot({ path: `finance-qa/demo-inbox-${width}.png`, fullPage: true });
      const preview = (await page.screenshot({ type: 'jpeg', quality: 75 })).toString('base64');
      for (let offset = 0; offset < preview.length; offset += 16000) console.log(`ATLAS_INBOX_${width}_${String(offset / 16000).padStart(4, '0')}=${preview.slice(offset, offset + 16000)}`);
      await page.getByRole('button', { name: 'Approve transaction', exact: true }).first().click();
      await page.waitForFunction(() => document.querySelectorAll('.finance-review-card').length === 2);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
      await page.keyboard.press('Escape');
      await page.close();
      console.log(`Demo viewport ${width}: passed populated accounts, goals, budgets and approval inbox`);
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
