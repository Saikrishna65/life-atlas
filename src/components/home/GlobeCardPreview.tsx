"use client";
import { useEffect, useRef, useState } from "react";
import type { GlobeInstance } from "globe.gl";

/** Compact preview of the Observatory's white sphere, slate hex land and cobalt markers. */
export default function GlobeCardPreview() {
  const root = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const desktop = matchMedia("(min-width: 701px)");
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const request = new AbortController();
    let globe: GlobeInstance | undefined;
    let material: import("three").MeshPhongMaterial | undefined;
    let contextLost = false;
    let disposed = false,
      initializing = false,
      inView = false,
      hovered = false;
    let settle: ReturnType<typeof setTimeout> | undefined;
    let resize: ResizeObserver | undefined;
    let contextCanvas: HTMLCanvasElement | undefined;
    const anchor = element.closest("a");
    const sync = () => {
      if (!globe || contextLost) return;
      clearTimeout(settle);
      const animate =
        inView &&
        desktop.matches &&
        !document.hidden &&
        hovered &&
        !motion.matches;
      element.dataset.globeMotion = animate ? "rotating" : "paused";
      globe.controls().autoRotate = animate;
      if (animate) globe.resumeAnimation();
      else globe.pauseAnimation();
    };
    const enter = () => {
      hovered = true;
      sync();
    };
    const leave = () => {
      hovered = false;
      sync();
    };
    const lost = (e: Event) => {
      e.preventDefault();
      contextLost = true;
      setFailed(true);
      globe?.pauseAnimation();
    };
    const renderOnce = () => {
      if (
        !globe ||
        contextLost ||
        !inView ||
        !desktop.matches ||
        document.hidden
      )
        return;
      globe.resumeAnimation();
      clearTimeout(settle);
      settle = setTimeout(sync, 180);
    };
    const init = async () => {
      if (disposed || initializing || globe || !desktop.matches) return;
      initializing = true;
      try {
        const [{ default: Globe }, THREE, countries] = await Promise.all([
          import("globe.gl"),
          import("three"),
          fetch("/data/countries.geojson", { signal: request.signal }).then(
            (res) => {
              if (!res.ok) throw new Error("Map unavailable");
              return res.json();
            },
          ),
        ]);
        if (disposed || !desktop.matches) return;
        globe = new Globe(element, {
          animateIn: false,
          rendererConfig: {
            alpha: true,
            antialias: true,
            powerPreference: "low-power",
          },
        });
        const points = [
          { lat: 17.1, lng: 81.9 },
          { lat: 35.7, lng: 139.7 },
          { lat: 51.5, lng: -0.1 },
          { lat: -8.4, lng: 115.2 },
        ];
        globe
          .width(element.clientWidth)
          .height(element.clientHeight)
          .backgroundColor("rgba(0,0,0,0)")
          .showAtmosphere(true)
          .atmosphereColor("#94a3b8")
          .atmosphereAltitude(0.16)
          .hexPolygonsData(countries.features)
          .hexPolygonResolution(2)
          .hexPolygonMargin(0.18)
          .hexPolygonColor(() => "#1e293b")
          .hexPolygonAltitude(0.08)
          .hexPolygonsTransitionDuration(0)
          .pointsData(points)
          .pointLat("lat")
          .pointLng("lng")
          .pointColor(() => "#1f4fd8")
          .pointAltitude(0.135)
          .pointRadius(0.7)
          .pointsTransitionDuration(0)
          .arcsData(
            points.slice(1).map((p) => ({
              startLat: 17.1,
              startLng: 81.9,
              endLat: p.lat,
              endLng: p.lng,
            })),
          )
          .arcColor(() => "#94a3b8")
          .arcStroke(0.35)
          .arcStartAltitude(0.08)
          .arcEndAltitude(0.08)
          .arcAltitudeAutoScale(0.38)
          .arcsTransitionDuration(0)
          .enablePointerInteraction(false);
        material = new THREE.MeshPhongMaterial({
          color: "#ffffff",
          specular: "#111111",
          shininess: 10,
        });
        globe.globeMaterial(material);
        const key = new THREE.DirectionalLight(0xffffff, 2.5);
        key.position.set(1, 1, 0.5);
        globe.lights([new THREE.AmbientLight(0xffffff, 0.4), key]);
        globe.renderer().setPixelRatio(Math.min(devicePixelRatio || 1, 1.25));
        globe.pointOfView({ lat: 24, lng: 67, altitude: 1.85 }, 0);
        const controls = globe.controls();
        controls.enableZoom = false;
        controls.enablePan = false;
        controls.enableRotate = false;
        controls.autoRotateSpeed = 0.45;
        contextCanvas = globe.renderer().domElement;
        contextCanvas.addEventListener("webglcontextlost", lost);
        element.dataset.globeReady = "true";
        resize = new ResizeObserver(() => {
          if (globe && element.clientWidth && element.clientHeight) {
            globe.width(element.clientWidth).height(element.clientHeight);
            renderOnce();
          }
        });
        resize.observe(element);
        renderOnce();
      } catch {
        if (!disposed) setFailed(true);
      }
    };
    const observer = new IntersectionObserver(
      ([entry]) => {
        inView = entry.isIntersecting;
        if (inView) {
          void init();
          renderOnce();
        } else sync();
      },
      { rootMargin: "0px" },
    );
    observer.observe(element);
    const change = () => {
      if (desktop.matches && inView) {
        void init();
        renderOnce();
      } else sync();
    };
    desktop.addEventListener("change", change);
    motion.addEventListener("change", sync);
    document.addEventListener("visibilitychange", change);
    anchor?.addEventListener("pointerenter", enter);
    anchor?.addEventListener("pointerleave", leave);
    anchor?.addEventListener("focus", enter);
    anchor?.addEventListener("blur", leave);
    return () => {
      disposed = true;
      delete element.dataset.globeReady;
      request.abort();
      clearTimeout(settle);
      observer.disconnect();
      resize?.disconnect();
      desktop.removeEventListener("change", change);
      motion.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", change);
      anchor?.removeEventListener("pointerenter", enter);
      anchor?.removeEventListener("pointerleave", leave);
      anchor?.removeEventListener("focus", enter);
      anchor?.removeEventListener("blur", leave);
      contextCanvas?.removeEventListener("webglcontextlost", lost);
      globe?.pauseAnimation();
      globe?._destructor();
      material?.dispose();
    };
  }, []);
  return (
    <div className="hero-globe-preview" aria-hidden="true" data-failed={failed}>
      <div ref={root} className="hero-globe-canvas" />
      <svg className="hero-globe-fallback" viewBox="0 0 200 200" fill="none">
        <defs>
          <radialGradient id="hero-sphere" cx=".3" cy=".25">
            <stop stopColor="#fff" />
            <stop offset="1" stopColor="#b6c2cf" />
          </radialGradient>
        </defs>
        <circle cx="100" cy="100" r="77" fill="url(#hero-sphere)" />
        <path
          d="m48 66 20-22 23 5 14 16 25-8 22 17-9 24-22 8-13 29-13-8-3-24-17-7-8-21-19 2Zm80 73 16-7 11 15-7 10-21-7Z"
          fill="#1e293b"
        />
        <path d="M54 116Q49 18 144 71M93 99Q158 36 170 117" stroke="#94a3b8" />
        <circle cx="93" cy="99" r="3" fill="#1f4fd8" />
      </svg>
    </div>
  );
}
