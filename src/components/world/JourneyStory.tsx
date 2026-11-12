"use client";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowDown, ArrowUpRight } from "lucide-react";
import { destinations } from "@/data/demo/expeditions";
import type { Expedition } from "@/data/demo/types";
import PublicRouteExplorer from "@/components/trips/PublicRouteExplorer";
import TripPhotoCollection from "@/components/trips/TripPhotoCollection";
import { gallery } from "@/data/demo/memories";
import ExpeditionDetail from "./ExpeditionDetail";
import WorldMotion from "./WorldMotion";
import "./world.css";
import "./journey-story.css";
export function JourneyFrame({
  title,
  image,
  intro,
  children,
  label = "The travel journal",
}: {
  title: string;
  image: string;
  intro: string;
  children: ReactNode;
  label?: string;
}) {
  return (
    <div className="living-world journey-story">
      <WorldMotion>
        <header className="journey-cover">
          <div className="journey-cover-image" data-world-parallax="9">
            <Image src={image} alt="" fill priority sizes="100vw" />
          </div>
          <div className="journey-cover-shade" />
          <Link href="/trips" className="journey-return">
            LIFE ATLAS / ALL JOURNEYS ↗
          </Link>
          <div className="journey-cover-title" data-world-reveal>
            <p className="world-eyebrow">{label}</p>
            <h1 className="kinetic-heading">
              <span className="type-line">
                <span className="type-line-inner">{title}</span>
              </span>
            </h1>
            <p>{intro}</p>
            <a href="#journey-content" className="world-link">
              Follow the journey <ArrowDown size={17} />
            </a>
          </div>
          <span className="journey-cover-index">
            A FIELD JOURNAL / LIFE ATLAS
          </span>
        </header>
        <main id="journey-content" className="journey-body">
          {children}
        </main>
        <footer className="journey-end">
          <p className="world-eyebrow">The road keeps going.</p>
          <h2>
            Another place.
            <br />
            <em>Another story.</em>
          </h2>
          <Link className="world-button dark" href="/trips">
            Explore the journeys <ArrowUpRight size={17} />
          </Link>
        </footer>
      </WorldMotion>
    </div>
  );
}
export default function JourneyStory({
  expedition: e,
}: {
  expedition: Expedition;
}) {
  const stops = [...new Set(e.destinationIds)]
    .map((id) => destinations.find((d) => d.id === id))
    .filter((d) => !!d);
  const [active, setActive] = useState(0);
  const current = stops[active];
  return (
    <JourneyFrame
      title={e.name}
      image={e.image}
      intro={e.overview}
      label={"Journey study / " + e.category}
    >
      <section className="journey-prologue">
        <p className="world-eyebrow">01 / THE WAY THERE</p>
        <div data-world-reveal>
          <h2>
            The destination is
            <br />
            <em>only the beginning.</em>
          </h2>
          <p>
            {e.duration} days. {e.route.join(" → ")}. A different pace, and room
            for the unexpected.
          </p>
        </div>
        <p className="journey-disclosure">
          Illustrative journey and photography. The map below connects
          destination coordinates; it is not a recorded GPS track or a navigable
          road route.
        </p>
      </section>
      <section className="journey-route-section">
        <header>
          <p className="world-eyebrow">02 / TRACE THE JOURNEY</p>
          <h2>
            Every turn,
            <br />
            <em>a new perspective.</em>
          </h2>
        </header>
        <div className="journey-cartography">
          <PublicRouteExplorer
            stops={stops}
            activeId={stops[active]?.id}
            onSelect={(id) => setActive(stops.findIndex((d) => d.id === id))}
          />
          <aside>
            <div className="journey-stops" aria-label="Explore route stops">
              {stops.map((d, i) => (
                <button
                  key={d.id}
                  aria-pressed={i === active}
                  onClick={() => setActive(i)}
                >
                  <small>{String(i + 1).padStart(2, "0")}</small>
                  <span>{d.name}</span>
                  <ArrowUpRight size={16} />
                </button>
              ))}
            </div>
            {current && (
              <div className="journey-place-note">
                <p className="world-eyebrow">
                  {current.region} / {current.country}
                </p>
                <h3>{current.name}</h3>
                <p>{current.description}</p>
                <small>
                  {current.latitude.toFixed(2)}° /{" "}
                  {current.longitude.toFixed(2)}°
                </small>
                <Link href={"/places/" + current.slug} className="world-link">
                  Explore this place <ArrowUpRight size={15} />
                </Link>
              </div>
            )}
          </aside>
        </div>
      </section>
      <section className="trip-telemetry sample-telemetry">
        <article>
          <small>Sample itinerary</small>
          <strong>{e.duration} days</strong>
        </article>
        <article>
          <small>Places</small>
          <strong>{stops.length}</strong>
        </article>
        {["Distance", "Highest altitude", "Speed", "Travellers"].map(
          (label) => (
            <article key={label}>
              <small>{label}</small>
              <strong>Not recorded</strong>
            </article>
          ),
        )}
      </section>
      <TripPhotoCollection
        illustrative
        photos={gallery
          .filter((photo) => e.galleryIds.includes(photo.id))
          .map((photo) => ({
            id: photo.id,
            url: photo.src,
            caption: photo.caption,
            location: destinations.find((d) => d.id === photo.destinationId)
              ?.name,
          }))}
      />
      <section className="journey-notebook">
        <p className="world-eyebrow">03 / THE FIELD NOTES</p>
        <ExpeditionDetail expedition={e} />
      </section>
    </JourneyFrame>
  );
}
