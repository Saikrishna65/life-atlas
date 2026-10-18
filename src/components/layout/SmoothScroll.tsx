"use client";

import { ReactLenis, useLenis } from "lenis/react";
import { ReactNode, useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

function ScrollTriggerSync() {
  useLenis((lenis) => {
    if (typeof window !== "undefined") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__lenis = lenis;
    }
    ScrollTrigger.update();
  });
  return null;
}

export default function SmoothScroll({ children }: { children: ReactNode }) {
  useEffect(() => {
    gsap.ticker.lagSmoothing(0);
  }, []);

  return (
    <ReactLenis
      root
      options={{
        lerp: 0.1,
        smoothWheel: true,
        syncTouch: false,
      }}
    >
      <ScrollTriggerSync />
      {children}
    </ReactLenis>
  );
}
