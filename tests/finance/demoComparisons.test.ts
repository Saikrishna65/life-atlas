import 'fake-indexeddb/auto';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {IndexedDBUnitOfWork} from '../../src/lib/finance';
import {openDemoDatabase,seedFinanceDemo} from '../../src/lib/finance/demo';
import {categoryComparisons} from '../../src/lib/finance/categoryComparison';
import {buildDemoTransactions} from '../../src/lib/finance/demoTransactions';
test('expanded demo provides varied current/prior periods and leaves live accounts untouched',async()=>{
 const live=new IndexedDBUnitOfWork();assert.equal((await live.accounts.getAll()).length,0);
 const database=await openDemoDatabase();const demo=new IndexedDBUnitOfWork(Promise.resolve(database));await seedFinanceDemo(demo);
 const transactions=await demo.transactions.query({});const categories=await demo.categories.getAll();
 assert.ok(transactions.length>400);assert.equal((await demo.accounts.getAll()).length,4);
 const month=categoryComparisons(transactions,categories,'month');
 assert.ok(month.filter(c=>c.currentPaise>0&&c.previousPaise>0).length>=8);
 const year=categoryComparisons(transactions,categories,'year');assert.ok(year.filter(c=>c.previousPaise>0).length>=8);
 const week=categoryComparisons(transactions,categories,'week');assert.ok(week.some(c=>c.currentPaise>0&&c.previousPaise>0));
 assert.equal((await live.accounts.getAll()).length,0);database.close();
});
test('calendar fixtures have distinct dates, varying values, unique IDs and no future spends',()=>{
 const now=new Date(2026,10,10,15);const categories=[{id:'food',name:'Food & Dining'}];
 const rows=buildDemoTransactions('account',categories,now);assert.equal(new Set(rows.map(t=>t.id)).size,rows.length);assert.ok(rows.every(t=>Date.parse(t.occurredAt)<=now.getTime()));assert.ok(new Set(rows.map(t=>t.occurredAt.slice(0,7))).size>=20);assert.ok(new Set(rows.filter(t=>t.merchant==='Swiggy').map(t=>t.amountPaise)).size>5);
});
