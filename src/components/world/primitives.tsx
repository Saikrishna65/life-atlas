"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { X, ArrowUpRight, Search, Asterisk } from "lucide-react";
import { createPortal } from "react-dom";
import { useLenis } from "lenis/react";
export function ChapterLabel({
  number,
  children,
}: {
  number: string;
  children: ReactNode;
}) {
  return (
    <div className="world-eyebrow">
      <Asterisk
        className="world-cross"
        size={22}
        strokeWidth={1.5}
        aria-hidden="true"
      />
      <span>
        {number} / {children}
      </span>
    </div>
  );
}
export function ArrowLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <a className="world-link" href={href}>
      {children}
      <ArrowUpRight size={17} />
    </a>
  );
}
export function SearchField({
  value,
  onChange,
  label,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder?: string;
}) {
  return (
    <label className="world-search">
      <Search size={16} />
      <span className="sr-only">{label}</span>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? label}
      />
    </label>
  );
}
export function Modal({
  title,
  onClose,
  children,
  className = "",
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const closeRef = useRef(onClose);
  const lenis = useLenis();
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const previous = document.activeElement as HTMLElement | null;
    dialog.showModal();
    lenis?.stop();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
      lenis?.start();
      previous?.focus({ preventScroll: true });
    };
  }, [lenis]);
  return createPortal(
    <dialog
      ref={ref}
      aria-label={title}
      className={`world-modal ${className}`}
      data-lenis-prevent
      onKeyDown={(e) => {
        if (e.key !== "Tab") return;
        const controls = Array.from(
          e.currentTarget.querySelectorAll<HTMLElement>(
            'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
          ),
        ).filter((el) => el.getClientRects().length > 0);
        const first = controls[0],
          last = controls[controls.length - 1];
        if (!first) {
          e.preventDefault();
          return;
        }
        if (
          e.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === e.currentTarget)
        ) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }}
      onCancel={(e) => {
        e.preventDefault();
        closeRef.current();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="world-modal-inner">
        <header className="world-modal-header">
          <span className="world-eyebrow">Life Atlas / Field notes</span>
          <button
            onClick={onClose}
            className="world-icon"
            aria-label="Close dialog"
          >
            <X size={21} />
          </button>
        </header>
        {children}
      </div>
    </dialog>,
    document.body,
  );
}
export function Empty({
  children,
  onReset,
}: {
  children: ReactNode;
  onReset: () => void;
}) {
  return (
    <div className="world-empty">
      <p>{children}</p>
      <button className="world-link" onClick={onReset}>
        Clear filters <ArrowUpRight size={17} />
      </button>
    </div>
  );
}
export function DemoNote({
  children = "A fictional collection. Real possibilities.",
}: {
  children?: ReactNode;
}) {
  return (
    <p className="world-demo">
      <span />
      Demonstration / {children}
    </p>
  );
}
export function AlbumArt({
  variant,
  color,
  label,
  className = "",
}: {
  variant: number;
  color: string;
  label: string;
  className?: string;
}) {
  return (
    <div
      role="img"
      aria-label={`Original abstract artwork for ${label}`}
      className={`album-art art-${variant} ${className}`}
      style={{ "--art-color": color } as React.CSSProperties}
    >
      <div className="art-orbit" />
      <div className="art-orbit second" />
      <div className="art-grain" />
      <span className="art-index">
        L/A — {String(variant + 1).padStart(2, "0")}
      </span>
    </div>
  );
}
