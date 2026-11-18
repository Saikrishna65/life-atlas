"use client";
import {onPublicPreload} from "@/lib/public-loading/readiness";
import { KineticHeading, RouteDrawing } from "./EditorialElements";
import Link from "next/link";
import Image from "next/image";
import dynamic from "next/dynamic";
import { observatoryTypography as typography } from "@/lib/public-fonts";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, ArrowLeft, ArrowRight, MoveUpRight, Rotate3D } from "lucide-react";
import type {PublicPlace} from "@/lib/queries/public-content";
import "./observatory.css";

const Globe = dynamic(() => import("@/components/home/InteractiveGlobe"), {
  ssr: false,
  loading:()=> <span hidden data-public-ready="pending" />,
});


export default function Observatory({places=[]}:{places?:PublicPlace[]}) {
  const destinations=useMemo(()=>places.filter(place=>place.latitude!==null&&place.longitude!==null&&Number.isFinite(place.latitude)&&Number.isFinite(place.longitude)),[places]);
  const [selected, setSelected] = useState(destinations[0]?.id);
  const [focused, setFocused] = useState<string | undefined>(destinations[0]?.id);
  const [ready, setReady] = useState(false);
  const root = useRef<HTMLElement>(null);
  const current = destinations.find(place => place.id === selected)!;
  const journey = current?.tripPlaces[0]?.trip;
  const selectPlace = (id: string) => {
    setSelected(id);
    setFocused(id);
  };
  const stepPlace = (step: number) => {
    if(!destinations.length)return;
    const index = destinations.findIndex(place => place.id === selected);
    selectPlace(destinations[(index + step + destinations.length) % destinations.length].id);
  };
  const points = useMemo(() => destinations.map(place => ({
    id: place.id, name: place.name, slug: place.slug, country: place.country,
    tripPlaces: place.tripPlaces, latitude:place.latitude!,longitude:place.longitude!,
  })), [destinations]);

  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const releasePreload = onPublicPreload(() => setReady(true));
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      // The globe owns its renderer and error fallback. A separate capability
      // probe would allocate and immediately destroy an unnecessary GPU context.
      setReady(true);
      observer.disconnect();
    }, { rootMargin: "100px" });
    observer.observe(element.querySelector(".observatory-core") ?? element);
    return () => {observer.disconnect();releasePreload();};
  }, []);

  return (
    <section id="observatory" ref={root}
      className={`${typography.variable} world-observatory world-scene observatory-v2`}
      aria-labelledby="observatory-title">

      <div className="observatory-stage">
        <RouteDrawing className="observatory-trail" />
        <header className="observatory-heading" data-world-reveal>
          <span className="observatory-overline">A little curiosity goes a long way.</span>
          <div id="observatory-title">
            <KineticHeading lines={["The world.", "Wide open."]} />
          </div>
          <p>Mountain mornings. Unfamiliar streets. Somewhere you haven’t been, yet.</p>
          <a className="observatory-text-link" href="#place-browser">
            Find your somewhere <MoveUpRight size={17} />
          </a>
          <span className="observatory-heading-note">Less ordinary. More out there.</span>
        </header>

        <div className="observatory-core" aria-label="Interactive destination globe">
          {ready ? <Globe places={points} onSelect={selectPlace} selectedPlaceId={focused} /> : (
            <div className="observatory-globe-placeholder" data-public-ready="pending" role="status">
              <div className="observatory-placeholder-ring" aria-hidden="true" />
              <p>A world coming into view…</p>
            </div>
          )}
        </div>
        <div className="observatory-gesture" aria-hidden="true">
          <Rotate3D size={17} strokeWidth={1.2} />
          <span className="observatory-desktop-hint">Drag to explore my published places.</span>
          <span className="observatory-touch-hint">Drag to turn the world.</span>
        </div>

        {current && <aside id="place-browser" className="observatory-focus" aria-label="Selected destination">
          <div className="observatory-focus-top">
            <span>Somewhere in / {current.country}</span>
            <span>{String(destinations.indexOf(current) + 1).padStart(2, "0")}</span>
          </div>
          {current.image && <div className="observatory-focus-photo" key={current.id}>
            <Image src={current.image} alt={current.name} unoptimized
              fill sizes="(max-width: 700px) 120px, 260px" loading="lazy"
              onLoad={event => { event.currentTarget.dataset.loaded = "true"; }} />
          </div>
          }<div className="observatory-focus-copy" key={`copy-${current.id}`}>
            <span className="observatory-focus-region">{current.region}</span>
            <h3 aria-live="polite">{current.name}</h3>
            <p>{current.description}</p>
            <div className="observatory-focus-meta">
              <span>{current.country}</span>
            </div>
            {journey && <Link className="observatory-journey-link" href={`/trips/${journey.slug}`}>
              Open the journey <ArrowUpRight size={17} />
            </Link>}
          </div>
          <div className="observatory-place-controls">
            <span>Go a little further</span>
            <button type="button" aria-label="Previous place" onClick={() => stepPlace(-1)} disabled={destinations.length < 2}><ArrowLeft size={16} /></button>
            <button type="button" aria-label="Next place" onClick={() => stepPlace(1)} disabled={destinations.length < 2}><ArrowRight size={16} /></button>
          </div>
        </aside>}
      </div>


    </section>
  );
}
