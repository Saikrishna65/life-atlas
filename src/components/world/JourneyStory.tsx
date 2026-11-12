"use client";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowDown, ArrowUpRight, Minus, Plus } from "lucide-react";
import { destinations } from "@/data/demo/expeditions";
import type { Expedition } from "@/data/demo/types";
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
  const [active, setActive] = useState(0),
    [zoom, setZoom] = useState(1);
  const first = stops[0]?.longitude ?? 0;
  const coords = stops.map((d) => ({
    lat: d.latitude,
    lon: first + (((d.longitude - first + 540) % 360) - 180),
  }));
  const minX = Math.min(...coords.map((d) => d.lon)),
    maxX = Math.max(...coords.map((d) => d.lon)),
    minY = Math.min(...coords.map((d) => d.lat)),
    maxY = Math.max(...coords.map((d) => d.lat));
  const colocated = maxX === minX && maxY === minY;
  const points = coords.map((d, i) => ({
    x: colocated
      ? 120 + (i * 560) / Math.max(1, coords.length - 1)
      : maxX === minX
        ? 400
        : 120 + ((d.lon - minX) / (maxX - minX)) * 560,
    y: colocated
      ? 320 - (i % 2) * 120
      : maxY === minY
        ? 260
        : 390 - ((d.lat - minY) / (maxY - minY)) * 260,
  }));
  const path = points
    .map((p, i) => (i ? "L" : "M") + p.x + "," + p.y)
    .join(" ");
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
          <div className="journey-map">
            <svg
              viewBox="0 0 800 520"
              role="img"
              aria-label="Interactive destination schematic"
            >
              <defs>
                <pattern
                  id={"grid-" + e.id}
                  width="40"
                  height="40"
                  patternUnits="userSpaceOnUse"
                >
                  <path
                    d="M40 0H0V40"
                    fill="none"
                    stroke="#1f4fd8"
                    strokeOpacity=".07"
                  />
                </pattern>
              </defs>
              <rect width="800" height="520" fill={"url(#grid-" + e.id + ")"} />
              <g
                transform={
                  "translate(400 260) scale(" + zoom + ") translate(-400 -260)"
                }
              >
                <path d={path} className="journey-route-underlay" />
                <path d={path} className="journey-route-ink" pathLength="1" />
                {points.map((p, i) => (
                  <g key={stops[i].id}>
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={i === active ? 18 : 9}
                      className={i === active ? "active-stop" : ""}
                    />
                    <text x={p.x} y={p.y - 29} textAnchor="middle">
                      {stops[i].name}
                    </text>
                  </g>
                ))}
              </g>
              <text x="30" y="35" className="journey-map-caption">
                ITINERARY SCHEMATIC / NOT A GPS RECORDING
              </text>
              <text x="740" y="465" className="journey-map-caption">
                N ↑
              </text>
            </svg>
            <div className="journey-map-tools">
              <button
                aria-label="Zoom route out"
                disabled={zoom <= 1}
                onClick={() => setZoom((value) => Math.max(1, value - 0.25))}
              >
                <Minus size={16} />
              </button>
              <button
                aria-label="Zoom route in"
                disabled={zoom >= 2}
                onClick={() => setZoom((value) => Math.min(2, value + 0.25))}
              >
                <Plus size={16} />
              </button>
              <button onClick={() => setZoom(1)}>Fit route</button>
            </div>
          </div>
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
      <section className="journey-notebook">
        <p className="world-eyebrow">03 / THE FIELD NOTES</p>
        <ExpeditionDetail expedition={e} />
      </section>
    </JourneyFrame>
  );
}
