"use client";

import { useEffect, useState, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Loader2 } from "lucide-react";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

export default function HomePreloader() {
  const [isMounted, setIsMounted] = useState(true);
  const overlayRef = useRef<HTMLDivElement>(null);
  const isExitingRef = useRef(false);

  useEffect(() => {
    // 1. Lock scroll while preloading
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    let isDisposed = false;
    const startTime = Date.now();
    const MIN_DISPLAY_TIME = 350; // smooth minimum display to prevent jarring flicker

    const dismiss = () => {
      if (isDisposed || isExitingRef.current) return;
      isExitingRef.current = true;

      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, MIN_DISPLAY_TIME - elapsed);

      setTimeout(() => {
        if (isDisposed) return;
        const overlay = overlayRef.current;
        if (!overlay) {
          document.body.style.overflow = originalOverflow;
          setIsMounted(false);
          return;
        }

        overlay.style.pointerEvents = "none";
        gsap.to(overlay, {
          opacity: 0,
          duration: 0.35,
          ease: "power2.out",
          onComplete: () => {
            document.body.style.overflow = originalOverflow;
            setIsMounted(false);
            ScrollTrigger.refresh();
          },
        });
      }, remaining);
    };

    // Check fonts
    if (typeof document !== "undefined" && document.fonts) {
      document.fonts.ready.then(() => dismiss()).catch(() => dismiss());
    } else {
      dismiss();
    }

    // Hero ready listeners if emitted
    window.addEventListener("hero-scene-ready", dismiss, { once: true });
    window.addEventListener("hero-ready", dismiss, { once: true });

    // Safety fallback timeout
    const safetyTimer = setTimeout(() => {
      dismiss();
    }, 1200);

    return () => {
      isDisposed = true;
      clearTimeout(safetyTimer);
      window.removeEventListener("hero-scene-ready", dismiss);
      window.removeEventListener("hero-ready", dismiss);
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  if (!isMounted) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[99999] bg-white flex items-center justify-center select-none"
      role="status"
      aria-live="polite"
      aria-label="Loading"
    >
      <Loader2 className="w-8 h-8 text-neutral-800 animate-spin" />
    </div>
  );
}

