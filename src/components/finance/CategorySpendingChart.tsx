"use client";
import { PieChart } from "lucide-react";
import { CategorySpendingItem, formatPaise } from "@/lib/finance";
const colors=["#55d8bd","#6aacec","#a394ed","#e8bc76","#71c3cd","#d695b3","#85bf9c","#9caec7"];
export default function CategorySpendingChart({categories,totalExpensesPaise}:{categories:CategorySpendingItem[];totalExpensesPaise:number}) {
 const total=categories.reduce((sum,c)=>sum+c.totalSpentPaise,0);
 return <article className="af-chart"><div className="af-chart-heading"><h3>Top spending</h3><span>CATEGORIES</span></div>{total>0 ? <><div className="glass-spent"><small>Total expenses</small>{formatPaise(totalExpensesPaise)}</div><div className="af-spending-segments" role="img" aria-label={`Spending across ${categories.length} categories`}>{categories.map((c,i)=><i key={c.categoryId} style={{width:`${c.totalSpentPaise/total*100}%`,background:colors[i%colors.length]}}/>)}</div>{categories.map((c,i)=><div className="af-category-row" key={c.categoryId}><i style={{background:colors[i%colors.length]}}/><span>{c.categoryName}</span><b>{formatPaise(c.totalSpentPaise)}<small>{c.percentage}%</small></b></div>)}</> : <div className="af-chart-empty"><PieChart size={30}/><p>Your spending categories appear as you approve payments.</p></div>}</article>;
}
