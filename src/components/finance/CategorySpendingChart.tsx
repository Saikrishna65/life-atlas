"use client";
import { PieChart } from "lucide-react";
import { CategorySpendingItem, formatPaise } from "@/lib/finance";
const colors=["#3971f6","#8b5cf6","#38bdf8","#f59e0b","#a78bfa","#0ea5e9","#f472b6","#64748b"];
export default function CategorySpendingChart({categories,totalExpensesPaise}:{categories:CategorySpendingItem[];totalExpensesPaise:number}) {
  const total=categories.reduce((sum,c)=>sum+c.totalSpentPaise,0);let angle=0;
  const gradient=categories.map((c,i)=>{const start=angle;angle+=total?c.totalSpentPaise/total*360:0;return `${colors[i%colors.length]} ${start}deg ${angle}deg`;}).join(",");
  return <article className="af-chart"><div className="af-chart-heading"><h3>Where it went</h3><span>BY CATEGORY</span></div>{total>0 ? <><div className="af-spending-ring" role="img" aria-label={`Total spending ${formatPaise(totalExpensesPaise)}`} style={{background:`conic-gradient(${gradient})`}}><div><small>Total spent</small><strong>{formatPaise(totalExpensesPaise)}</strong></div></div><div>{categories.map((c,i)=><div className="af-category-row" key={c.categoryId}><i style={{background:colors[i%colors.length]}}/><span>{c.categoryName}</span><b>{formatPaise(c.totalSpentPaise)}<small>{c.percentage}% of spending</small></b></div>)}</div></> : <div className="af-chart-empty"><PieChart size={32}/><p>Approved expenses will be organised by category here.</p></div>}</article>;
}
