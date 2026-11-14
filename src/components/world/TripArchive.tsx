"use client";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Plus } from "lucide-react";
import type { TripArchiveEntry } from "@/lib/public-trips/archive";
import { KineticHeading, RouteDrawing } from "./EditorialElements";
import { ChapterLabel, Empty, SearchField } from "./primitives";
import "./trip-archive.css";

export default function TripArchive({ trips }: { trips: TripArchiveEntry[] }) {
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState("All places");
  const [sort, setSort] = useState(trips.some(trip => trip.date) ? "Latest first" : "Original order");
  const [limit, setLimit] = useState(9);
  const countries = [...new Set(trips.map(trip => trip.country))].sort();
    const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    const filtered = trips.filter(trip => (country === "All places" || trip.country === country)
      && words.every(word => `${trip.title} ${trip.places.join(" ")} ${trip.country}`.toLocaleLowerCase().includes(word)));
  const items = filtered.sort((a, b) => {
      if (sort === "A–Z") return a.title.localeCompare(b.title);
      if (sort === "Shortest first") return (a.days ?? Infinity) - (b.days ?? Infinity);
      return sort === "Latest first" ? (b.date || "").localeCompare(a.date || "") : 0;
    });
  const reset = () => { setQuery(""); setCountry("All places"); setSort(trips.some(trip => trip.date) ? "Latest first" : "Original order"); setLimit(9); };
  return <section id="memories" className="world-memories world-scene trip-archive" aria-labelledby="trip-archive-title">
    <div className="world-section-bar"><ChapterLabel number="04">The Trip Archive</ChapterLabel><span className="world-eyebrow">{trips.length} journeys. Each one a story.</span></div>
    <header className="world-editorial-header" data-world-reveal><div><p className="world-eyebrow">MY ROADS. MY STORIES.</p><div id="trip-archive-title"><KineticHeading lines={["I took the", <em key="road">long way.</em>]} /></div></div><div><p>Places I went.<br />Journeys I brought home.</p><p className="trip-archive-disclosure">{trips.some(trip => trip.sample) ? "An illustrative collection of sample journeys." : "From my public travel journals."}</p></div></header>
    <div className="memory-toolbar trip-archive-toolbar"><SearchField value={query} onChange={value => { setQuery(value); setLimit(9); }} label="Search trips" placeholder="A trip, a place, a country…" /><div className="trip-archive-selects"><label><span>Destination</span><select aria-label="Filter trips by destination" value={country} onChange={event => { setCountry(event.target.value); setLimit(9); }}><option>All places</option>{countries.map(place => <option key={place}>{place}</option>)}</select></label><label><span>Sort journeys</span><select aria-label="Sort trips" value={sort} onChange={event => { setSort(event.target.value); setLimit(9); }}>{["Original order", "Shortest first", "A–Z", ...(trips.some(trip => trip.date) ? ["Latest first"] : [])].map(value => <option key={value}>{value}</option>)}</select></label></div></div>
    <div className="memory-salon"><RouteDrawing variant="memory" /><div className="archive-stamp" aria-hidden="true"><span>THE ART OF</span><strong>going.</strong><small>{String(trips.length).padStart(3, "0")} JOURNEYS / A LIFE IN CHAPTERS</small></div>
      <div className="memory-wall">{items.slice(0, limit).map((trip, index) => <Link className={`memory-print memory-shape-${index % 5} trip-archive-entry`} data-world-tilt data-trip-id={trip.id} href={`/trips/${trip.slug}`} key={trip.id} aria-label={`Explore trip: ${trip.title}`}>
        <div className="memory-image-wrap" data-tilt-plane>{trip.image ? <Image src={trip.image} alt={trip.sample ? "Illustrative trip cover" : ""} width={1600} height={1100} sizes="(max-width: 700px) 90vw, 50vw" loading="lazy" unoptimized={!trip.sample} /> : <div className="trip-archive-no-cover" aria-hidden="true"><span>{trip.country}</span><strong>{trip.title}</strong></div>}<span className="memory-open"><ArrowUpRight size={20} /></span><span className="memory-number">{String(trips.indexOf(trip) + 1).padStart(3, "0")}</span></div>
        <div className="trip-archive-entry-copy"><div className="trip-archive-entry-meta"><span>{trip.sample ? "SAMPLE JOURNEY" : trip.date ? new Intl.DateTimeFormat("en", { month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(trip.date)) : "TRAVEL JOURNAL"}</span><span>{trip.duration}</span></div><h3>{trip.title}</h3><p>{trip.places.join(" → ")}</p><span className="trip-archive-open">Explore this journey <ArrowUpRight size={14} /></span></div>
      </Link>)}</div>
    </div>
    {!items.length && <Empty onReset={reset}>No journeys match yet. Try another place or clear the filters.</Empty>}
    <div className="world-pagination"><span aria-live="polite">{Math.min(limit, items.length)} of {items.length} trips</span>{limit < items.length && <button className="world-link" onClick={() => setLimit(value => value + 9)}>Unfold more journeys <Plus size={16} /></button>}</div>
  </section>;
}
