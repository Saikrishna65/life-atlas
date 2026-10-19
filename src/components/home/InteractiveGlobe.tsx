"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

export interface GlobePlace {
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
  const globeWrapperRef = useRef<HTMLDivElement>(null);
  const globeContainerRef = useRef<HTMLDivElement>(null);
  const globeInstanceRef = useRef<unknown>(null);
  const [isGlobeReady, setIsGlobeReady] = useState(false);

  const validPlaces = useMemo(
    () => places.filter(p => p.latitude !== null && p.longitude !== null),
    [places]
  );

  const initGlobe = useCallback(async () => {
    if (typeof window === "undefined" || !globeContainerRef.current || globeInstanceRef.current) return;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Dynamically import to avoid SSR issues
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const GlobeModule = await import("globe.gl") as any;
    const GlobeFn = GlobeModule.default || GlobeModule;

    const containerEl = globeContainerRef.current;
    if (!containerEl) return;
    const width = containerEl.clientWidth || window.innerWidth;
    const height = containerEl.clientHeight || (window.innerWidth < 768 ? 420 : 650);

    const homeLocation = {
      id: "home",
      name: "Home (533296, AP)",
      slug: "",
      country: "India",
      latitude: 17.05,
      longitude: 81.9,
      isHome: true,
      tripPlaces: []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    const arcsData = validPlaces.map((p) => ({
      startLat: homeLocation.latitude,
      startLng: homeLocation.longitude,
      endLat: p.latitude,
      endLng: p.longitude,
    }));

    // Light theme palette matching globals.css tokens
    const colors = {
      base: "#ffffff", // matches bg-background
      bg: "#ffffff", // matches bg-background for fog
      land: "#1e293b", // slate-800 for high-contrast continents
      accent: "#1f4fd8", // cobalt blue for destination pillars
      point: "#64748b", // darker slate for background particles
      glow: "#94a3b8", // atmosphere halo shadow
      line: "#94a3b8", // silver/slate for flight arcs
      home: "#e5484d", // coral red for home ripple
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const globe = GlobeFn({ animateIn: !prefersReducedMotion }) as any;
    globe(containerEl)
      .width(width)
      .height(height)
      .backgroundColor("rgba(0,0,0,0)")
      .showGlobe(true)
      .showAtmosphere(true)
      .atmosphereColor(colors.glow)
      .atmosphereAltitude(0.2)
      
      // Radar Ping Ripple for the Home Base
      .ringsData([homeLocation])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .ringLat((d: any) => d.latitude)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .ringLng((d: any) => d.longitude)
      .ringAltitude(0.085)
      .ringColor(() => `${colors.home}aa`)
      .ringMaxRadius(2)
      .ringPropagationSpeed(1)
      .ringRepeatPeriod(1000)

      // Flight Travel Arcs
      .arcsData(arcsData)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .arcStartLat((d: any) => d.startLat)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .arcStartLng((d: any) => d.startLng)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .arcEndLat((d: any) => d.endLat)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .arcEndLng((d: any) => d.endLng)
      .arcStartAltitude(0.08)
      .arcEndAltitude(0.08)
      .arcColor(() => colors.line)
      .arcStroke(0.5)
      .arcDashLength(1)
      .arcDashGap(1)
      .arcDashInitialGap(() => Math.random() * 0.5)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .arcDashAnimateTime((d: any) => {
        const dx = (d.endLng || 0) - (d.startLng || 0);
        const dy = (d.endLat || 0) - (d.startLat || 0);
        const distance = Math.sqrt(dx * dx + dy * dy);
        return Math.max(2000, distance * 80);
      })
      .arcAltitudeAutoScale(0.8);
      // NOTE: Hover and click feature completely removed on both mobile and web.

    // Fetch GeoJSON for the dotted landmasses
    fetch('/data/countries.geojson')
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(countries => {
        if (countries?.features) {
          globe.hexPolygonsData(countries.features)
            .hexPolygonResolution(3)
            .hexPolygonMargin(0.1)
            .hexPolygonColor(() => colors.land)
            .hexPolygonAltitude(0.08);
        }
      })
      .catch((err) => {
        console.warn("Could not load local country geojson for globe terrain", err?.message || err);
      });

    // Setup 3D materials, lights, and pillars
    const scene = globe.scene();
    if (scene) {
      import('three').then((THREE) => {
        // Clear default lights for custom lighting
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        scene.children = scene.children.filter((c: any) => !c.isLight);
        
        const camera = globe.camera();
        if (camera) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          camera.children = camera.children.filter((c: any) => !c.isLight);
        }
        
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 2.5);
        directionalLight.position.set(1, 1, 0.5);
        scene.add(directionalLight);

        const sphereMaterial = new THREE.MeshPhongMaterial({
          color: colors.base,
          emissive: 0x000000,
          specular: 0x111111,
          shininess: 10,
        });
        
        globe.globeMaterial(sphereMaterial);

        // Starry Parallax Background
        const particlesGeometry = new THREE.BufferGeometry();
        const particlesCount = 800;
        const posArray = new Float32Array(particlesCount * 3);
        
        for (let i = 0; i < particlesCount * 3; i++) {
          posArray[i] = (Math.random() - 0.5) * 600;
        }
        
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 32;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.beginPath();
          ctx.arc(16, 16, 16, 0, Math.PI * 2);
          ctx.fillStyle = '#ffffff';
          ctx.fill();
        }
        const circleTexture = new THREE.CanvasTexture(canvas);

        particlesGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
        const particlesMaterial = new THREE.PointsMaterial({
          size: 2.5,
          color: new THREE.Color(colors.point),
          transparent: true,
          opacity: 0.7,
          map: circleTexture,
          alphaTest: 0.1,
        });
        
        const particlesMesh = new THREE.Points(particlesGeometry, particlesMaterial);
        scene.add(particlesMesh);
        
        // Mouse parallax for background stars
        const isTouch = window.matchMedia("(pointer: coarse)").matches;
        let handleMouseMove: ((e: MouseEvent) => void) | null = null;
        if (!isTouch) {
          const xTo = gsap.quickTo(particlesMesh.rotation, "x", { duration: 2, ease: "power2.out" });
          const yTo = gsap.quickTo(particlesMesh.rotation, "y", { duration: 2, ease: "power2.out" });
          
          handleMouseMove = (e: MouseEvent) => {
            const mouseX = (e.clientX / window.innerWidth) - 0.5;
            const mouseY = (e.clientY / window.innerHeight) - 0.5;
            xTo(mouseY * 0.3);
            yTo(mouseX * 0.3);
          };
          window.addEventListener('mousemove', handleMouseMove, { passive: true });
        }
        
        const originalCleanup = globe._cleanup;
        globe._cleanup = () => {
          if (handleMouseMove) {
            window.removeEventListener('mousemove', handleMouseMove);
          }
          if (originalCleanup) originalCleanup();
        };

        // Volumetric Fog
        scene.fog = new THREE.Fog(colors.bg, 150, 400);

        // Custom Floating 3D Destination Location Pillars (Visual Only — no click/hover listeners)
        const pillarMaterial = new THREE.MeshBasicMaterial({ color: colors.accent });
        const baseGeometry = new THREE.CylinderGeometry(0.6, 0.6, 1, 4);

        globe.customLayerData(validPlaces)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .customThreeObject((d: any) => {
            const hRatio = 0.05 + Math.random() * 0.05;
            const physicalHeight = hRatio * 100;
            
            const mesh = new THREE.Mesh(baseGeometry, pillarMaterial);
            mesh.scale.set(1, physicalHeight, 1);
            
            const coords = globe.getCoords(d.latitude, d.longitude, 0.08 + (hRatio / 2));
            mesh.position.set(coords.x, coords.y, coords.z);
            
            mesh.lookAt(new THREE.Vector3(0, 0, 0));
            mesh.rotateX(Math.PI / 2);
            
            return mesh;
          });
      });
    }

    const controls = globe.controls?.();
    const isTouch = typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;

    if (controls) {
      controls.autoRotate = !prefersReducedMotion;
      controls.autoRotateSpeed = 0.6;
      controls.enableZoom = false; // Zoom disabled
      // On mobile touch devices, disable touch rotation capture so vertical page scroll is completely unhindered
      if (isTouch) {
        controls.enableRotate = false;
      }
    }

    if (!prefersReducedMotion) {
      let centerLat = homeLocation.latitude;
      let centerLng = homeLocation.longitude;
      
      if (validPlaces.length > 0) {
        const pointsToAverage = [...validPlaces, homeLocation];
        centerLat = pointsToAverage.reduce((sum, p) => sum + (p.latitude || 0), 0) / pointsToAverage.length;
        centerLng = pointsToAverage.reduce((sum, p) => sum + (p.longitude || 0), 0) / pointsToAverage.length;
      }
      
      globe.pointOfView({ lat: centerLat, lng: centerLng, altitude: 4 }, 0);
      setTimeout(() => {
        globe.pointOfView({ lat: centerLat, lng: centerLng, altitude: 2.2 }, 3000);
      }, 300);
    }

    globeInstanceRef.current = globe;
    setIsGlobeReady(true);
    if (typeof window !== "undefined") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__globeReady = true;
      window.dispatchEvent(new CustomEvent("globe-ready"));
    }

    // Responsive resize handler
    const handleResize = () => {
      if (containerEl && globe) {
        globe.width(containerEl.clientWidth);
        globe.height(containerEl.clientHeight);
      }
      ScrollTrigger.refresh();
    };
    window.addEventListener("resize", handleResize);

    globe._cleanup = () => {
      window.removeEventListener("resize", handleResize);
      globe._destructor?.();
    };
  }, [validPlaces]);

  useEffect(() => {
    initGlobe();
    return () => {
      if (globeInstanceRef.current) {
        // @ts-expect-error - globe._cleanup is a custom property attached during init
        globeInstanceRef.current._cleanup?.();
        globeInstanceRef.current = null;
      }
    };
  }, [initGlobe]);

  // Initial resting state set immediately upon mount
  useEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion || !globeContainerRef.current) return;
    gsap.set(globeContainerRef.current, {
      scale: 0.55,
      opacity: 0.4,
      transformOrigin: "center center",
      willChange: "transform, opacity",
    });
  }, []);

  // Scroll-Triggered Symmetrical IN and OUT Scale Animation
  useEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const triggerEl = globeWrapperRef.current || containerRef.current;
    const globeEl = globeContainerRef.current;
    if (prefersReducedMotion || !triggerEl || !globeEl) return;

    const ctx = gsap.context(() => {
      // Timeline scrubbed directly across the globe's viewport transit
      // Starts as the globe enters the bottom of the viewport ("top bottom")
      // Ends as the globe exits the top of the viewport ("bottom top")
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: triggerEl,
          start: "top bottom",   // Starts as globe enters bottom of screen
          end: "bottom top",     // Ends as globe exits top of screen
          scrub: 0.5,            // Silky smooth interpolation synchronized with scroll
          invalidateOnRefresh: true,
        },
      });

      // 1. IN ANIMATION: Starts small (scale: 0.55, opacity: 0.4) and steadily grows
      // all the way across the scroll until it is centered in the viewport (0% -> 42% of transit)
      tl.fromTo(
        globeEl,
        { scale: 0.55, opacity: 0.4 },
        {
          scale: 1.0,
          opacity: 1.0,
          duration: 0.42,
          ease: "none",
        },
        0
      );

      // 2. CENTER PLATEAU: Holds comfortably at full size while viewed in center (42% -> 58% of transit)
      tl.to(
        globeEl,
        {
          scale: 1.0,
          opacity: 1.0,
          duration: 0.16,
          ease: "none",
        },
        0.42
      );

      // 3. OUT ANIMATION: Actively and visibly shrinks while STILL ON SCREEN in the upper viewport (58% -> 90% of transit)
      // Finishes shrinking to 0.55 while the globe is still visible before completely leaving the viewport
      tl.to(
        globeEl,
        {
          scale: 0.55,
          opacity: 0.4,
          duration: 0.32,
          ease: "none",
        },
        0.58
      );

      // Scroll-Linked 3D Rotation spanning the entire section
      if (globeInstanceRef.current) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const scene = (globeInstanceRef.current as any).scene();
        if (scene) {
          tl.fromTo(
            scene.rotation,
            { y: -Math.PI / 4 },
            {
              y: Math.PI / 4,
              ease: "none",
              duration: 1.0,
            },
            0
          );
        }
      }

      // Refresh ScrollTrigger to recalculate exact pixel offsets
      ScrollTrigger.refresh();
      const t1 = setTimeout(() => ScrollTrigger.refresh(), 200);
      const t2 = setTimeout(() => ScrollTrigger.refresh(), 800);

      const handleHeroReady = () => ScrollTrigger.refresh();
      window.addEventListener("hero-ready", handleHeroReady);

      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        window.removeEventListener("hero-ready", handleHeroReady);
      };
    }, triggerEl);

    return () => {
      ctx.revert();
    };
  }, [isGlobeReady]);

  return (
    <section
      id="globe-section"
      ref={containerRef}
      className="relative py-28 md:py-36 flex flex-col items-center justify-center bg-background min-h-screen overflow-hidden border-t border-muted/60"
    >
      {/* Editorial Narrative Bridge */}
      <div className="text-center mb-12 md:mb-16 z-10 px-6 max-w-4xl mx-auto flex flex-col items-center">
        {/* Cartographic hairline connecting from Hero */}
        <div className="w-[1px] h-12 bg-gradient-to-b from-muted to-accent mx-auto mb-6" aria-hidden="true" />

        <span className="font-sans text-[10px] md:text-xs tracking-[0.3em] uppercase text-accent font-semibold mb-4 px-3 py-1 rounded-full bg-accent/5 border border-accent/15">
          Chapter I · Planetary Cartography
        </span>

        <h2 className="font-display text-3xl sm:text-4xl md:text-5xl lg:text-6xl text-foreground font-light tracking-tight leading-[1.1] mb-5">
          The world, mapped through <span className="font-serif italic font-normal text-foreground">personal journeys</span>.
        </h2>

        <p className="font-body text-sm sm:text-base md:text-lg text-muted-foreground font-normal max-w-2xl leading-relaxed">
          Every coordinate is an indexed chapter. Visited cities, mountain roads, and quiet shores gathered across time into one continuous geography.
        </p>

        {/* Cartographic Status Pill */}
        <div className="mt-8 flex items-center gap-3 text-[10px] uppercase tracking-[0.25em] text-muted-foreground/80 font-sans border border-muted/80 px-4 py-2 rounded-full bg-surface/50">
          <span className="w-1.5 h-1.5 rounded-full bg-accent animate-ping" />
          <span>Planetary Geography · Real-Time Journeys</span>
        </div>
      </div>

      {/* Cinematic wide globe container with In & Out scroll transform */}
      <div
        ref={globeWrapperRef}
        className="relative w-full max-w-none aspect-[4/3] md:aspect-[21/9] min-h-[420px] md:min-h-[600px] px-0 overflow-hidden flex items-center justify-center"
      >
        <div
          ref={globeContainerRef}
          className="w-full h-full pointer-events-auto"
          style={{
            transformOrigin: "center center",
          }}
        />

        {/* Loading atmosphere placeholder */}
        {!isGlobeReady && (
          <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 border border-muted/30 rounded-full animate-pulse" />
              <p className="font-sans text-[10px] uppercase tracking-widest text-muted-foreground">
                Loading atmosphere...
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Cartographic Metadata Bar */}
      <div className="mt-12 md:mt-16 w-full max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 font-sans text-[10px] md:text-xs uppercase tracking-[0.25em] text-muted-foreground z-10 px-6 border-t border-muted/60 pt-6">
        <div className="flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-accent-green" />
          <span className="font-medium text-foreground">{validPlaces.length} Visited Coordinates</span>
        </div>

        <div className="hidden md:flex items-center gap-4 text-[9px] tracking-[0.3em] text-muted-foreground/70">
          <span>Projection: Orthographic</span>
          <span>·</span>
          <span>Datum: WGS84</span>
        </div>

        <Link 
          href="/map" 
          className="inline-flex items-center gap-2 text-accent hover:text-foreground font-medium transition-colors border-b border-accent/30 hover:border-foreground pb-0.5"
        >
          <span>Open Full Interactive Map</span>
          <span className="text-sm">&rarr;</span>
        </Link>
      </div>
    </section>
  );
}
