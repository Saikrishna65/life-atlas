"use client";
import { useEffect, useRef } from "react";
import { SlidersHorizontal } from "lucide-react";
export const financeThemes = [
  { id: "ocean", name: "Ocean teal", color: "#007f8b" },
  { id: "royal", name: "Royal blue", color: "#245bd6" },
  { id: "emerald", name: "Emerald", color: "#008364" },
  { id: "graphite", name: "Warm graphite", color: "#252b30" },
] as const;
export type FinanceTheme = typeof financeThemes[number]["id"];
export const THEME_STORAGE_KEY = "atlas-finance-theme";
export function isFinanceTheme(value: unknown): value is FinanceTheme {
  return financeThemes.some(theme => theme.id === value);
}
export default function FinanceThemePicker({value,onChange}:{value:FinanceTheme;onChange:(theme:FinanceTheme)=>void}) {
  const menu = useRef<HTMLDetailsElement>(null);
  useEffect(()=>{const close=(event:PointerEvent)=>{if(menu.current && !menu.current.contains(event.target as Node)) menu.current.open=false;};document.addEventListener("pointerdown",close);return ()=>document.removeEventListener("pointerdown",close);},[]);
  return <details ref={menu} className="finance-theme-picker header-appearance" onKeyDown={event=>{if(event.key==="Escape"){event.stopPropagation();if(menu.current) menu.current.open=false;menu.current?.querySelector("summary")?.focus();}}}><summary aria-label="Change Finance appearance" title="Appearance"><SlidersHorizontal size={19}/></summary><div className="finance-theme-popover"><header><strong>Appearance</strong><span>Choose your colours</span></header><div className="finance-theme-options" role="group" aria-label="Finance color theme">{financeThemes.map(theme=><button key={theme.id} type="button" aria-pressed={theme.id===value} onClick={()=>onChange(theme.id)}><span className="theme-color-sample" style={{background:theme.color}}/><span>{theme.name}</span><span className="theme-check" aria-hidden="true">{theme.id===value ? "✓" : ""}</span></button>)}</div><p>Saved automatically on this device.</p></div></details>;
}
