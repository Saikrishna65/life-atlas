"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
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
  const tooltipRef = useRef<HTMLDivElement>(null);
  const mousePosRef = useRef({ x: 0, y: 0 });
  const router = useRouter();

  useEffect(() => {
    const updateMouse = (e: MouseEvent) => {
      mousePosRef.current = { x: e.clientX, y: e.clientY };
      if (tooltipRef.current) {
        tooltipRef.current.style.left = `${e.clientX}px`;
        tooltipRef.current.style.top = `${e.clientY}px`;
      }
    };
    window.addEventListener("mousemove", updateMouse, { passive: true });
    return () => window.removeEventListener("mousemove", updateMouse);
  }, []);

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
    const width = containerEl.clientWidth;
    const height = containerEl.clientHeight;

    const homeLocation = {
      id: "home",
      name: "Home (533296, AP)",
      slug: "",
      country: "India",
      latitude: 17.05,
      longitude: 81.9,
      isHome: true,
      tripPlaces: []
    } as any;

    const allPoints = [...validPlaces, homeLocation];

    const arcsData = validPlaces.map((p) => ({
      startLat: homeLocation.latitude,
      startLng: homeLocation.longitude,
      endLat: p.latitude,
      endLng: p.longitude,
    }));

    const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const colors = {
      base: isDark ? "#121212" : "#f8f7f5", // matches --background
      land: isDark ? "#333333" : "#e6e4df", // matches --muted
      accent: isDark ? "#b4a592" : "#8b7d6b", // matches --accent
      point: isDark ? "#f3f3f3" : "#1c1b1a", // matches --foreground
      glow: isDark ? "#2a2a2a" : "#e6e4df", // matches --surface-hover or muted
      line: isDark ? "#d9a05b" : "#b87c36", // distinct warm copper/gold for lines
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const globe = GlobeFn({ animateIn: !prefersReducedMotion }) as any;
    globe(containerEl)
      .width(width)
      .height(height)
      .backgroundColor("rgba(0,0,0,0)")
      .showGlobe(true)
      .showAtmosphere(false) // Keep the atmosphere light hidden
      
      // Invisible points used exclusively for hover and click tracking!
      .pointsData(allPoints)
      .pointLat((d: any) => d.latitude)
      .pointLng((d: any) => d.longitude)
      .pointColor(() => "rgba(0,0,0,0)") // Make all pillars entirely invisible natively!
      .pointAltitude((d: any) => d.isHome ? 0.08 : 0.18) // Ensure hitboxes are tall enough
      .pointRadius((d: any) => d.isHome ? 0.3 : 0.15)
      .pointResolution(4) // Creative square architectural pillars
      .pointsMerge(false)
      
      // Radar Ping Ripple for the Home Base!
      .ringsData([homeLocation])
      .ringLat((d: any) => d.latitude)
      .ringLng((d: any) => d.longitude)
      .ringAltitude(0.085) // Sits perfectly on top of the massive new terrain!
      .ringColor(() => `${colors.line}aa`) // Copper/gold color with slight transparency
      .ringMaxRadius(2) // Keeps the ripple small and localized around the home pin
      .ringPropagationSpeed(1) // Much slower, gentle expansion
      .ringRepeatPeriod(1000) // Fires like a gentle heartbeat once per second

      .arcsData(arcsData)
      .arcStartLat((d: any) => d.startLat)
      .arcStartLng((d: any) => d.startLng)
      .arcEndLat((d: any) => d.endLat)
      .arcEndLng((d: any) => d.endLng)
      .arcStartAltitude(0.08) // Beams launch from the top of the terrain!
      .arcEndAltitude(0.08) // Beams land on the top of the terrain!
      .arcColor(() => colors.line) // Distinct warm copper/gold for the beams
      .arcStroke(0.5) // Much thicker 3D tubes so they stand out boldly
      .arcDashLength(1) // Solid beam that stretches the entire length
      .arcDashGap(1) // Instantly starts the next beam
      .arcDashInitialGap(() => Math.random() * 0.5) // Small stagger so they fire organically
      .arcDashAnimateTime((d: any) => {
        // Calculate approximate physical distance between Home and Destination
        const dx = (d.endLng || 0) - (d.startLng || 0);
        const dy = (d.endLat || 0) - (d.startLat || 0);
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Solid beams look best moving slightly faster, so back to 80 multiplier!
        return Math.max(2000, distance * 80); 
      })
      .arcAltitudeAutoScale(0.8) // Makes the arcs stand up much higher into the sky
      .onPointHover((point: unknown) => {
        setHoveredPlace(point as GlobePlace | null);
        if (containerEl) {
          const isTouch = window.matchMedia("(pointer: coarse)").matches;
          containerEl.style.cursor = point && !isTouch ? "none" : "grab";
        }
        
        // Stop auto-rotation when hovering a pin so you can read it easily
        const controls = globe.controls();
        if (controls) {
          controls.autoRotate = point ? false : !prefersReducedMotion;
        }
      })
      .onPointClick((point: unknown) => {
        const p = point as GlobePlace;
        if (p?.slug) {
          // Disable rotation during flight
          const controls = globe.controls();
          if (controls) controls.autoRotate = false;
          
          // Fly to the location!
          globe.pointOfView({ lat: p.latitude, lng: p.longitude, altitude: 0.1 }, 1500);
          
          // Fade container out and navigate
          setTimeout(() => {
            gsap.to(containerEl, { opacity: 0, duration: 0.4, onComplete: () => router.push(`/places/${p.slug}`) });
          }, 1400);
        }
      });

    // Fetch GeoJSON for the dotted landmasses from remote
    fetch('https://raw.githubusercontent.com/vasturiano/globe.gl/master/example/datasets/ne_110m_admin_0_countries.geojson')
      .then(res => res.json())
      .then(countries => {
        globe.hexPolygonsData(countries.features)
          .hexPolygonResolution(3) // Larger grid to increase the distance between dots
          .hexPolygonMargin(0.6) // Lots of gap
          .hexPolygonColor(() => colors.land)
          .hexPolygonAltitude(0.08); // Massively extrude the dots up to create highly visible 3D terrain
      })
      .catch(err => console.error("Error loading geojson", err));

    // Setup material and lighting
    const scene = globe.scene();
    if (scene) {
      // @ts-ignore
      import('three').then((THREE) => {
        // Clear existing lights from scene and camera to remove ALL stubborn glare spots
        scene.children = scene.children.filter((c: any) => !c.isLight);
        
        const camera = globe.camera();
        if (camera) {
          camera.children = camera.children.filter((c: any) => !c.isLight);
        }
        
        // Very soft ambient light only (removed all directional lights)
        const ambientLight = new THREE.AmbientLight(0xffffff, isDark ? 2.5 : 3.0);
        scene.add(ambientLight);

        // Create a perfectly flat, unlit sphere (matches background exactly, no lighting/glow)
        const flatMaterial = new THREE.MeshBasicMaterial({
          color: colors.base,
          transparent: false,
        });
        
        globe.globeMaterial(flatMaterial);

        // --- ADVANCED: Starry Parallax Background ---
        const particlesGeometry = new THREE.BufferGeometry();
        const particlesCount = 800;
        const posArray = new Float32Array(particlesCount * 3);
        
        for(let i = 0; i < particlesCount * 3; i++) {
          posArray[i] = (Math.random() - 0.5) * 600; // Wide spread
        }
        
        // Create a perfect circle texture for the stars
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
          size: 1.2, // Slightly larger to compensate for the round shape
          color: new THREE.Color(colors.point),
          transparent: true,
          opacity: 0.3,
          map: circleTexture,
          alphaTest: 0.1, // Ensures the edges of the circle render cleanly
        });
        
        const particlesMesh = new THREE.Points(particlesGeometry, particlesMaterial);
        scene.add(particlesMesh);
        
        // Mouse parallax for stars
        const handleMouseMove = (e: MouseEvent) => {
           const mouseX = (e.clientX / window.innerWidth) - 0.5;
           const mouseY = (e.clientY / window.innerHeight) - 0.5;
           gsap.to(particlesMesh.rotation, {
              x: mouseY * 0.3,
              y: mouseX * 0.3,
              duration: 2,
              ease: "power2.out"
           });
        };
        window.addEventListener('mousemove', handleMouseMove);

        // --- ADVANCED: Volumetric Fog ---
        // Fades the stars and the edges of the rings smoothly into the background
        scene.fog = new THREE.Fog(colors.base, 150, 400);

        // --- ADVANCED: Custom Floating Location Pillars ---
        // Reuse geometry and material for better performance
        const pillarMaterial = new THREE.MeshBasicMaterial({ color: colors.accent });
        const baseGeometry = new THREE.CylinderGeometry(0.6, 0.6, 1, 4); // unit height

        globe.customLayerData(validPlaces) // Use only destination places (Home has no pillar)
          .customThreeObject((d: any) => {
            const hRatio = 0.05 + Math.random() * 0.05; // 5% to 10% of globe radius
            const physicalHeight = hRatio * 100; // globe.gl default radius is 100
            
            const mesh = new THREE.Mesh(baseGeometry, pillarMaterial);
            mesh.scale.set(1, physicalHeight, 1);
            
            // Place it exactly on top of the terrain (0.08) + half its height
            const coords = globe.getCoords(d.latitude, d.longitude, 0.08 + (hRatio / 2));
            mesh.position.set(coords.x, coords.y, coords.z);
            
            // Orient the cylinder so it points outward from the globe center
            mesh.lookAt(new THREE.Vector3(0, 0, 0));
            mesh.rotateX(Math.PI / 2);
            
            return mesh;
          });

      });
    }

    const controls = globe.controls?.();
    if (controls) {
      controls.autoRotate = !prefersReducedMotion;
      controls.autoRotateSpeed = 0.5;
      controls.enableZoom = false; // Disabled manual zoom
      controls.minDistance = 150;
      controls.maxDistance = 600;
    }

    if (!prefersReducedMotion) {
      let centerLat = homeLocation.latitude;
      let centerLng = homeLocation.longitude;
      
      if (validPlaces.length > 0) {
        // Average all locations INCLUDING home to find the absolute center of their life
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

    // Handle resize
    const handleResize = () => {
      if (containerEl && globe) {
        globe.width(containerEl.clientWidth);
        globe.height(containerEl.clientHeight);
      }
    };
    window.addEventListener("resize", handleResize);

    // Attach cleanup method to instance for use in useEffect
    globe._cleanup = () => {
      window.removeEventListener("resize", handleResize);
      globe._destructor?.();
    };
  }, [validPlaces, router]);

  useEffect(() => {
    initGlobe();
    return () => {
      if (globeInstanceRef.current) {
        // @ts-ignore
        globeInstanceRef.current._cleanup?.();
        globeInstanceRef.current = null;
      }
    };
  }, [initGlobe]);

  // Scroll-triggered scale animation
  useEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion || !containerRef.current || !globeContainerRef.current) return;

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: containerRef.current,
        start: "top 90%",
        end: "bottom 10%",
        scrub: true,
      },
    });

    // Step 1: Scale up and fade in as it enters viewport
    tl.fromTo(
      globeContainerRef.current,
      { scale: 0.5, opacity: 0 },
      { scale: 1, opacity: 1, duration: 1, ease: "power1.inOut" }
    );

    // Step 2: Rotate scene slightly on scroll for interactivity, and fade out
    tl.to(
      globeContainerRef.current,
      { scale: 0.5, opacity: 0, duration: 1, ease: "power1.inOut" }
    );
    
    // Step 3: Scroll-Linked Rotation!
    if (globeInstanceRef.current) {
      const scene = (globeInstanceRef.current as any).scene();
      if (scene) {
        tl.fromTo(scene.rotation, 
          { y: -Math.PI / 6 }, // Start slightly backwards (30 degrees)
          {
            y: Math.PI / 6, // End slightly forwards (30 degrees)
            ease: "none",
            duration: 2 // Match the total duration of Step 1 (1s) + Step 2 (1s)
          }, 
          0 // The '0' makes it start exactly at the beginning of the scroll
        );
      }
    }

    return () => {
      tl.kill();
    };
  }, [isGlobeReady]);

  return (
    <section
      ref={containerRef}
      className="relative py-24 md:py-32 flex flex-col items-center justify-center bg-background min-h-screen overflow-hidden"
    >
      {/* Title block */}
      <div className="text-center mb-12 md:mb-16 z-10 px-6">
        <h2 className="font-sans text-[10px] md:text-xs tracking-[0.2em] uppercase text-muted-foreground mb-4">
          Atmosphere
        </h2>
        <p className="font-display text-3xl md:text-4xl lg:text-5xl max-w-3xl text-foreground">
          The world, mapped through personal journeys.
        </p>
      </div>

      {/* Cinematic wide globe container */}
      <div className="relative w-full max-w-none aspect-[4/3] md:aspect-[21/9] px-0 overflow-hidden">
        <div
          ref={globeContainerRef}
          className="w-full h-full"
          style={{ cursor: "grab" }}
        />

        {/* Loading state */}
        {!isGlobeReady && (
          <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 border border-muted/30 rounded-full animate-pulse" />
              <p className="font-sans text-[10px] uppercase tracking-widest text-muted-foreground">
                Loading globe...
              </p>
            </div>
          </div>
        )}

        {/* ADVANCED: Magnetic Polaroid Tooltip */}
        {hoveredPlace && (
          <div 
            ref={tooltipRef}
            className="fixed pointer-events-none z-50 transition-transform duration-75 ease-out"
            style={{ 
              left: mousePosRef.current.x, 
              top: mousePosRef.current.y,
              transform: 'translate(15px, 15px)' // Offset slightly from cursor
            }}
          >
            <div className="bg-background border border-border p-2 shadow-2xl rounded-sm w-48 flex flex-col gap-2">
              <div className="w-full aspect-[4/3] bg-muted flex items-center justify-center overflow-hidden rounded-sm relative">
                {/* Simulated Polaroid Image Placeholder */}
                <div className="absolute inset-0 bg-gradient-to-tr from-foreground/5 to-transparent mix-blend-overlay" />
                <span className="font-sans text-[8px] text-muted-foreground uppercase tracking-widest absolute bottom-2 right-2">Memory</span>
                {/* Minimalist graphic simulating a photo */}
                <div className="w-12 h-12 rounded-full border border-foreground/10 flex items-center justify-center">
                  <div className="w-6 h-6 rotate-45 bg-foreground/10" />
                </div>
              </div>
              <div className="px-1 pb-1">
                <p className="font-sans text-xs uppercase tracking-widest font-semibold text-foreground truncate">
                  {hoveredPlace.name}
                </p>
                <p className="font-sans text-[9px] text-muted-foreground uppercase tracking-wider truncate">
                  {hoveredPlace.country}
                  {hoveredPlace.tripPlaces?.[0]?.trip?.title && (
                    <> — {hoveredPlace.tripPlaces[0].trip.title}</>
                  )}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Statistics line */}
      <div className="mt-12 md:mt-16 flex items-center gap-6 md:gap-12 font-sans text-[10px] md:text-xs uppercase tracking-widest text-muted-foreground/50 z-10 px-6">
        <span>{validPlaces.length} locations</span>
        <span className="w-1 h-1 rounded-full bg-muted-foreground/20" />
        <Link href="/map" className="hover:text-foreground transition-colors pointer-events-auto">
          Open full map &rarr;
        </Link>
      </div>
    </section>
  );
}
