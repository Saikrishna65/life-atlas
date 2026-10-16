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
  const secondBoxRef = useRef<HTMLDivElement>(null);
  const thirdBoxRef = useRef<HTMLDivElement>(null);
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

    // Create deterministic GSAP ScrollTrigger timeline:
    // Text comes from out of the bottom of the hero and exits out of the top on scroll
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

      // 1. STAGE 1 (Left): Starts in view, scrolls straight UP and completely exits out of the hero top (0% -> 26%)
      if (headlineBoxRef.current) {
        tl.to(
          headlineBoxRef.current,
          {
            y: "-110vh",
            opacity: 0,
            ease: "power1.in",
            duration: 0.26,
          },
          0
        );
      }

      // Scroll Prompt: Scrolls off to top (0% -> 10%)
      if (scrollPromptRef.current) {
        tl.to(
          scrollPromptRef.current,
          {
            y: "-40vh",
            opacity: 0,
            ease: "power1.in",
            duration: 0.10,
          },
          0
        );
      }

      // Featured Destination Card: Scrolls off (15% -> 32%)
      if (featuredCardRef.current) {
        tl.to(
          featuredCardRef.current,
          {
            y: "-40vh",
            opacity: 0,
            ease: "power1.in",
            duration: 0.17,
          },
          0.15
        );
      }

      // 2. STAGE 2 (Mid-Left: between left and center):
      // Comes from OUT of the bottom of the hero (+110vh), passes through center, exits out of the top (-110vh)
      if (secondBoxRef.current) {
        // Enters from bottom: +110vh -> 0 (16% -> 38%)
        tl.fromTo(
          secondBoxRef.current,
          { y: "110vh", yPercent: -50, opacity: 0 },
          {
            y: "0vh",
            yPercent: -50,
            opacity: 1,
            ease: "power1.out",
            duration: 0.22,
          },
          0.16
        );

        // Exits out of top: 0 -> -110vh (42% -> 62%)
        tl.to(
          secondBoxRef.current,
          {
            y: "-110vh",
            yPercent: -50,
            opacity: 0,
            ease: "power1.in",
            duration: 0.20,
          },
          0.42
        );
      }

      // 3. STAGE 3 (Center):
      // Comes from OUT of the bottom of the hero (+110vh), passes through center, exits out of the top (-110vh)
      if (thirdBoxRef.current) {
        // Enters from bottom: +110vh -> 0 (50% -> 72%)
        tl.fromTo(
          thirdBoxRef.current,
          { y: "110vh", yPercent: -50, xPercent: -50, opacity: 0 },
          {
            y: "0vh",
            yPercent: -50,
            xPercent: -50,
            opacity: 1,
            ease: "power1.out",
            duration: 0.22,
          },
          0.50
        );

        // Exits out of top: 0 -> -110vh (76% -> 96%)
        tl.to(
          thirdBoxRef.current,
          {
            y: "-110vh",
            yPercent: -50,
            xPercent: -50,
            opacity: 0,
            ease: "power1.in",
            duration: 0.20,
          },
          0.76
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
      data-hero
      data-theme="dark"
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

          {/* ========================================================= */}
          {/* STAGE 1: Left Editorial Text (Initial Screen: 0% -> 26%) */}
          {/* ========================================================= */}
          <div
            ref={headlineBoxRef}
            className="max-w-md lg:max-w-lg flex flex-col items-start text-left pointer-events-auto mt-2 md:mt-6 will-change-transform"
          >
            <div className="flex items-center gap-2 mb-3">
              <span className="w-1.5 h-1.5 rounded-full bg-white" />
              <span className="font-sans text-[10px] md:text-[11px] uppercase tracking-[0.3em] text-white/80 font-semibold">
                Life Atlas &bull; Archive &amp; Memories
              </span>
            </div>

            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl text-white tracking-[-0.025em] font-light leading-[1.06] mb-5">
              A place for the <span className="italic font-normal">moments</span> I want to remember.
            </h1>

            <p className="font-body text-xs sm:text-sm text-white/85 leading-relaxed mb-6 max-w-sm">
              Behind every door lies a quiet world waiting to be remembered. An intimate atlas of journeys,
              hidden places, and the landscapes that stay with us long after coming home.
            </p>

            <Link
              href="/explore"
              className="inline-flex items-center gap-2 px-6 py-3 bg-white text-slate-950 font-sans font-semibold text-[11px] uppercase tracking-widest rounded-lg hover:bg-white/90 backdrop-blur-md transition-all duration-300 hover:scale-[1.02]"
            >
              Explore the atlas &rarr;
            </Link>
          </div>

          {/* ========================================================= */}
          {/* STAGE 2: Mid-Left Text (Between Left and Center: 16% -> 62%) */}
          {/* ========================================================= */}
          <div
            ref={secondBoxRef}
            className="absolute left-6 md:left-[18%] lg:left-[22%] top-1/2 max-w-sm sm:max-w-md lg:max-w-lg flex flex-col items-start text-left pointer-events-auto will-change-transform z-20"
          >
            <div className="flex items-center gap-2 mb-3">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              <span className="font-sans text-[10px] md:text-[11px] uppercase tracking-[0.3em] text-white/80 font-semibold">
                Chapter 01 &bull; The Opening
              </span>
            </div>

            <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl text-white tracking-[-0.025em] font-light leading-[1.1] mb-4">
              A window to <span className="italic font-normal">untouched</span> silence.
            </h2>

            <p className="font-body text-xs sm:text-sm text-white/85 leading-relaxed mb-6 max-w-sm">
              The path to discovery is limitless, carrying us past the everyday into ridgelines, quiet trails, and mornings where the world feels brand new.
            </p>

            <Link
              href="/trips/himalayan-journey"
              className="inline-flex items-center gap-2 text-[11px] font-sans font-semibold uppercase tracking-widest text-white hover:text-white/80 transition-colors group"
            >
              <span className="border-b border-white group-hover:border-white/60 pb-0.5 transition-colors">
                Discover the Himalayan Route
              </span>
              <span className="transition-transform group-hover:translate-x-1">&rarr;</span>
            </Link>
          </div>

          {/* ========================================================= */}
          {/* STAGE 3: Centered Text (Camera Fly-Through: 50% -> 96%) */}
          {/* ========================================================= */}
          <div
            ref={thirdBoxRef}
            className="absolute left-1/2 top-1/2 max-w-xl lg:max-w-2xl w-full px-6 flex flex-col items-center text-center pointer-events-auto will-change-transform z-20"
          >
            <div className="flex items-center gap-2 mb-3">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              <span className="font-sans text-[10px] md:text-[11px] uppercase tracking-[0.3em] text-white/80 font-semibold">
                Chapter 02 &bull; The Horizon
              </span>
            </div>

            <h2 className="font-display text-4xl sm:text-5xl lg:text-6xl text-white tracking-[-0.025em] font-light leading-[1.08] mb-5 max-w-xl">
              Where the sky <span className="italic font-normal">meets</span> the earth.
            </h2>

            <p className="font-body text-xs sm:text-sm md:text-base text-white/85 leading-relaxed mb-6 max-w-md">
              To travel is to collect moments that outlive the journey. The quiet of 3,600 meters, wind through ancient stone, and the road that stays with you forever.
            </p>

            <Link
              href="/trips"
              className="inline-flex items-center gap-2 px-6 py-3 bg-white text-slate-950 font-sans font-semibold text-[11px] uppercase tracking-widest rounded-lg hover:bg-white/90 backdrop-blur-md transition-all duration-300 hover:scale-[1.02]"
            >
              Explore all journeys &rarr;
            </Link>
          </div>

          {/* Bottom Bar: Scroll Indicator (Center/Left) + Featured Story Card (Bottom Right) */}
          <div className="w-full flex items-end justify-between">
            {/* Scroll Prompt */}
            <div
              ref={scrollPromptRef}
              className="flex flex-col items-start gap-2 pointer-events-none will-change-transform"
            >
              <span className="font-sans text-[10px] uppercase tracking-[0.3em] text-white/80 font-semibold">
                Scroll to explore
              </span>
              <div className="w-8 h-[1px] bg-white/60" />
            </div>

            {/* Featured Destination Card (Inspired by reference bottom-right card) */}
            <Link
              ref={featuredCardRef}
              href="/trips/himalayan-journey"
              className="hidden sm:flex items-center gap-3.5 p-2.5 pr-5 bg-black/40 hover:bg-black/60 backdrop-blur-md rounded-xl border border-white/20 transition-all duration-300 group pointer-events-auto max-w-xs will-change-transform"
            >
              <div className="relative w-16 h-14 rounded-lg overflow-hidden shrink-0 bg-slate-800">
                <Image
                  src="/placeholder-image.jpg"
                  alt="The Himalayan Journey"
                  fill
                  sizes="64px"
                  className="object-cover group-hover:scale-105 transition-transform duration-500"
                />
              </div>
              <div className="flex flex-col text-left">
                <span className="font-sans text-[9px] uppercase tracking-widest text-white/60 font-semibold">
                  Featured Journey
                </span>
                <span className="font-display text-sm font-medium text-white line-clamp-1 group-hover:text-white/80 transition-colors">
                  The Himalayan Journey
                </span>
                <span className="font-sans text-[10px] text-white/70">
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
