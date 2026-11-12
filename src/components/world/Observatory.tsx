"use client";
import Image from "next/image";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, MapPin, ArrowLeft, ArrowRight } from "lucide-react";
import { destinations, expeditions, milestones } from "@/data/demo/expeditions";
import { searchRecords, formatMoney } from "@/data/demo/selectors";
import {
  ChapterLabel,
  DemoNote,
  Modal,
  SearchField,
  Empty,
} from "./primitives";
import ExpeditionDetail from "./ExpeditionDetail";
const Globe = dynamic(() => import("@/components/home/InteractiveGlobe"), {
  ssr: false,
});
export default function Observatory() {
  const [selected, setSelected] = useState(destinations[0].id);
  const [focused, setFocused] = useState<string | undefined>();
  const selectPlace = (id: string) => {
    setSelected(id);
    setFocused(id);
  };
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [detail, setDetail] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [fallback, setFallback] = useState(false);
  const root = useRef<HTMLElement>(null);
  const current = destinations.find((d) => d.id === selected)!;
  const filtered = searchRecords(
    destinations,
    query,
    (d) => `${d.name} ${d.country} ${d.region}`,
  );
  const points = useMemo(
    () =>
      destinations.map((d) => ({
        id: d.id,
        name: d.name,
        slug: d.slug,
        country: d.country,
        latitude: d.latitude,
        longitude: d.longitude,
        tripPlaces: d.expeditionIds.map((id) => {
          const e = expeditions.find((e) => e.id === id)!;
          return { trip: { title: e.name, slug: e.slug } };
        }),
      })),
    [],
  );
  const expedition = expeditions.find((e) => e.id === detail);
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        const canvas = document.createElement("canvas");
        const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
        if (gl) {
          gl.getExtension("WEBGL_lose_context")?.loseContext();
          setReady(true);
        } else setFallback(true);
        observer.disconnect();
      },
      { rootMargin: "450px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return (
    <section
      id="observatory"
      ref={root}
      className="world-observatory world-scene"
    >
      <div className="world-section-bar">
        <ChapterLabel number="03">The Observatory</ChapterLabel>
        <span className="world-eyebrow">A whole world of somewhere</span>
      </div>
      <header className="observatory-heading" data-world-reveal>
        <div>
          <p className="world-eyebrow">Start with a little wonder.</p>
          <h2>
            The world is wide.
            <br />
            <em>Make it personal.</em>
          </h2>
        </div>
        <p>
          Every point, a possibility.
          <br />
          Every journey, a new way of seeing.
        </p>
      </header>
      <div className="observatory-layout">
        <div className="observatory-map">
          <div className="observatory-grid" aria-hidden="true" />
          <span className="map-axis top">N / 90°</span>
          <span className="map-axis bottom">S / 90°</span>
          <div className="observatory-core">
            {ready ? (
              <Globe
                places={points}
                onSelect={selectPlace}
                selectedPlaceId={focused}
              />
            ) : (
              <div className="globe-fallback" aria-label="Map preview">
                <div className="fallback-sphere" />
                <p>
                  {fallback
                    ? "Your world, in words. Select any destination."
                    : "A world coming into view…"}
                </p>
              </div>
            )}
          </div>
          <div className="map-caption">
            <span>
              <i />
              {fallback
                ? "Destination directory"
                : "Drag to wander · Select a marker"}
            </span>
            <span>36 DEMO COORDINATES</span>
          </div>
        </div>
        <aside className="observatory-notes">
          <div className="location-heading">
            <MapPin size={15} />
            <span className="world-eyebrow">In focus / {current.country}</span>
            <span>
              {String(destinations.indexOf(current) + 1).padStart(2, "0")}
            </span>
          </div>
          <div className="location-image">
            <Image
              width={1600}
              height={1000}
              sizes="(max-width: 700px) 90vw, 50vw"
              src={current.image.replace(".webp", "-small.webp")}
              alt={`Illustrative ${current.category.toLowerCase()} landscape`}
              loading="lazy"
            />
            <span>LANDSCAPE STUDY / ILLUSTRATIVE</span>
          </div>
          <h3>{current.name}</h3>
          <p>{current.description}</p>
          <div className="location-stats">
            <div>
              <small>When to go</small>
              <span>{current.season}</span>
            </div>
            <div>
              <small>Make time</small>
              <span>
                {current.duration} days · {current.difficulty}
              </span>
            </div>
            <div>
              <small>Example budget</small>
              <span>{formatMoney(current.budget.amount)}</span>
            </div>
          </div>
          <button
            className="world-link"
            onClick={() => setDetail(current.expeditionIds[0])}
          >
            Open the journey <ArrowUpRight size={17} />
          </button>
          <div className="location-directory">
            <SearchField
              value={query}
              onChange={(v) => {
                setQuery(v);
                setPage(0);
              }}
              label="Search destinations"
              placeholder="Where are you drawn to?"
            />
            <div className="location-list">
              {filtered.slice(page * 4, page * 4 + 4).map((d) => (
                <button
                  key={d.id}
                  className={d.id === selected ? "is-selected" : ""}
                  onClick={() => selectPlace(d.id)}
                >
                  <span>{d.name}</span>
                  <small>{d.country}</small>
                  <ArrowUpRight size={14} />
                </button>
              ))}
              {!filtered.length && (
                <Empty onReset={() => setQuery("")}>
                  No destinations found.
                </Empty>
              )}
            </div>
            <div className="directory-pagination">
              <span aria-live="polite">{filtered.length} destinations</span>
              <button
                disabled={page === 0}
                className="world-icon"
                onClick={() => setPage((p) => p - 1)}
                aria-label="Previous destinations"
              >
                <ArrowLeft size={16} />
              </button>
              <button
                disabled={(page + 1) * 4 >= filtered.length}
                className="world-icon"
                onClick={() => setPage((p) => p + 1)}
                aria-label="Next destinations"
              >
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </aside>
      </div>
      <footer className="observatory-foot">
        <div>
          <strong>{destinations.length}</strong>
          <span>places to imagine</span>
        </div>
        <div>
          <strong>{expeditions.length}</strong>
          <span>journeys to unfold</span>
        </div>
        <div>
          <strong>{milestones.length}</strong>
          <span>sample milestones</span>
        </div>
        <DemoNote>
          Approximate map centers. Example itineraries & budgets.
        </DemoNote>
      </footer>
      {expedition && (
        <Modal title={expedition.name} onClose={() => setDetail(null)}>
          <ExpeditionDetail
            expedition={expedition}
            onNavigate={() => setDetail(null)}
          />
        </Modal>
      )}
    </section>
  );
}
