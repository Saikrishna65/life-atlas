import type { FinanceCategory,Transaction } from './domain/models';
import {currentFinanceWeek} from './calendar';
export type CategoryPeriod='week'|'month'|'year';
export function categoryPeriodBounds(period:CategoryPeriod,now=new Date()){
 const y=now.getFullYear(),m=now.getMonth(),d=now.getDate();
 const start=period==='week'?currentFinanceWeek(now).start:period==='month'?new Date(y,m,1):new Date(y,0,1);
 const previousStart=period==='week'?new Date(start.getFullYear(),start.getMonth(),start.getDate()-7):period==='month'?new Date(y,m-1,1):new Date(y-1,0,1);
 const previousEnd=new Date(start.getTime()-1);
 let matched:Date;
 if(period==='week')matched=new Date(previousStart.getFullYear(),previousStart.getMonth(),previousStart.getDate()+(now.getDay()+6)%7,now.getHours(),now.getMinutes(),now.getSeconds(),now.getMilliseconds());
 else {const py=previousStart.getFullYear(),pm=period==='month'?previousStart.getMonth():m;const pd=Math.min(d,new Date(py,pm+1,0).getDate());matched=new Date(py,pm,pd,now.getHours(),now.getMinutes(),now.getSeconds(),now.getMilliseconds());}
 return {start,end:now,previousStart,previousEnd,matchedEnd:new Date(Math.min(matched.getTime(),previousEnd.getTime()))};
}
export interface CategoryComparison {id:string;name:string;currentPaise:number;previousPaise:number;matchedPaise:number;count:number;trend:number[];budgetPaise?:number;share:number;changePercent:number|null;}
/** Current totals, previous full totals, and a fair same-elapsed-time change. */
export function categoryComparisons(transactions:Transaction[],categories:FinanceCategory[],period:CategoryPeriod,now=new Date()):CategoryComparison[]{
 const range=categoryPeriodBounds(period,now),categoryMap=new Map(categories.map(c=>[c.id,c]));
 const slots=period==='week'?7:period==='year'?12:8;
 const map=new Map<string,CategoryComparison>(categories.filter(c=>c.type==='expense').map(c=>[c.id,{id:c.id,name:c.name,currentPaise:0,previousPaise:0,matchedPaise:0,count:0,trend:Array(slots).fill(0),budgetPaise:period==='month'?c.budgetAmountPaise:undefined,share:0,changePercent:null}]));
 for(const t of transactions){if((t.tripAssignment?.tripId && t.tripAssignment.mode!=='excluded')||t.status!=='posted'||t.direction!=='outflow'||t.transferGroupId||categoryMap.get(t.categoryId||'')?.type==='transfer')continue;const time=Date.parse(t.occurredAt);if(!Number.isFinite(time)||time<range.previousStart.getTime()||time>now.getTime())continue;const id=map.has(t.categoryId||'')?t.categoryId!:'__uncategorized';if(!map.has(id))map.set(id,{id,name:'Uncategorized',currentPaise:0,previousPaise:0,matchedPaise:0,count:0,trend:Array(slots).fill(0),share:0,changePercent:null});const row=map.get(id)!;
 if(time>=range.start.getTime()){row.currentPaise+=t.amountPaise;row.count++;const date=new Date(time);const index=period==='week'?(date.getDay()+6)%7:period==='year'?date.getMonth():Math.min(7,Math.floor((date.getDate()-1)/new Date(date.getFullYear(),date.getMonth()+1,0).getDate()*8));row.trend[index]+=t.amountPaise;}
 else {row.previousPaise+=t.amountPaise;if(time<=range.matchedEnd.getTime())row.matchedPaise+=t.amountPaise;}}
 const total=[...map.values()].reduce((sum,c)=>sum+c.currentPaise,0);
 return [...map.values()].map(c=>({...c,share:total?c.currentPaise/total*100:0,changePercent:c.matchedPaise?Math.round((c.currentPaise-c.matchedPaise)/c.matchedPaise*100):c.currentPaise?null:0})).sort((a,b)=>b.currentPaise-a.currentPaise||b.previousPaise-a.previousPaise||a.name.localeCompare(b.name));
}
