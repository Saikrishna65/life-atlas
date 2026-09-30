"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

interface GlobePlace {
  id: string;
  name: string;
  slug: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
  tripPlaces: { trip: { title: string; slug: string } }[];
}

interface InteractiveGlobeProps {
  places: GlobePlace[];
}

export default function InteractiveGlobe({ places }: InteractiveGlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const globeContainerRef = useRef<HTMLDivElement>(null);
  const globeInstanceRef = useRef<unknown>(null);
  const [hoveredPlace, setHoveredPlace] = useState<GlobePlace | null>(null);
  const [isGlobeReady, setIsGlobeReady] = useState(false);
  const router = useRouter();

  const validPlaces = places.filter(p => p.latitude !== null && p.longitude !== null);

  const initGlobe = useCallback(async () => {
    if (typeof window === "undefined" || !globeContainerRef.current || globeInstanceRef.current) return;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Dynamically import to avoid SSR issues
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const GlobeModule = await import("react-globe.gl") as any;
    const GlobeFn = GlobeModule.default || GlobeModule;

    const containerEl = globeContainerRef.current;
    if (!containerEl) return;
    const width = containerEl.clientWidth;
    const height = containerEl.clientHeight;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const globe = GlobeFn({ animateIn: !prefersReducedMotion }) as any;
    globe(containerEl)
      .width(width)
      .height(height)
      .backgroundColor("rgba(0,0,0,0)")
      .globeImageUrl("//unpkg.com/three-globe/example/img/earth-dark.jpg")
      .bumpImageUrl("//unpkg.com/three-globe/example/img/earth-topology.png")
      .atmosphereColor("#1a1a2e")
      .atmosphereAltitude(0.15)
      .pointsData(validPlaces)
      .pointLat((d: unknown) => (d as GlobePlace).latitude!)
      .pointLng((d: unknown) => (d as GlobePlace).longitude!)
      .pointColor(() => "#e8c547")
      .pointAltitude(0.02)
      .pointRadius(0.4)
      .pointsMerge(false)
      .onPointHover((point: unknown) => {
        setHoveredPlace(point as GlobePlace | null);
        if (containerEl) {
          containerEl.style.cursor = point ? "pointer" : "grab";
        }
      })
      .onPointClick((point: unknown) => {
        const p = point as GlobePlace;
        if (p?.slug) {
          router.push(`/places/${p.slug}`);
        }
      })
      .labelsData(validPlaces)
      .labelLat((d: unknown) => (d as GlobePlace).latitude!)
      .labelLng((d: unknown) => (d as GlobePlace).longitude!)
      .labelText((d: unknown) => (d as GlobePlace).name)
      .labelSize(0.6)
      .labelDotRadius(0.3)
      .labelColor(() => "rgba(232, 197, 71, 0.7)")
      .labelResolution(2);

    // Subtle auto-rotation
    const controls = globe.controls?.();
    if (controls) {
      controls.autoRotate = !prefersReducedMotion;
      controls.autoRotateSpeed = 0.3;
      controls.enableZoom = true;
      controls.minDistance = 150;
      controls.maxDistance = 500;
    }

    globeInstanceRef.current = globe;
    setIsGlobeReady(true);

    // Handle resize
    const handleResize = () => {
      if (containerEl && globe) {
        globe.width(containerEl.clientWidth);
        globe.height(containerEl.clientHeight);
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [validPlaces, router]);

  useEffect(() => {
    initGlobe();
  }, [initGlobe]);

  // Scroll-triggered entrance animation
  useEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion || !containerRef.current) return;

    gsap.fromTo(
      containerRef.current,
      { opacity: 0, y: 80 },
      {
        opacity: 1,
        y: 0,
        ease: "power2.out",
        scrollTrigger: {
          trigger: containerRef.current,
          start: "top 85%",
          end: "top 40%",
          scrub: 1,
        },
      }
    );
  }, []);

  return (
    <section
      ref={containerRef}
      className="relative py-24 md:py-32 px-6 flex flex-col items-center justify-center bg-background min-h-screen"
    >
      <div className="text-center mb-12 md:mb-16">
        <h2 className="font-sans text-[10px] md:text-xs tracking-[0.2em] uppercase text-muted-foreground mb-4">
          Atmosphere
        </h2>
        <p className="font-display text-3xl md:text-4xl lg:text-5xl max-w-3xl text-foreground">
          The world, mapped through personal journeys.
        </p>
      </div>

      <div className="relative w-full max-w-4xl aspect-square md:aspect-[4/3]">
        <div
          ref={globeContainerRef}
          className="w-full h-full"
          style={{ cursor: "grab" }}
        />

        {/* Loading state */}
        {!isGlobeReady && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 border border-muted/30 rounded-full animate-pulse" />
              <p className="font-sans text-[10px] uppercase tracking-widest text-muted-foreground">
                Loading globe...
              </p>
            </div>
          </div>
        )}

        {/* Hover tooltip */}
        {hoveredPlace && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-foreground/90 text-background px-6 py-3 rounded-sm backdrop-blur-sm pointer-events-none z-10">
            <p className="font-sans text-xs uppercase tracking-widest mb-1">
              {hoveredPlace.name}
            </p>
            <p className="font-sans text-[10px] text-background/60 uppercase tracking-wider">
              {hoveredPlace.country}
              {hoveredPlace.tripPlaces?.[0]?.trip?.title && (
                <> — {hoveredPlace.tripPlaces[0].trip.title}</>
              )}
            </p>
          </div>
        )}
      </div>

      {/* Statistics line */}
      <div className="mt-12 md:mt-16 flex items-center gap-6 md:gap-12 font-sans text-[10px] md:text-xs uppercase tracking-widest text-muted-foreground/50">
        <span>{validPlaces.length} locations</span>
        <span className="w-1 h-1 rounded-full bg-muted-foreground/20" />
        <Link href="/map" className="hover:text-foreground transition-colors">
          Open full map &rarr;
        </Link>
      </div>
    </section>
  );
}
