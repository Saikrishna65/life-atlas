"use client";

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
  return <details className="finance-theme-picker"><summary><span>Appearance</span><span><i style={{background:financeThemes.find(theme=>theme.id===value)?.color}}/>{financeThemes.find(theme=>theme.id===value)?.name}<span aria-hidden="true">⌄</span></span></summary><div className="finance-theme-options" role="group" aria-label="Finance color theme">{financeThemes.map(theme=><button key={theme.id} type="button" aria-pressed={theme.id===value} onClick={()=>onChange(theme.id)}><span className="theme-color-sample" style={{background:theme.color}}/><span>{theme.name}</span><span className="theme-check" aria-hidden="true">{theme.id===value ? "✓" : ""}</span></button>)}</div><p>Your theme is saved on this device.</p></details>;
}
