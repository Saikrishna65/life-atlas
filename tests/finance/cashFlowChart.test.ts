import {currentFinanceWeek,localFinanceDateKey} from "../../src/lib/finance/calendar";
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {groupCashFlow,cashFlowAxisMax,formatCashFlowAxis,currentWeekCashFlow} from '../../src/lib/finance/cashFlowChart';
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

test('compact average values are consistent between browser locales',()=>{assert.equal(formatCashFlowAxis(5000000),'₹50K');assert.equal(formatCashFlowAxis(10000000),'₹1L');assert.equal(formatCashFlowAxis(1500000000),'₹1.5Cr');});

test('current week always shows Monday through Sunday and future days stay at zero',()=>{
 const now=new Date(2026,10,4,12); // Wednesday
 const result=currentWeekCashFlow([point('2026-11-02',0,101),point('2026-11-04',0,202),point('2026-11-05',0,999)],now);
 assert.deepEqual(result.buckets.map(p=>p.label),['Mon','Tue','Wed','Thu','Fri','Sat','Sun']);
 assert.equal(result.buckets.length,7);assert.equal(result.buckets[2].expensePaise,202);assert.equal(result.buckets[3].expensePaise,0);assert.equal(result.buckets[3].isFuture,true);
 assert.equal(result.buckets.reduce((sum,p)=>sum+p.expensePaise,0),303);
});
test('empty weeks and year boundaries keep all seven calendar dates',()=>{const now=new Date(2026,0,1,12);const {start,end}=currentFinanceWeek(now);assert.equal(localFinanceDateKey(start),'2025-12-29');assert.equal(localFinanceDateKey(end),'2026-01-04');const result=currentWeekCashFlow([],now);assert.equal(result.buckets.length,7);assert.ok(result.buckets.every(p=>p.expensePaise===0));});
test('early Monday transactions use the local day in India',()=>{const old=process.env.TZ;try{process.env.TZ='Asia/Kolkata';const value=new Date('2026-11-01T18:45:00Z');assert.equal(localFinanceDateKey(value),'2026-11-02');const result=currentWeekCashFlow([point(localFinanceDateKey(value),0,456)],new Date('2026-11-02T09:00:00+05:30'));assert.equal(result.buckets[0].expensePaise,456);assert.equal(result.buckets[1].isFuture,true);}finally{if(old===undefined)delete process.env.TZ;else process.env.TZ=old;}});
