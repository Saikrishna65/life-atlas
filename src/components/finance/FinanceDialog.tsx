"use client";
import { useEffect, useId } from "react";
import { X } from "lucide-react";
import type { ModalProps } from "@/components/ui/Modal";
import { useLockBodyScroll } from "@/lib/vault/useLockBodyScroll";

export function useFinanceDialog(open: boolean, onClose: () => void) {
  useLockBodyScroll(open);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const timer = requestAnimationFrame(() => {
      const dialogs = document.querySelectorAll<HTMLElement>(".finance-workspace");
      dialogs[dialogs.length - 1]?.focus({ preventScroll: true });
    });
    const key = (event: KeyboardEvent) => {
      const dialogs = document.querySelectorAll<HTMLElement>(".finance-workspace");
      const dialog = dialogs[dialogs.length - 1];
      if (!dialog || !dialog.contains(document.activeElement)) return;
      if (event.key === "Escape") { event.stopPropagation(); onClose(); }
      if (event.key === "Tab") {
        const nodes = [...dialog.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled):not([type="hidden"]), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]')].filter(node => node.getClientRects().length);
        const first = nodes[0], last = nodes[nodes.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog)) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener("keydown", key);
    return () => { cancelAnimationFrame(timer); document.removeEventListener("keydown", key); previous?.focus({ preventScroll: true }); };
  }, [open, onClose]);
}
export function FinancePanelHeader({ title, subtitle, onClose, titleId }: {title: string; subtitle?: string; onClose: () => void; titleId?: string}) {
  return <header className="finance-panel-header"><div className="finance-panel-heading"><span className="finance-panel-eyebrow">ATLAS FINANCE / YOUR MONEY</span><h2 id={titleId}>{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button type="button" className="finance-panel-close" aria-label="Close dialog" onClick={onClose}><X size={20}/></button></header>;
}
export function Modal({isOpen,onClose,title,subtitle,children,maxWidthClassName="max-w-lg"}: ModalProps) {
  useFinanceDialog(isOpen,onClose);
  const id=useId();
  if (!isOpen) return null;
  return <div className="finance-workspace-overlay" onClick={onClose}><section className={`finance-workspace finance-form-workspace ${maxWidthClassName}`} role="dialog" aria-modal="true" aria-labelledby={id} tabIndex={-1} onClick={event=>event.stopPropagation()}><FinancePanelHeader title={title || "Your finances"} subtitle={subtitle} onClose={onClose} titleId={id}/><div className="finance-panel-content">{children}</div></section></div>;
}
