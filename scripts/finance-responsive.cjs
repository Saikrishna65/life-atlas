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
      await page.locator('.finance-theme-picker summary').click();
      const themeIcon=await page.locator('.header-appearance summary').boundingBox();
      const bellIcon=await page.locator('.glass-bell').boundingBox();
      const themeGlyph=await page.locator('.header-appearance summary>svg').boundingBox();
      assert.ok(Math.abs(themeGlyph.x+themeGlyph.width/2-themeIcon.x-themeIcon.width/2)<1,'Theme symbol must be horizontally centred');
      assert.ok(Math.abs(themeGlyph.y+themeGlyph.height/2-themeIcon.y-themeIcon.height/2)<1,'Theme symbol must be vertically centred');

      assert.ok(Math.abs(themeIcon.y+themeIcon.height/2-bellIcon.y-bellIcon.height/2)<1,'Header icons must align');
      const appearanceBounds = await page.locator('.finance-theme-popover').boundingBox();
      assert.ok(appearanceBounds.x >= 0 && appearanceBounds.x + appearanceBounds.width <= width + 1, `Appearance menu outside viewport at ${width}`);
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('.finance-theme-picker[open]').count(), 0);

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
    for (const width of [320, 390, 1280]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      activePage = page;
      await page.goto('http://localhost:3001/secret/finance?demo=1', { waitUntil: 'networkidle', timeout: 120000 });
      await page.locator('.atlas-finance[aria-busy="false"]').waitFor({ timeout: 60000 });
      await page.getByText('Demo workspace', { exact: true }).waitFor();
      assert.equal(await page.locator('.expense-insights').getAttribute('data-period'),'THIS_WEEK');
      assert.deepEqual(await page.locator('.expense-labels .cash-date').allTextContents(),['Mon','Tue','Wed','Thu','Fri','Sat','Sun']);
      assert.equal(await page.locator('.expense-stores').count(),0,'Top stores should be removed');
      assert.equal(await page.getByRole('combobox',{name:'Reporting period',exact:true}).count(),0,'Remove the redundant Insights dropdown');
      assert.equal(await page.locator('.af-account-strip').evaluate(node=>getComputedStyle(node).scrollbarWidth),'none');

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
      const typography = await page.evaluate(() => ['.glass-flow small', '.af-entry-description small', '.glass-insight small'].map(selector => {
        const node = document.querySelector(selector); const style = getComputedStyle(node);
        const luminance = color => {const rgb=color.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];};
        let parent=node, background='rgb(16, 24, 34)';
        while(parent){const bg=getComputedStyle(parent).backgroundColor;if(bg!=='transparent' && !bg.endsWith(', 0)')){background=bg;break;}parent=parent.parentElement;}
        const fg=luminance(style.color), bg=luminance(background);
        return {selector,size:parseFloat(style.fontSize),contrast:(Math.max(fg,bg)+.05)/(Math.min(fg,bg)+.05)};
      }));
      for (const item of typography) { assert.ok(item.size >= 12, `${item.selector} is too small`); assert.ok(item.contrast >= 4.5, `${item.selector} has low contrast`); }
      await page.getByRole('button',{name:'Show last 3 months expenses',exact:true}).click();
      await page.locator('.atlas-finance[aria-busy="false"]').waitFor({ timeout: 60000 });
      const chart=page.locator('.cash-flow-card');
      await chart.scrollIntoViewIfNeeded();
      await page.waitForFunction(() => {const card=document.querySelector('.cash-flow-card');return card && card.querySelectorAll('.cash-bucket').length > 0 && card.querySelectorAll('.cash-bucket').length <= 8;});
      const labels=await page.locator('.cash-date').evaluateAll(nodes=>nodes.map(node=>{const r=node.getBoundingClientRect();return {left:r.left,right:r.right};}));
      for(let i=1;i<labels.length;i++) assert.ok(labels[i].left>=labels[i-1].right-1,'Chart date labels overlap');
      assert.equal(await chart.evaluate(node=>node.scrollWidth>node.clientWidth+1),false,'Chart should fit its card');
      const selectedBar=page.locator('.cash-bucket').first();
      const selectedValue=(await selectedBar.getAttribute('aria-label')).split('spending ')[1];
      await selectedBar.click();
      assert.equal(await selectedBar.getAttribute('aria-pressed'),'true');
      assert.equal(await page.locator('.expense-headline>strong').innerText(),selectedValue);
      await page.locator('.cash-detail strong').waitFor();
      await chart.evaluate(node=>node.scrollIntoView({block:'start'}));
      await page.screenshot({path:`finance-qa/cash-flow-${width}.png`,fullPage:true});
      const cash=(await page.screenshot({type:'jpeg',quality:80})).toString('base64');
      for(let offset=0;offset<cash.length;offset+=16000) console.log(`ATLAS_CASH_${width}_${String(offset/16000).padStart(4,'0')}=${cash.slice(offset,offset+16000)}`);
      await page.getByRole('button',{name:'Show last 6 months expenses',exact:true}).click();
      await page.locator('.atlas-finance[aria-busy="false"]').waitFor({timeout:60000});
      assert.ok(await page.locator('.cash-bucket').count()<=8);
      assert.equal(await chart.evaluate(node=>node.scrollWidth>node.clientWidth+1),false,'Six-month chart should fit');
      await page.getByRole('button',{name:'Show all time expenses',exact:true}).click();
      await page.locator('.atlas-finance[aria-busy="false"]').waitFor({timeout:60000});
      assert.equal(await chart.evaluate(node=>node.scrollWidth>node.clientWidth+1),false,'All-time chart should fit');
      await page.getByRole('button',{name:'Show this month expenses',exact:true}).click();
      await page.locator('.atlas-finance[aria-busy="false"]').waitFor({timeout:60000});
      const monthlyBar=await page.locator('.expense-bar').first().boundingBox();
      const monthlyCard=await chart.boundingBox();
      if(monthlyBar) assert.ok(monthlyBar.width<monthlyCard.width/2,'Monthly bars should be narrower');
      await page.getByRole('button',{name:'Show current week expenses',exact:true}).click();
      await page.locator('.atlas-finance[aria-busy="false"]').waitFor({timeout:60000});
      assert.deepEqual(await page.locator('.expense-labels .cash-date').allTextContents(),['Mon','Tue','Wed','Thu','Fri','Sat','Sun']);

      const categorySection=page.locator('.category-section');
      const categoryPeriod=page.getByRole('combobox',{name:'Category comparison period',exact:true});
      assert.ok((await categoryPeriod.innerText()).includes('Month'),'Categories default to month');
      const cardCount=await page.locator('.category-stat-card').count();
      const decoratedCategory=await page.locator('.category-stat-card').first().getAttribute('data-category');
      const decoration=await page.locator(`.category-stat-card[data-category="${decoratedCategory}"] .category-card-decoration`).innerHTML();

      assert.ok(cardCount>=10,'Every expense category should have a card');
      for(const range of ['Week','Year','Month']) {
        await categoryPeriod.click();
        await page.getByRole('option',{name:range,exact:true}).click();
        assert.equal(await page.locator('.category-stat-card').count(),cardCount);
        const geometry=await page.locator('.category-stat-card').evaluateAll(cards=>cards.map(card=>{const r=card.getBoundingClientRect();const art=card.querySelector('.category-card-decoration').getBoundingClientRect();return {layout:card.getAttribute('data-layout'),width:r.width,height:r.height,left:r.left,artLeft:art.left,gap:parseFloat(getComputedStyle(card.parentElement).rowGap)};}));
        for(const card of geometry){
          if(card.layout==='wide'){assert.ok(Math.abs(card.width-(2*card.height+card.gap))<=2,'Wide cards should span two columns');assert.ok(card.artLeft>=card.left+card.width*.5,'Wide card artwork belongs on the right');}
          else if(card.layout==='tall')assert.ok(Math.abs(card.height-(2*card.width+card.gap))<=2,'Tall cards should span two rows');
          else assert.ok(Math.abs(card.width-card.height)<=2,'Regular cards should remain square');
        }
        assert.ok(geometry.some(c=>c.layout==='wide')&&geometry.some(c=>c.layout==='tall'),'The layout needs both wide and tall cards');
        assert.equal(await page.locator(`.category-stat-card[data-category="${decoratedCategory}"] .category-card-decoration`).innerHTML(),decoration,'Decorative art must not change with financial values');

        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,`Category cards overflow for ${range}`);
      }
      await categorySection.evaluate(node=>node.scrollIntoView({block:'start'}));
      await page.screenshot({path:`finance-qa/category-cards-${width}.png`,fullPage:true});
      const categoryPreview=(await page.screenshot({type:'jpeg',quality:80})).toString('base64');
      for(let offset=0;offset<categoryPreview.length;offset+=16000) console.log(`ATLAS_CATEGORY_${width}_${String(offset/16000).padStart(4,'0')}=${categoryPreview.slice(offset,offset+16000)}`);
      await page.locator('.category-stat-card').first().click();
      await page.locator('.category-drilldown').waitFor();
      assert.equal(await page.getByRole('tab',{name:'Activity',exact:true}).getAttribute('aria-selected'),'true');
      assert.ok(await page.locator('.af-activity-row').count()>0,'Card opens related approved payments');
      await page.getByRole('button',{name:'Clear period',exact:true}).click();
      const logo=page.locator('.af-activity-row').filter({hasText:"Swiggy"}).first().locator("img");
      await logo.scrollIntoViewIfNeeded();
      console.log(`Merchant image ${width}: ${await logo.getAttribute("src")}`);
      await logo.evaluate(image=>image.complete&&image.naturalWidth>0?Promise.resolve():new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(new Error('Merchant image failed to load'));}));
      await page.getByRole('tab',{name:'Overview',exact:true}).click();
      console.log(`Category viewport ${width}: month/week/year comparisons, drilldown and merchant image loading passed`);
      await page.locator('.glass-balance-number').waitFor();
      assert.equal(await page.locator('.balance-panel').count(), 0, 'Restore the centered balance layout');
      await page.locator('.af-canvas').evaluate(async node => { await Promise.all(node.getAnimations().map(animation => animation.finished.catch(() => {}))); });
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
      assert.equal(await page.locator('.review-editor').count(), 1, 'Only one payment editor should open');
      await page.locator('.review-payment').nth(1).click();
      assert.equal(await page.locator('.review-payment').nth(1).getAttribute('aria-expanded'), 'true');
      assert.equal(await page.locator('.review-editor').count(), 1);
      await page.locator('.review-more summary').click();
      await page.getByRole('button', { name: 'Paste a message', exact: true }).click();
      await page.locator('textarea').waitFor();
      await page.getByRole('button', { name: /^Inbox/ }).click();
      const category = page.getByRole('combobox', { name: 'Transaction category', exact: true });
      await category.click();
      await category.press('ArrowDown');
      await category.press('Enter');
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
