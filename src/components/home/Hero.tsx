"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";

export default function Hero() {
  const heroRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const subtitleRef = useRef<HTMLParagraphElement>(null);
  const bgRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return;

    const tl = gsap.timeline();

    tl.fromTo(
      bgRef.current,
      { scale: 1.05, opacity: 0 },
      { scale: 1, opacity: 1, duration: 2, ease: "power2.out" }
    )
    .fromTo(
      titleRef.current,
      { y: 30, opacity: 0 },
      { y: 0, opacity: 1, duration: 1.2, ease: "power3.out" },
      "-=1.2"
    )
    .fromTo(
      subtitleRef.current,
      { y: 20, opacity: 0 },
      { y: 0, opacity: 1, duration: 1, ease: "power3.out" },
      "-=0.8"
    );

  }, []);

  return (
    <section 
      ref={heroRef} 
      className="relative h-screen w-full flex items-center justify-center overflow-hidden bg-foreground text-background"
    >
      <div 
        ref={bgRef}
        className="absolute inset-0 z-0 bg-[#1a1a1a] opacity-0"
      >
        <div className="absolute inset-0 bg-black/40 z-10" />
      </div>
      
      <div className="relative z-10 text-center px-6 max-w-4xl mx-auto flex flex-col items-center gap-6 mt-16">
        <h1 
          ref={titleRef}
          className="font-display text-4xl md:text-6xl lg:text-7xl xl:text-8xl leading-tight opacity-0"
        >
          A place for the moments I want to remember.
        </h1>
        <p 
          ref={subtitleRef}
          className="font-body text-lg md:text-xl max-w-2xl text-white/80 opacity-0"
        >
          Travels, places, people, food, films and everything in between.
        </p>
      </div>
      
      <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2">
        <span className="font-sans text-xs uppercase tracking-widest text-white/50">Scroll to explore</span>
        <div className="w-[1px] h-12 bg-white/30" />
      </div>
    </section>
  );
}
