"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

const HeroScene = dynamic(() => import("./hero/HeroScene"), {
  ssr: false,
  loading: () => (
    <div
      className="absolute inset-0 w-full h-full"
      style={{
        background: "linear-gradient(180deg, #7baad3 0%, #a4c9e5 45%, #b6cfdf 58%, #7e9bb5 100%)",
      }}
    />
  ),
});

export default function Hero() {
  const containerRef = useRef<HTMLDivElement>(null);
  const headlineBoxRef = useRef<HTMLDivElement>(null);
  const scrollPromptRef = useRef<HTMLDivElement>(null);
  const featuredCardRef = useRef<HTMLAnchorElement>(null);
  const progressRef = useRef<number>(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    // Check reduced motion preference
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mediaQuery.matches) {
      setPrefersReducedMotion(true);
      return;
    }

    const container = containerRef.current;
    if (!container) return;

    // Create deterministic GSAP ScrollTrigger timeline
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: container,
          start: "top top",
          end: "bottom bottom",
          scrub: 0.1,
          onUpdate: (self) => {
            progressRef.current = self.progress;
          },
        },
      });

      // 1. Fade out left editorial box (headline, description, CTA) early (0% -> 15%)
      if (headlineBoxRef.current) {
        tl.to(
          headlineBoxRef.current,
          {
            opacity: 0,
            y: -28,
            ease: "power1.out",
            duration: 0.15,
          },
          0
        );
      }

      // 2. Fade out scroll prompt promptly (0% -> 8%)
      if (scrollPromptRef.current) {
        tl.to(
          scrollPromptRef.current,
          {
            opacity: 0,
            y: -14,
            ease: "power1.out",
            duration: 0.08,
          },
          0
        );
      }

      // 3. Featured destination card stays visible during door opening, then gracefully fades out as camera approaches the opening (48% -> 72%)
      if (featuredCardRef.current) {
        tl.to(
          featuredCardRef.current,
          {
            opacity: 0,
            scale: 0.94,
            ease: "power1.inOut",
            duration: 0.24,
          },
          0.48
        );
      }
    }, containerRef);

    return () => {
      ctx.revert();
    };
  }, []);

  return (
    <section
      ref={containerRef}
      className="relative w-full text-foreground"
      style={{
        height: prefersReducedMotion ? "100vh" : "340vh",
      }}
      aria-label="Life Atlas Hero"
    >
      {/* Pinned Sticky Viewport */}
      <div className="sticky top-0 h-screen w-full overflow-hidden flex flex-col justify-between">
        {/* Background Cinematic Canvas Scene */}
        <div className="absolute inset-0 z-0">
          <HeroScene progressRef={progressRef} />
        </div>

        {/* Main Content Layout — Modeled after Travel Next Level Composition */}
        <div className="relative z-10 w-full h-full flex flex-col justify-between pointer-events-none px-6 md:px-12 lg:px-16 pt-24 md:pt-28 pb-8">
          {/* Left Side Editorial Box (Balanced without obstructing the center door) */}
          <div
            ref={headlineBoxRef}
            className="max-w-md lg:max-w-lg flex flex-col items-start text-left pointer-events-auto mt-4 md:mt-8 will-change-transform"
          >
            <span className="font-sans text-[10px] md:text-[11px] uppercase tracking-[0.3em] text-slate-800/80 font-semibold mb-3 drop-shadow-sm">
              Life Atlas &bull; Archive &amp; Memories
            </span>

            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl text-slate-900 tracking-[-0.025em] font-light leading-[1.06] mb-5 drop-shadow-[0_1px_2px_rgba(255,255,255,0.7)]">
              A place for the <span className="italic font-normal">moments</span> I want to remember.
            </h1>

            <p className="font-body text-xs sm:text-sm text-slate-700/85 leading-relaxed mb-6 max-w-sm drop-shadow-sm">
              Behind every door lies a quiet world waiting to be remembered. An intimate atlas of journeys,
              hidden places, and the landscapes that stay with us long after coming home.
            </p>

            <Link
              href="/explore"
              className="inline-flex items-center gap-2 px-6 py-3 bg-white/90 hover:bg-white text-slate-900 font-sans font-semibold text-[11px] uppercase tracking-widest rounded-lg shadow-sm hover:shadow-md border border-slate-200/60 backdrop-blur-md transition-all duration-300 hover:scale-[1.02]"
            >
              Explore the atlas &rarr;
            </Link>
          </div>

          {/* Bottom Bar: Scroll Indicator (Center/Left) + Featured Story Card (Bottom Right) */}
          <div className="w-full flex items-end justify-between">
            {/* Scroll Prompt */}
            <div
              ref={scrollPromptRef}
              className="flex flex-col items-start gap-2 pointer-events-none will-change-transform"
            >
              <span className="font-sans text-[10px] uppercase tracking-[0.3em] text-slate-700/90 font-semibold drop-shadow-sm">
                Scroll to explore
              </span>
              <div className="w-8 h-[1px] bg-slate-700/50 shadow-sm" />
            </div>

            {/* Featured Destination Card (Inspired by reference bottom-right card) */}
            <Link
              ref={featuredCardRef}
              href="/trips/himalayan-journey"
              className="hidden sm:flex items-center gap-3.5 p-2.5 pr-5 bg-white/85 hover:bg-white/95 backdrop-blur-md rounded-xl border border-white/60 shadow-sm hover:shadow-md transition-all duration-300 group pointer-events-auto max-w-xs will-change-transform"
            >
              <div className="relative w-16 h-14 rounded-lg overflow-hidden shrink-0 bg-slate-200">
                <Image
                  src="/placeholder-image.jpg"
                  alt="The Himalayan Journey"
                  fill
                  sizes="64px"
                  className="object-cover group-hover:scale-105 transition-transform duration-500"
                />
              </div>
              <div className="flex flex-col text-left">
                <span className="font-sans text-[9px] uppercase tracking-widest text-slate-500 font-semibold">
                  Featured Journey
                </span>
                <span className="font-display text-sm font-medium text-slate-900 line-clamp-1 group-hover:text-accent transition-colors">
                  The Himalayan Journey
                </span>
                <span className="font-sans text-[10px] text-slate-500">
                  Uttarakhand &bull; Autumn 2026
                </span>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
