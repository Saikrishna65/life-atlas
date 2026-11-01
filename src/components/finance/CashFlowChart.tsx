"use client";
import { useEffect, useMemo, useRef, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { CashFlowTimelinePoint, formatPaise } from '@/lib/finance';
import { localFinanceDateKey } from '@/lib/finance/calendar';
import { groupCashFlow, currentWeekCashFlow, formatCashFlowAxis } from '@/lib/finance/cashFlowChart';
const ranges=[['THIS_WEEK','W'],['THIS_MONTH','M'],['LAST_3_MONTHS','3M'],['LAST_6_MONTHS','6M'],['THIS_YEAR','Y'],['ALL_TIME','All']] as const;
export default function CashFlowChart({timeline,totalExpensesPaise,startDate,endDate,periodLabel,period,onPeriodChange}:{timeline:CashFlowTimelinePoint[];totalIncomePaise:number;totalExpensesPaise:number;startDate:string;endDate:string;periodLabel:string;period:string;onPeriodChange:(value:string)=>void}) {
 const card=useRef<HTMLElement>(null);const [capacity,setCapacity]=useState(6);const [selection,setSelection]=useState<{period:string;key:string}|null>(null);
 useEffect(()=>{const node=card.current;if(!node)return;const update=()=>setCapacity(Math.max(3,Math.min(8,Math.floor(node.clientWidth/40))));update();const observer=new ResizeObserver(update);observer.observe(node);return()=>observer.disconnect();},[]);
 const today=localFinanceDateKey(new Date());
 const {grouping,buckets}=useMemo(()=>period==="THIS_WEEK"?currentWeekCashFlow(timeline):groupCashFlow(timeline,startDate,endDate,capacity),[timeline,startDate,endDate,capacity,period,today]);
 const selected=(selection?.period===period ? buckets.find(point=>point.key===selection.key):null)||(period==="THIS_WEEK"?buckets.find(point=>point.key===today):buckets.at(-1));
 const max=Math.max(1,...buckets.map(point=>point.expensePaise))*1.1;
 const averageCount=period==="THIS_WEEK"?buckets.filter(point=>!point.isFuture).length:buckets.length;
 const average=averageCount?buckets.reduce((sum,p)=>sum+p.expensePaise,0)/averageCount:0;

 return <article ref={card} className="af-chart cash-flow-card expense-insights" aria-label="Expense insights" data-period={period}><div className="expense-title"><h3>Expenses</h3></div><div className="expense-ranges" role="group" aria-label="Expense chart range">{ranges.map(([value,label])=><button type="button" key={value} aria-pressed={period===value||(value==='THIS_MONTH'&&period==='LAST_MONTH')} aria-label={`Show ${label==='W'?'current week':label==='M'?'this month':label==='3M'?'last 3 months':label==='6M'?'last 6 months':label==='Y'?'this year':'all time'} expenses`} onClick={()=>onPeriodChange(value)}>{label}</button>)}</div>
 <div className="expense-headline"><p>{selected?.label||periodLabel}</p><strong>{formatPaise(selected?.expensePaise||0)}</strong><span>{periodLabel} · total {formatPaise(totalExpensesPaise)}</span></div>
 {totalExpensesPaise>0||period==="THIS_WEEK" ? <><div className="expense-plot" role="group" aria-label={`${grouping} expenses`}><div className="expense-average" style={{bottom:`${average/max*100}%`}} aria-label={`Average ${formatPaise(Math.round(average))}`}><span>{period==="THIS_WEEK"?"Avg so far":"Avg"} {formatCashFlowAxis(Math.round(average))}</span></div><div className="expense-bars" style={{gridTemplateColumns:`repeat(${Math.max(1,buckets.length)},minmax(0,1fr))`}}>{buckets.map(point=><button key={point.key} type="button" className="cash-bucket expense-bucket" data-future={point.isFuture} data-zero={point.expensePaise===0} aria-pressed={selected?.key===point.key} aria-label={`${point.rangeLabel}: spending ${formatPaise(point.expensePaise)}`} onClick={()=>setSelection({period,key:point.key})}><span className="expense-bar" style={{height:`${point.expensePaise/max*100}%`,borderTopWidth:point.expensePaise?2:0}}/></button>)}</div></div><div className="expense-labels" style={{gridTemplateColumns:`repeat(${Math.max(1,buckets.length)},minmax(0,1fr))`}}>{buckets.map(point=><span key={point.key} className="cash-date" data-selected={selected?.key===point.key} data-future={point.isFuture}>{point.label}</span>)}</div><div className="cash-detail expense-selection" aria-live="polite"><strong>{selected?.rangeLabel}</strong><span>{selected?.isFuture ? "Upcoming day · no spending yet." : "Tap any bar to explore its spending."}</span></div></> : <div className="af-chart-empty"><BarChart3 size={30}/><p>No approved expenses in this period.</p></div>}
 </article>;
}
