import type { CashFlowTimelinePoint } from './application/balanceService';
const DAY = 86_400_000;
export interface CashFlowBucket { key:string; label:string; rangeLabel:string; incomePaise:number; expensePaise:number; }
function day(value:string) { return Date.parse(`${value.slice(0,10)}T00:00:00Z`); }
function dateLabel(value:number) { return `${new Date(value).getUTCDate()} ${monthLabel(value)}`; }
function monthLabel(value:number) { return new Date(value).toLocaleDateString('en-US',{month:'short',timeZone:'UTC'}); }
/** Bucket by calendar ranges, never by dropping points or averaging money. */
export function groupCashFlow(timeline:CashFlowTimelinePoint[],startDate:string,endDate:string,maxBuckets:number) {
  const limit=Math.max(2,Math.min(8,Math.floor(maxBuckets)||2));
  const first=day(startDate), last=day(endDate);
  if(!Number.isFinite(first)||!Number.isFinite(last)||last<first) return {grouping:'Daily',buckets:[] as CashFlowBucket[]};
  // Include every supplied point, even at date boundaries, so totals stay exact.
  const valid=timeline.filter(p=>Number.isFinite(day(p.dateKey)));
  const from=Math.min(first,...valid.map(p=>day(p.dateKey))), to=Math.max(last,...valid.map(p=>day(p.dateKey)));
  const days=Math.round((to-from)/DAY)+1;
  const firstDate=new Date(from), lastDate=new Date(to);
  const months=(lastDate.getUTCFullYear()-firstDate.getUTCFullYear())*12+lastDate.getUTCMonth()-firstDate.getUTCMonth()+1;
  const mode=days<=limit?'day':days<=70&&Math.ceil(days/7)<=limit?'week':'month';
  const monthStep=Math.max(1,Math.ceil(months/limit));
  const count=mode==='day'?days:mode==='week'?Math.ceil(days/7):Math.ceil(months/monthStep);
  const buckets:CashFlowBucket[]=Array.from({length:count},(_,i)=>{
    const start=mode==='month'?Date.UTC(firstDate.getUTCFullYear(),firstDate.getUTCMonth()+i*monthStep,1):from+i*(mode==='week'?7:1)*DAY;
    const end=mode==='month'?Math.min(to,Date.UTC(firstDate.getUTCFullYear(),firstDate.getUTCMonth()+(i+1)*monthStep,1)-DAY):Math.min(to,start+(mode==='week'?6:0)*DAY);
    let label=mode==='month'?monthLabel(start):dateLabel(start);
    if(mode==='month'&&monthStep>1) label=monthLabel(start)===monthLabel(end)&&new Date(start).getUTCFullYear()===new Date(end).getUTCFullYear()?monthLabel(start):`${monthLabel(start)}–${monthLabel(end)}`;
    if(mode==='month'&&(monthStep>=12||months>12)) label=monthStep>=12 ? (new Date(start).getUTCFullYear()===new Date(end).getUTCFullYear()?`${new Date(start).getUTCFullYear()}`:`${new Date(start).getUTCFullYear()}–${String(new Date(end).getUTCFullYear()).slice(-2)}`) : `${monthLabel(start)} '${String(new Date(start).getUTCFullYear()).slice(-2)}`;
    return {key:new Date(start).toISOString().slice(0,10),label,rangeLabel:`${dateLabel(Math.max(from,start))} ${new Date(start).getUTCFullYear()}${end>start?` – ${dateLabel(end)} ${new Date(end).getUTCFullYear()}`:''}`,incomePaise:0,expensePaise:0};
  });
  for(const point of valid){const timestamp=day(point.dateKey), d=new Date(timestamp);const i=mode==='month'?Math.floor(((d.getUTCFullYear()-firstDate.getUTCFullYear())*12+d.getUTCMonth()-firstDate.getUTCMonth())/monthStep):Math.floor((timestamp-from)/DAY/(mode==='week'?7:1));buckets[i].incomePaise+=point.incomePaise;buckets[i].expensePaise+=point.expensePaise;}
  return {grouping:mode==='day'?'Daily':mode==='week'?'Weekly':monthStep===1?'Monthly':monthStep<12?`${monthStep}-month groups`:'Year groups',buckets};
}
export function cashFlowAxisMax(value:number){if(value<=0)return 100;const magnitude=10**Math.floor(Math.log10(value));return [1,2,5,10].map(n=>n*magnitude).find(n=>n>=value) ?? 10*magnitude;}
