"use client";
import { BarChart3 } from "lucide-react";
import { CashFlowTimelinePoint, formatPaise } from "@/lib/finance";
export default function CashFlowChart({timeline,totalIncomePaise,totalExpensesPaise}:{timeline:CashFlowTimelinePoint[];totalIncomePaise:number;totalExpensesPaise:number}) {
  const max=Math.max(1,...timeline.flatMap(p=>[p.incomePaise,p.expensePaise]));
  return <article className="af-chart"><div className="af-chart-heading"><h3>Money in motion</h3><span>INCOME & SPENDING</span></div>{totalIncomePaise || totalExpensesPaise ? <><div className="af-chart-scroll" tabIndex={0} role="region" aria-label="Income and spending by date"><div className="af-bars">{timeline.map(point=><div className="af-bar-day" key={point.dateKey} title={`${point.dateLabel}: received ${formatPaise(point.incomePaise)}, spent ${formatPaise(point.expensePaise)}`}><div><i style={{height:`${point.incomePaise/max*140}px`}}/><i style={{height:`${point.expensePaise/max*140}px`}}/></div><span>{point.dateLabel}</span></div>)}</div></div><div className="af-chart-legend"><span><i/>Money in · {formatPaise(totalIncomePaise)}</span><span><i/>Money out · {formatPaise(totalExpensesPaise)}</span></div></> : <div className="af-chart-empty"><BarChart3 size={32}/><p>Your cash flow takes shape as you add transactions.</p></div>}</article>;
}
