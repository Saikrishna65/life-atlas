"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

export default function GlobePlaceholder() {
  const containerRef = useRef<HTMLDivElement>(null);
  const globeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return;

    if (containerRef.current && globeRef.current) {
      gsap.fromTo(
        globeRef.current,
        { scale: 0.8, opacity: 0, y: 100 },
        {
          scale: 1,
          opacity: 1,
          y: 0,
          ease: "power2.out",
          scrollTrigger: {
            trigger: containerRef.current,
            start: "top 80%",
            end: "center center",
            scrub: 1,
          },
        }
      );
    }
  }, []);

  return (
    <section ref={containerRef} className="py-32 md:py-48 px-6 flex flex-col items-center justify-center bg-background min-h-screen">
      <div className="text-center mb-16 md:mb-24">
        <h2 className="font-sans text-sm tracking-[0.2em] uppercase text-muted-foreground mb-4">
          Atmosphere
        </h2>
        <p className="font-display text-3xl md:text-4xl lg:text-5xl max-w-3xl">
          The world, mapped through personal journeys.
        </p>
      </div>

      <div 
        ref={globeRef}
        className="w-full max-w-3xl aspect-square md:aspect-video bg-muted/50 rounded-full md:rounded-[4rem] border border-muted flex items-center justify-center relative overflow-hidden"
      >
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="font-sans text-muted-foreground tracking-widest uppercase text-sm">
            [ Interactive Globe Placeholder ]
          </p>
        </div>
      </div>
    </section>
  );
}
