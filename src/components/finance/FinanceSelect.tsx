"use client";

import React, { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";

type Props = Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "onChange" | "multiple"> & {
  onChange?: (event: { target: { value: string } }) => void;
};
type Option = { value: string; label: string; disabled: boolean };
function labelOf(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(labelOf).join("");
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) return labelOf(node.props.children);
  return "";
}

export default function FinanceSelect({ children, value, defaultValue, onChange, className = "", disabled, name, id, style, ...props }: Props) {
  const uid = useId();
  const menuId = `${uid}-options`;
  const options = useMemo(() => {
    const output: Option[] = [];
    const visit = (nodes: React.ReactNode) => React.Children.forEach(nodes, (child) => {
      if (!React.isValidElement<{ value?: string | number; disabled?: boolean; children?: React.ReactNode }>(child)) return;
      if (child.type === "option") output.push({ value: String(child.props.value ?? labelOf(child.props.children)), label: labelOf(child.props.children), disabled: Boolean(child.props.disabled) });
      else visit(child.props.children);
    });
    visit(children);
    return output;
  }, [children]);
  const [internal, setInternal] = useState(String(defaultValue ?? options[0]?.value ?? ""));
  const current = String(value ?? internal);
  const selected = options.findIndex((option) => option.value === current);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [position, setPosition] = useState({ left: 12, top: 0, width: 240, maxHeight: 300 });
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const typeahead = useRef({ value: "", time: 0 });
  const choose = (index: number) => {
    const option = options[index];
    if (!option || option.disabled) return;
    setInternal(option.value);
    onChange?.({ target: { value: option.value } });
    setOpen(false);
    trigger.current?.focus();
  };
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = trigger.current?.getBoundingClientRect();
      if (!rect) return;
      const height = window.visualViewport?.height || window.innerHeight;
      const width = Math.min(Math.max(rect.width, 210), window.innerWidth - 24);
      const roomBelow = height - rect.bottom - 16;
      const upwards = roomBelow < Math.min(260, options.length * 44 + 12) && rect.top > roomBelow;
      const maxHeight = Math.min(300, Math.max(80, upwards ? rect.top - 20 : roomBelow));
      setPosition({ left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)), top: upwards ? Math.max(12, rect.top - Math.min(maxHeight, options.length * 44 + 12) - 6) : rect.bottom + 6, width, maxHeight });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    window.visualViewport?.addEventListener("resize", place);
    return () => { window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); window.visualViewport?.removeEventListener("resize", place); };
  }, [open, options.length]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!trigger.current?.contains(event.target as Node) && !menu.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  useEffect(() => { if (open) menu.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" }); }, [active, open]);
  const move = (delta: number) => {
    let next = active;
    for (let i = 0; i < options.length; i++) { next = (next + delta + options.length) % options.length; if (!options[next].disabled) break; }
    setActive(next);
  };
  return <div className="finance-select" style={style}>
    <button ref={trigger} id={id} type="button" role="combobox" aria-label={props["aria-label"] || (id ? undefined : `Select: ${options[selected]?.label || "Choose option"}`)} aria-labelledby={props["aria-labelledby"]} aria-expanded={open} aria-haspopup="listbox" aria-controls={menuId} aria-activedescendant={open ? `${menuId}-${active}` : undefined} disabled={disabled} className={`finance-select-trigger ${className}`} onBlur={(event) => { if (!menu.current?.contains(event.relatedTarget)) setOpen(false); }} onClick={() => { setActive(Math.max(selected, 0)); setOpen(!open); }} onKeyDown={(event) => {
      if (["ArrowDown", "ArrowUp", "Home", "End", "Enter", " ", "Escape", "Tab"].includes(event.key)) {
        if (event.key === "Tab") { setOpen(false); return; }
        event.preventDefault();
        if (event.key === "Escape") { event.stopPropagation(); setOpen(false); }
        else if (event.key === "Enter" || event.key === " ") { if (open) choose(active); else { setActive(Math.max(selected, 0)); setOpen(true); } }
        else if (!open) { setActive(Math.max(selected, 0)); setOpen(true); }
        else if (event.key === "Home") setActive(Math.max(options.findIndex((o) => !o.disabled), 0));
        else if (event.key === "End") setActive(Math.max(options.findLastIndex((option) => !option.disabled), 0));
        else move(event.key === "ArrowDown" ? 1 : -1);
      } else if (event.key.length === 1) {
        const now = Date.now();
        typeahead.current = { value: (now - typeahead.current.time > 700 ? "" : typeahead.current.value) + event.key.toLowerCase(), time: now };
        const index = options.findIndex((option) => !option.disabled && option.label.toLowerCase().startsWith(typeahead.current.value));
        if (index >= 0) { setActive(index); setOpen(true); }
      }
    }}><span>{options[selected]?.label || "Choose option"}</span><ChevronDown size={16} className={open ? "rotate-180" : ""} /></button>
    {name && <input type="hidden" name={name} value={current} />}
    {open && createPortal(<div ref={menu} role="listbox" id={menuId} aria-label={props["aria-label"] || "Options"} className="finance-select-menu" style={{ ...position, position: "fixed", overflowY: "auto", touchAction: "pan-y" }}>
      {options.map((option, index) => <div id={`${menuId}-${index}`} data-index={index} key={`${option.value}-${index}`} role="option" aria-selected={option.value === current} aria-disabled={option.disabled} className={`finance-select-option ${active === index ? "is-active" : ""}`} onPointerMove={(event) => { if (event.pointerType === "mouse") setActive(index); }} onPointerDown={(event) => event.preventDefault()} onClick={() => choose(index)}><span>{option.label}</span>{option.value === current && <Check size={16} />}</div>)}
    </div>, document.body)}
  </div>;
}
