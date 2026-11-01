import {test} from 'node:test';
import assert from 'node:assert/strict';
import {groupCashFlow,cashFlowAxisMax} from '../../src/lib/finance/cashFlowChart';
const point=(dateKey:string,incomePaise:number,expensePaise:number)=>({dateKey,dateLabel:dateKey,incomePaise,expensePaise,netPaise:incomePaise-expensePaise});
test('three months become readable monthly groups and preserve every paise',()=>{
 const timeline=[point('2026-09-01',9200001,17003),point('2026-09-02',0,35001),point('2026-10-01',9200000,72001),point('2026-11-01',9200000,12400)];
 const result=groupCashFlow(timeline,'2026-09-01','2026-11-01',4);
 assert.equal(result.grouping,'Monthly');assert.deepEqual(result.buckets.map(p=>p.label),['Sep','Oct','Nov']);
 assert.equal(result.buckets.reduce((sum,p)=>sum+p.incomePaise,0),27600001);assert.equal(result.buckets.reduce((sum,p)=>sum+p.expensePaise,0),136405);
});
test('sparse short ranges show missing days as zero, without fabricated bars',()=>{const result=groupCashFlow([point('2026-11-01',100,0)],'2026-11-01','2026-11-04',4);assert.equal(result.buckets.length,4);assert.equal(result.buckets[1].incomePaise,0);});
test('long histories and narrow containers have bounded buckets, even across leap years',()=>{const timeline=[point('2020-02-29',10001,0),point('2026-11-01',0,9999)];for(const capacity of [2,4,8]){const result=groupCashFlow(timeline,'2020-01-01','2026-11-01',capacity);assert.ok(result.buckets.length<=capacity);assert.equal(result.buckets.reduce((sum,p)=>sum+p.incomePaise,0),10001);assert.equal(result.buckets.reduce((sum,p)=>sum+p.expensePaise,0),9999);}});
test('weekly groups account for the partial final week',()=>{const result=groupCashFlow([point('2026-10-31',0,45001)],'2026-10-01','2026-10-31',8);assert.equal(result.grouping,'Weekly');assert.equal(result.buckets.length,5);assert.equal(result.buckets[4].expensePaise,45001);});
test('axis rounds up without clipping exact values',()=>{for(const amount of [1,99,101,50001,9200000])assert.ok(cashFlowAxisMax(amount)>=amount);assert.equal(cashFlowAxisMax(0),100);});
