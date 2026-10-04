"use client";

import dynamic from "next/dynamic";
import { useState, useEffect, useRef } from "react";
import type { GlobePlace } from "./InteractiveGlobe";

const Globe = dynamic(() => import("./InteractiveGlobe"), { ssr: false });

export default function LazyGlobe({ places }: { places: GlobePlace[] }) {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    let idleCallbackId: number;
    
    const loadGlobe = () => {
      setIsVisible(true);
      clearTimeout(timeout);
      if (typeof window !== 'undefined' && 'cancelIdleCallback' in window) {
        window.cancelIdleCallback(idleCallbackId);
      }
    };
    
    // Load globe during the browser's idle time so it doesn't block scrolling or initial render
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      idleCallbackId = window.requestIdleCallback(() => {
        loadGlobe();
      }, { timeout: 3000 });
    } else {
      // Fallback for Safari
      timeout = setTimeout(loadGlobe, 1500);
    }

    return () => {
      clearTimeout(timeout);
      if (typeof window !== 'undefined' && 'cancelIdleCallback' in window) {
        window.cancelIdleCallback(idleCallbackId);
      }
    };
  }, []);

  return (
    <div ref={ref} className="min-h-screen w-full">
      {isVisible ? (
        <Globe places={places} />
      ) : (
        <div className="relative py-24 md:py-32 flex flex-col items-center justify-center bg-background min-h-screen">
          <div className="w-12 h-12 border border-muted/30 rounded-full animate-pulse" />
          <p className="mt-4 font-sans text-[10px] uppercase tracking-widest text-muted-foreground">
            Loading atmosphere...
          </p>
        </div>
      )}
    </div>
  );
}
