import { useEffect } from "react";

/**
 * useLockBodyScroll
 * Locks document.body overflow when a modal or dialog is open,
 * preventing the background page from scrolling beneath it.
 * Compensates for scrollbar width to prevent layout shift.
 */
export function useLockBodyScroll(isLocked: boolean = true) {
  useEffect(() => {
    if (!isLocked || typeof document === "undefined") return;

    const originalOverflow = document.body.style.overflow;
    const originalPosition = document.body.style.position;
    const originalTop = document.body.style.top;
    const originalWidth = document.body.style.width;

    const scrollY = window.scrollY;

    // Lock body
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.position = originalPosition;
      document.body.style.top = originalTop;
      document.body.style.width = originalWidth;
      window.scrollTo(0, scrollY);
    };
  }, [isLocked]);
}
