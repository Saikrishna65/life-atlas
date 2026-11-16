"use client";

import { ReactLenis, useLenis } from "lenis/react";
import { ReactNode, useEffect, useMemo } from "react";
import {usePathname} from "next/navigation";
import {isPublicPath} from "@/lib/public-loading/readiness";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

function ScrollTriggerSync({publicRoute}:{publicRoute:boolean}) {
  const instance=useLenis();
  useEffect(()=>{if(!publicRoute||!instance)return;const tick=(seconds:number)=>instance.raf(seconds*1000);gsap.ticker.add(tick);return()=>gsap.ticker.remove(tick);},[instance,publicRoute]);
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
  const publicRoute=isPublicPath(usePathname());
  const options=useMemo(()=>({lerp:.1,smoothWheel:true,syncTouch:false,autoRaf:!publicRoute}),[publicRoute]);
  useEffect(() => {
    gsap.ticker.lagSmoothing(0);
  }, []);

  return (
    <ReactLenis
      root
      options={options}
    >
      <ScrollTriggerSync publicRoute={publicRoute} />
      {children}
    </ReactLenis>
  );
}
