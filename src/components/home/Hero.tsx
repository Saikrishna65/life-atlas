"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
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

interface HeroProps {
  onReady?: () => void;
}

export default function Hero({ onReady }: HeroProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const headlineBoxRef = useRef<HTMLDivElement>(null);
  const secondBoxRef = useRef<HTMLDivElement>(null);
  const thirdBoxRef = useRef<HTMLDivElement>(null);
  const scrollPromptRef = useRef<HTMLDivElement>(null);
  const featuredCardRef = useRef<HTMLAnchorElement>(null);
  const progressRef = useRef<number>(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => {
    if (typeof window !== "undefined") {
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }
    return false;
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handleMotionChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };
    mediaQuery.addEventListener("change", handleMotionChange);

    if (mediaQuery.matches) {
      return () => {
        mediaQuery.removeEventListener("change", handleMotionChange);
      };
    }

    const container = containerRef.current;
    if (!container) return;

    // Detect mobile browser or Capacitor native mobile app
    const isMobile =
      (typeof window !== "undefined" && Capacitor.isNativePlatform()) ||
      (typeof navigator !== "undefined" &&
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) ||
      (typeof window !== "undefined" && window.innerWidth < 768);

    let tickerCallback: (() => void) | null = null;
    let st: ScrollTrigger | null = null;

    const targetProgressRef = { current: 0 };
    const currentProgressRef = { current: 0 };

    // Create deterministic GSAP timeline:
    // Driven frame-by-frame by our rate-limited controller so that the animation
    // never exceeds a smooth, cinematic maximum speed regardless of how fast the user scrolls.
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ paused: true });

      // ScrollTrigger strictly tracks container scroll to update targetProgress
      st = ScrollTrigger.create({
        trigger: container,
        start: "top top",
        end: "bottom bottom",
        onUpdate: (self) => {
          targetProgressRef.current = self.progress;
        },
      });

      // Synchronize immediately if page loaded with an existing scroll offset
      if (st.progress) {
        targetProgressRef.current = st.progress;
        currentProgressRef.current = st.progress;
        tl.progress(st.progress);
        progressRef.current = st.progress;
      }

      // Silky exponential smoothing that naturally follows Lenis scroll momentum.
      // Automatically converges as progress reaches the edges so the animation
      // finishes cleanly at the unpin point without any scroll freeze or hitch.
      const baseSpeed = isMobile ? 22 : 18;
      let lastTime = performance.now();

      tickerCallback = () => {
        const now = performance.now();
        const dt = Math.min((now - lastTime) / 1000, 0.05);
        lastTime = now;

        const target = targetProgressRef.current;
        const current = currentProgressRef.current;
        const delta = target - current;
        const dist = Math.abs(delta);

        if (dist < 0.00005) {
          if (current !== target) {
            currentProgressRef.current = target;
            tl.progress(target);
            progressRef.current = target;
          }
          return;
        }

        // Tighter tracking near unpin boundary to ensure seamless transition into subsequent sections
        const speedMultiplier = target >= 0.85 || target <= 0.15 ? baseSpeed + 6 : baseSpeed;
        const rawStep = delta * (1 - Math.exp(-speedMultiplier * dt));

        let nextProgress = current + rawStep;

        // Clean snap to boundaries when within threshold
        if (
          (target === 1.0 && Math.abs(1.0 - nextProgress) < 0.003) ||
          (target === 0.0 && Math.abs(nextProgress) < 0.003) ||
          dist < 0.001
        ) {
          nextProgress = target;
        }

        nextProgress = Math.min(1, Math.max(0, nextProgress));
        currentProgressRef.current = nextProgress;

        // Synchronize both DOM text stages and 3D canvas sequence in exact frame-lock
        tl.progress(nextProgress);
        progressRef.current = nextProgress;
      };

      gsap.ticker.add(tickerCallback);

      // 1. STAGE 1 (Left): Starts in view, scrolls straight UP and completely exits out of the hero top
      if (headlineBoxRef.current) {
        tl.to(
          headlineBoxRef.current,
          {
            y: "-90vh",
            opacity: 0,
            ease: "none",
            duration: 0.22,
          },
          0
        );
        tl.set(headlineBoxRef.current, { pointerEvents: "auto" }, 0);
        tl.set(headlineBoxRef.current, { pointerEvents: "none" }, 0.20);
      }

      // Scroll Prompt: Scrolls off to top (0% -> 12%)
      if (scrollPromptRef.current) {
        tl.to(
          scrollPromptRef.current,
          {
            y: "-40vh",
            opacity: 0,
            ease: "none",
            duration: 0.12,
          },
          0
        );
      }

      // Featured Destination Card: Scrolls off (0% -> 18%)
      if (featuredCardRef.current) {
        tl.to(
          featuredCardRef.current,
          {
            y: "-40vh",
            opacity: 0,
            ease: "none",
            duration: 0.18,
          },
          0
        );
      }

      // 2. STAGE 2 (Mid-Left text):
      // Continuous uninterrupted upward glide from bottom to top according to the scroll — never freezes in the center
      if (secondBoxRef.current) {
        // Continuous upward travel matching scroll 1:1
        tl.fromTo(
          secondBoxRef.current,
          { y: "90vh", yPercent: -50 },
          {
            y: "-90vh",
            yPercent: -50,
            ease: "none",
            duration: 0.44,
          },
          0.14
        );

        // Opacity: fade in as it enters, remain crisp through center, fade out as it exits top
        tl.fromTo(
          secondBoxRef.current,
          { opacity: 0 },
          {
            opacity: 1,
            ease: "power1.out",
            duration: 0.12,
          },
          0.14
        );

        tl.to(
          secondBoxRef.current,
          {
            opacity: 0,
            ease: "power1.in",
            duration: 0.12,
          },
          0.46
        );

        tl.set(secondBoxRef.current, { pointerEvents: "none" }, 0);
        tl.set(secondBoxRef.current, { pointerEvents: "auto" }, 0.20);
        tl.set(secondBoxRef.current, { pointerEvents: "none" }, 0.54);
      }

      // 3. STAGE 3 (Center text):
      // Continuous uninterrupted upward glide from bottom to top according to the scroll — never freezes in the center
      if (thirdBoxRef.current) {
        // Continuous upward travel matching scroll 1:1
        tl.fromTo(
          thirdBoxRef.current,
          { y: "90vh", yPercent: -50, xPercent: -50 },
          {
            y: "-90vh",
            yPercent: -50,
            xPercent: -50,
            ease: "none",
            duration: 0.44,
          },
          0.48
        );

        // Opacity: fade in as it enters, remain crisp through center, fade out as it exits top
        tl.fromTo(
          thirdBoxRef.current,
          { opacity: 0 },
          {
            opacity: 1,
            ease: "power1.out",
            duration: 0.12,
          },
          0.48
        );

        tl.to(
          thirdBoxRef.current,
          {
            opacity: 0,
            ease: "power1.in",
            duration: 0.12,
          },
          0.80
        );

        tl.set(thirdBoxRef.current, { pointerEvents: "none" }, 0);
        tl.set(thirdBoxRef.current, { pointerEvents: "auto" }, 0.54);
        tl.set(thirdBoxRef.current, { pointerEvents: "none" }, 0.88);
      }
    }, containerRef);

    return () => {
      if (tickerCallback) {
        gsap.ticker.remove(tickerCallback);
      }
      if (st) {
        st.kill();
      }
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
        height: prefersReducedMotion ? "100dvh" : "340vh",
      }}
      aria-label="Life Atlas Hero"
    >
      {/* Pinned Sticky Viewport */}
      <div className="sticky top-0 h-[100dvh] w-full overflow-hidden flex flex-col justify-between">
        {/* Background Cinematic Canvas Scene */}
        <div className="absolute inset-0 z-0">
          <HeroScene
            progressRef={progressRef}
            onSceneReady={() => {
              if (typeof window !== "undefined") {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (window as any).__heroReady = true;
                window.dispatchEvent(new CustomEvent("hero-ready"));
              }
              onReady?.();
            }}
          />
        </div>

        {/* Main Content Layout — Modeled after Travel Next Level Composition */}
        <div className="relative z-10 w-full h-full flex flex-col justify-between pointer-events-none px-6 md:px-12 lg:px-16 pt-[calc(env(safe-area-inset-top,0px)+5.5rem)] pb-[calc(env(safe-area-inset-bottom,0px)+2rem)]">

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
                Personal Travel Log &bull; Stories &amp; Places
              </span>
            </div>

            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl text-white tracking-[-0.025em] font-light leading-[1.06] mb-5">
              All my travels and <span className="italic font-normal">memories</span>, in one place.
            </h1>

            <p className="font-body text-xs sm:text-sm text-white/85 leading-relaxed mb-6 max-w-sm">
              Welcome to my travel journal. Here you will find the trips I&apos;ve taken, photos from the road, and the favorite places I never want to forget.
            </p>

            <Link
              href="/explore"
              className="inline-flex items-center gap-2 px-6 py-3 bg-white text-slate-950 font-sans font-semibold text-[11px] uppercase tracking-widest rounded-lg hover:bg-white/90 backdrop-blur-md transition-all duration-300 hover:scale-[1.02]"
            >
              Explore my trips &rarr;
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
                Featured Trip &bull; The Mountains
              </span>
            </div>

            <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl text-white tracking-[-0.025em] font-light leading-[1.1] mb-4">
              Fresh air and <span className="italic font-normal">quiet trails</span>.
            </h2>

            <p className="font-body text-xs sm:text-sm text-white/85 leading-relaxed mb-6 max-w-sm">
              There is nothing quite like taking a break from the daily routine to hike through the hills, see new places, and enjoy nature.
            </p>

            <Link
              href="/trips/himalayan-journey"
              className="inline-flex items-center gap-2 text-[11px] font-sans font-semibold uppercase tracking-widest text-white hover:text-white/80 transition-colors group"
            >
              <span className="border-b border-white group-hover:border-white/60 pb-0.5 transition-colors">
                View the Himalayan trip
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
                Travel Stories &bull; Looking Back
              </span>
            </div>

            <h2 className="font-display text-4xl sm:text-5xl lg:text-6xl text-white tracking-[-0.025em] font-light leading-[1.08] mb-5 max-w-xl">
              Every trip has a <span className="italic font-normal">story</span> to tell.
            </h2>

            <p className="font-body text-xs sm:text-sm md:text-base text-white/85 leading-relaxed mb-6 max-w-md">
              Whether it is a weekend road trip or an adventure far from home, the best part of traveling is the good memories and photos you bring back.
            </p>

            <Link
              href="/trips"
              className="inline-flex items-center gap-2 px-6 py-3 bg-white text-slate-950 font-sans font-semibold text-[11px] uppercase tracking-widest rounded-lg hover:bg-white/90 backdrop-blur-md transition-all duration-300 hover:scale-[1.02]"
            >
              See all trips &rarr;
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
                Scroll down to explore
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
                  Featured Trip
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
