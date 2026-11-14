"use client";
import { KineticHeading, RouteDrawing } from "./EditorialElements";
import Link from "next/link";
import Image from "next/image";
import dynamic from "next/dynamic";
import { Plus_Jakarta_Sans } from "next/font/google";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, ArrowLeft, ArrowRight, MoveUpRight, Rotate3D } from "lucide-react";
import { destinations, expeditions } from "@/data/demo/expeditions";
import { searchRecords } from "@/data/demo/selectors";
import { ChapterLabel, SearchField } from "./primitives";
import "./observatory.css";

const Globe = dynamic(() => import("@/components/home/InteractiveGlobe"), {
  ssr: false,
});
const typography = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-observatory",
  display: "swap",
});
const categories = ["All places", "Mountains", "Nature", "Coast", "Culture", "City"];
const pageSize = 4;
const countries = new Set(destinations.map(place => place.country)).size;

export default function Observatory() {
  const [selected, setSelected] = useState(destinations[0].id);
  const [focused, setFocused] = useState<string | undefined>(destinations[0].id);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All places");
  const [page, setPage] = useState(0);
  const [ready, setReady] = useState(false);
  const root = useRef<HTMLElement>(null);
  const current = destinations.find(place => place.id === selected)!;
  const journey = expeditions.find(trip => trip.id === current.expeditionIds[0]);
  const filtered = useMemo(() => searchRecords(
    destinations, query, place => `${place.name} ${place.country} ${place.region}`,
  ).filter(place => category === "All places" || place.category === category), [query, category]);
  const selectedIndex = filtered.findIndex(place => place.id === selected);
  const pages = Math.ceil(filtered.length / pageSize);
  const selectPlace = (id: string) => {
    setSelected(id);
    setFocused(id);
    const index = filtered.findIndex(place => place.id === id);
    if (index >= 0) setPage(Math.floor(index / pageSize));
  };
  const stepPlace = (step: number) => {
    const index = selectedIndex < 0 ? (step > 0 ? 0 : filtered.length - 1)
      : (selectedIndex + step + filtered.length) % filtered.length;
    if (filtered[index]) selectPlace(filtered[index].id);
  };
  const reset = () => { setQuery(""); setCategory("All places"); setPage(0); };
  const points = useMemo(() => destinations.map(place => ({
    id: place.id, name: place.name, slug: place.slug, country: place.country,
    latitude: place.latitude, longitude: place.longitude,
    tripPlaces: place.expeditionIds.map(id => {
      const trip = expeditions.find(trip => trip.id === id)!;
      return { trip: { title: trip.name, slug: trip.slug } };
    }),
  })), []);

  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      // The globe owns its renderer and error fallback. A separate capability
      // probe would allocate and immediately destroy an unnecessary GPU context.
      setReady(true);
      observer.disconnect();
    }, { rootMargin: "100px" });
    observer.observe(element.querySelector(".observatory-core") ?? element);
    return () => observer.disconnect();
  }, []);

  return (
    <section id="observatory" ref={root}
      className={`${typography.variable} world-observatory world-scene observatory-v2`}
      aria-labelledby="observatory-title">
      <svg className="observatory-stars" viewBox="0 0 1600 1000" preserveAspectRatio="none" aria-hidden="true">
        {Array.from({ length: 200 }, (_, index) => (
          <circle key={index} cx={(index * 977 + 53) % 1600} cy={(index * 613 + 97) % 1000}
            r={index % 9 === 0 ? 1.6 : .65} fill="white" opacity={.12 + (index % 5) * .065} />
        ))}
      </svg>
      <div className="observatory-topline">
        <ChapterLabel number="02">Explore the world</ChapterLabel>
        <span className="observatory-atlas-note">A sample atlas / {destinations.length} places / {countries} countries</span>
      </div>

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
            <div className="observatory-globe-placeholder" role="status">
              <div className="observatory-placeholder-ring" aria-hidden="true" />
              <p>A world coming into view…</p>
            </div>
          )}
        </div>
        <div className="observatory-gesture" aria-hidden="true">
          <Rotate3D size={17} strokeWidth={1.2} />
          <span className="observatory-desktop-hint">Drag to wander. Choose a point.</span>
          <span className="observatory-touch-hint">Choose a place below to turn the world.</span>
        </div>

        <aside className="observatory-focus" aria-label="Selected destination">
          <div className="observatory-focus-top">
            <span>Somewhere in / {current.country}</span>
            <span>{String(destinations.indexOf(current) + 1).padStart(2, "0")}</span>
          </div>
          <div className="observatory-focus-photo" key={current.id}>
            <Image src={current.image.replace(".webp", "-small.webp")} alt={`Illustrative ${current.category.toLowerCase()} landscape for ${current.name}`}
              fill sizes="(max-width: 700px) 120px, 260px" loading="lazy"
              onLoad={event => { event.currentTarget.dataset.loaded = "true"; }} />
            <span>Illustrative photograph</span>
          </div>
          <div className="observatory-focus-copy" key={`copy-${current.id}`}>
            <span className="observatory-focus-region">{current.region}</span>
            <h3 aria-live="polite">{current.name}</h3>
            <p>{current.description}</p>
            <div className="observatory-focus-meta">
              <span>{current.duration} days, unhurried</span><span>{current.category}</span>
            </div>
            {journey && <Link className="observatory-journey-link" href={`/trips/${journey.slug}`}>
              Open the journey <ArrowUpRight size={17} />
            </Link>}
          </div>
          <div className="observatory-place-controls">
            <span>Go a little further</span>
            <button type="button" aria-label="Previous place" onClick={() => stepPlace(-1)} disabled={filtered.length < 2}><ArrowLeft size={16} /></button>
            <button type="button" aria-label="Next place" onClick={() => stepPlace(1)} disabled={filtered.length < 2}><ArrowRight size={16} /></button>
          </div>
        </aside>
      </div>

      <div id="place-browser" className="observatory-browser">
        <div className="observatory-browser-toolbar">
          <SearchField value={query} onChange={value => { setQuery(value); setPage(0); }}
            label="Search destinations" placeholder="A place, a country, a region…" />
          <div className="observatory-categories" aria-label="Destination categories">
            {categories.map(value => <button type="button" key={value} aria-pressed={category === value}
              onClick={() => { setCategory(value); setPage(0); }}>{value}</button>)}
          </div>
          <label className="observatory-mobile-category">
            <span className="sr-only">Destination category</span>
            <select value={category} onChange={event => { setCategory(event.target.value); setPage(0); }}>
              {categories.map(value => <option key={value}>{value}</option>)}
            </select>
          </label>
        </div>
        <div className="observatory-destination-list" aria-label="Choose a destination">
          {filtered.slice(page * pageSize, (page + 1) * pageSize).map(place => (
            <button type="button" key={place.id} aria-label={`${place.name} ${place.country}`}
              aria-pressed={place.id === selected} onClick={() => selectPlace(place.id)}>
              <span className="observatory-place-index">{String(destinations.indexOf(place) + 1).padStart(2, "0")}</span>
              <span><strong>{place.name}</strong><small>{place.country} / {place.category}</small></span>
              <ArrowUpRight size={19} strokeWidth={1.3} />
            </button>
          ))}
          {!filtered.length && <div className="observatory-empty" role="status">
            <p>No places found. Try a different direction.</p><button type="button" onClick={reset}>Show all places <ArrowRight size={16} /></button>
          </div>}
        </div>
        <footer className="observatory-browser-footer">
          <span aria-live="polite">{filtered.length} {filtered.length === 1 ? "place" : "places"} to explore</span>
          <div className="observatory-pagination">
            <span>{pages ? String(page + 1).padStart(2, "0") : "00"} / {String(pages).padStart(2, "0")}</span>
            <button type="button" aria-label="Previous destinations" disabled={page === 0} onClick={() => setPage(page - 1)}><ArrowLeft size={16} /></button>
            <button type="button" aria-label="Next destinations" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}><ArrowRight size={16} /></button>
          </div>
          <span className="observatory-data-note">Demonstration journeys. Approximate map centers.</span>
        </footer>
      </div>
    </section>
  );
}
