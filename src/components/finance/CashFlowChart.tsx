"use client";
import { useEffect, useMemo, useRef, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { CashFlowTimelinePoint, formatPaise } from '@/lib/finance';
import { groupCashFlow, cashFlowAxisMax } from '@/lib/finance/cashFlowChart';
export default function CashFlowChart({timeline,totalIncomePaise,totalExpensesPaise,startDate,endDate,periodLabel}:{timeline:CashFlowTimelinePoint[];totalIncomePaise:number;totalExpensesPaise:number;startDate:string;endDate:string;periodLabel:string}) {
  const card=useRef<HTMLElement>(null);
  const [capacity,setCapacity]=useState(4);
  const [selectedKey,setSelectedKey]=useState<string|null>(null);
  useEffect(()=>{const node=card.current;if(!node)return;const update=()=>setCapacity(Math.max(2,Math.min(8,Math.floor((node.clientWidth-80)/52))));update();const observer=new ResizeObserver(update);observer.observe(node);return()=>observer.disconnect();},[]);
  const {grouping,buckets}=useMemo(()=>groupCashFlow(timeline,startDate,endDate,capacity),[timeline,startDate,endDate,capacity]);
  const max=cashFlowAxisMax(Math.max(0,...buckets.flatMap(point=>[point.incomePaise,point.expensePaise])));
  const selected=buckets.find(point=>point.key===selectedKey);
  const compact=(value:number)=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',notation:'compact',maximumFractionDigits:1}).format(value/100);
  return <article ref={card} className="af-chart glass-cash-chart cash-flow-card"><div className="af-chart-heading"><h3>Cash flow</h3><span>{grouping}</span></div><p className="cash-period">{periodLabel}</p><div className="glass-spent"><small>Income minus spending</small>{formatPaise(totalIncomePaise-totalExpensesPaise)}</div>{totalIncomePaise||totalExpensesPaise ? <>
    <div className="cash-chart-plot" role="group" aria-label={`${grouping} income and spending`}>
      <div className="cash-axis" aria-hidden="true"><span>{compact(max)}</span><span>{compact(max/2)}</span><span>₹0</span></div>
      <div className="cash-plot-area"><div className="cash-grid" aria-hidden="true"><i/><i/><i/></div><div className="cash-columns" style={{gridTemplateColumns:`repeat(${Math.max(1,buckets.length)},minmax(0,1fr))`}}>{buckets.map(point=><button key={point.key} type="button" className="cash-bucket" aria-pressed={selectedKey===point.key} aria-label={`${point.rangeLabel}: income ${formatPaise(point.incomePaise)}, spending ${formatPaise(point.expensePaise)}`} onClick={()=>setSelectedKey(point.key)}><span className="cash-bar-pair" aria-hidden="true"><i className="cash-income-bar" style={{height:`${point.incomePaise/max*100}%`}}/><i className="cash-expense-bar" style={{height:`${point.expensePaise/max*100}%`,borderTopWidth:point.expensePaise?1:0}}/></span><span className="cash-date">{point.label}</span></button>)}</div></div>
    </div>
    <div className="cash-totals"><div><span><i/>Income</span><strong>{formatPaise(totalIncomePaise)}</strong></div><div><span><i/>Spending</span><strong>{formatPaise(totalExpensesPaise)}</strong></div></div>
    <div className="cash-detail" aria-live="polite">{selected ? <><strong>{selected.rangeLabel}</strong><span>In {formatPaise(selected.incomePaise)} <b>·</b> Out {formatPaise(selected.expensePaise)}</span></> : <span>Tap a bar to see the exact amounts.</span>}</div>
  </> : <div className="af-chart-empty"><BarChart3 size={30}/><p>No approved income or spending in this period.</p></div>}</article>;
}
