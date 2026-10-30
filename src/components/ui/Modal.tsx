"use client";

import React, { useEffect } from "react";
import { X } from "lucide-react";
import { useLockBodyScroll } from "@/lib/vault/useLockBodyScroll";

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  maxWidthClassName?: string;
  showCloseButton?: boolean;
}

export function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  maxWidthClassName = "max-w-lg",
  showCloseButton = true,
}: ModalProps) {
  // Lock body scroll whenever modal is active
  useLockBodyScroll(isOpen);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-fade-in overflow-y-auto"
      onClick={onClose}
    >
      <div
        className={`w-full ${maxWidthClassName} my-auto max-h-[90vh] flex flex-col rounded-2xl border border-muted bg-background shadow-2xl overflow-hidden overscroll-contain animate-fade-in-up`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        {(title || showCloseButton) && (
          <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-muted bg-surface/50 shrink-0">
            <div>
              {title && (
                <h3 className="font-display text-lg sm:text-xl text-foreground font-normal tracking-tight">
                  {title}
                </h3>
              )}
              {subtitle && (
                <p className="font-sans text-xs text-muted-foreground mt-0.5">
                  {subtitle}
                </p>
              )}
            </div>

            {showCloseButton && (
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-xl border border-transparent hover:border-muted hover:bg-surface text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {/* Modal Scrollable Body */}
        <div className="p-5 sm:p-6 overflow-y-auto overscroll-contain flex-1">
          {children}
        </div>
      </div>
    </div>
  );
}
