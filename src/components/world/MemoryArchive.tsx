"use client";
import { KineticHeading, RouteDrawing } from "./EditorialElements";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, ArrowUpRight, Minus, Plus } from "lucide-react";
import { memories, gallery } from "@/data/demo/memories";
import { destinations, expeditions } from "@/data/demo/expeditions";
import { searchRecords, formatDate } from "@/data/demo/selectors";
import {
  ChapterLabel,
  DemoNote,
  Empty,
  Modal,
  SearchField,
} from "./primitives";
export default function MemoryArchive() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All moments");
  const [year, setYear] = useState("All months");
  const [limit, setLimit] = useState(9);
  const [selected, setSelected] = useState<string | null>(null);
  const [zoom, setZoom] = useState(false);
  const [photo, setPhoto] = useState(0);
  const items = useMemo(
    () =>
      searchRecords(
        memories,
        query,
        (m) => `${m.title} ${m.description} ${m.tags.join(" ")}`,
      ).filter(
        (m) =>
          (category === "All moments" || m.category === category) &&
          (year === "All months" || m.date.slice(5, 7) === year),
      ),
    [query, category, year],
  );
  const current = memories.find((m) => m.id === selected);
  const navigate = (delta: number) => {
    const i = items.findIndex((m) => m.id === selected);
    setSelected(items[(i + delta + items.length) % items.length]?.id ?? null);
    setPhoto(0);
    setZoom(false);
  };
  useEffect(() => {
    if (!selected) return;
    const key = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.preventDefault();
        const index = items.findIndex((m) => m.id === selected);
        setSelected(
          items[
            (index + (e.key === "ArrowRight" ? 1 : -1) + items.length) %
              items.length
          ]?.id ?? null,
        );
        setPhoto(0);
        setZoom(false);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [selected, items]);
  return (
    <section id="memories" className="world-memories world-scene">
      <div className="world-section-bar">
        <ChapterLabel number="05">The Memory Archive</ChapterLabel>
        <span className="world-eyebrow">Collect moments. Not just miles.</span>
      </div>
      <header className="world-editorial-header" data-world-reveal>
        <div>
          <p className="world-eyebrow">Small things. Infinite meaning.</p>
          <KineticHeading
            lines={[
              "Some moments",
              <span key="leave">
                never <em>really leave.</em>
              </span>,
            ]}
          />
        </div>
        <div>
          <p>
            A certain light. A familiar laugh.
            <br />
            The ordinary, made unforgettable.
          </p>
          <DemoNote>108 imagined moments / 180 image records.</DemoNote>
        </div>
      </header>
      <div className="memory-toolbar">
        <SearchField
          value={query}
          onChange={(v) => {
            setQuery(v);
            setLimit(9);
          }}
          label="Search memories"
          placeholder="A place, a feeling, a moment…"
        />
        <div className="world-filter-pills" aria-label="Memory category">
          {["All moments", "Stillness", "Discovery", "People"].map((c) => (
            <button
              key={c}
              aria-pressed={c === category}
              onClick={() => {
                setCategory(c);
                setLimit(9);
              }}
            >
              {c}
            </button>
          ))}
        </div>
        <label className="memory-month">
          <span className="sr-only">Filter month</span>
          <select
            value={year}
            onChange={(e) => {
              setYear(e.target.value);
              setLimit(9);
            }}
          >
            <option>All months</option>
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i} value={String(i + 1).padStart(2, "0")}>
                {new Intl.DateTimeFormat("en", { month: "long" }).format(
                  new Date(2025, i, 1),
                )}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="memory-salon">
        <RouteDrawing variant="memory" />
        <div className="archive-stamp" aria-hidden="true">
          <span>THE ART OF</span>
          <strong>noticing.</strong>
          <small>001—108 / A LIFE IN FRAGMENTS</small>
        </div>
        <div className="memory-wall">
          {items.slice(0, limit).map((m, i) => {
            const p = gallery.find((p) => p.id === m.photoIds[0])!;
            const d = destinations.find((d) => d.id === m.destinationId)!;
            return (
              <button
                className={`memory-print memory-shape-${i % 5}`}
                data-print-index={i}
                data-world-tilt
                key={m.id}
                onClick={() => {
                  setSelected(m.id);
                  setPhoto(0);
                  setZoom(false);
                }}
              >
                <div className="memory-image-wrap" data-tilt-plane>
                  <Image
                    width={1600}
                    height={1000}
                    sizes="(max-width: 700px) 90vw, 50vw"
                    src={p.thumbnail}
                    alt={p.alt}
                    loading="lazy"
                  />
                  <span className="memory-open">
                    <ArrowUpRight size={20} />
                  </span>
                  <span className="memory-number">
                    {String(memories.indexOf(m) + 1).padStart(3, "0")}
                  </span>
                </div>
                <div className="memory-print-caption">
                  <span>
                    {d.name} / {m.category}
                  </span>
                  <h3>{m.title.split(" · ")[0]}</h3>
                  <time dateTime={m.date}>{formatDate(m.date)}</time>
                </div>
              </button>
            );
          })}
        </div>
      </div>
      {items.length === 0 && (
        <Empty
          onReset={() => {
            setQuery("");
            setCategory("All moments");
            setYear("All months");
          }}
        >
          Nothing found. A different word might open another door.
        </Empty>
      )}
      <footer className="world-pagination">
        <span aria-live="polite">
          {Math.min(limit, items.length)} of {items.length} moments
        </span>
        <span className="landscape-note">
          Illustrative collection · six landscape studies
        </span>
        {limit < items.length && (
          <button className="world-link" onClick={() => setLimit((n) => n + 9)}>
            Unfold more memories <Plus size={16} />
          </button>
        )}
      </footer>
      {current && (
        <Modal
          className="memory-lightbox"
          title={current.title}
          onClose={() => setSelected(null)}
        >
          <div
            className="lightbox-image"
            style={{ overflow: zoom ? "auto" : "hidden" }}
          >
            <Image
              width={1600}
              height={1000}
              sizes="(max-width: 700px) 90vw, 50vw"
              style={{
                width: zoom ? "150%" : "100%",
                height: zoom ? "150%" : "100%",
                maxWidth: "none",
              }}
              key={current.photoIds[photo]}
              src={gallery.find((p) => p.id === current.photoIds[photo])!.src}
              alt={gallery.find((p) => p.id === current.photoIds[photo])!.alt}
            />
            <button
              className="lightbox-zoom world-icon"
              aria-label={zoom ? "Zoom out" : "Zoom in"}
              onClick={() => setZoom(!zoom)}
            >
              {zoom ? <Minus /> : <Plus />}
            </button>
          </div>
          <div className="lightbox-notes">
            <span className="world-eyebrow">
              {formatDate(current.date)} /{" "}
              {destinations.find((d) => d.id === current.destinationId)?.name}
            </span>
            <h2>{current.title.split(" · ")[0]}</h2>
            <p>{current.description}</p>
            <DemoNote>Imagined journal. Illustrative imagery.</DemoNote>
            <div className="memory-related">
              <span className="world-eyebrow">Part of the journey</span>
              {current.expeditionIds.slice(0, 2).map((id) => {
                const e = expeditions.find((e) => e.id === id)!;
                return (
                  <Link
                    key={id}
                    href={`/trips/${e.slug}`}
                    onClick={() => setSelected(null)}
                  >
                    {e.name} <ArrowUpRight size={13} />
                  </Link>
                );
              })}
            </div>
            <div className="lightbox-controls">
              <button
                className="world-icon"
                onClick={() => navigate(-1)}
                aria-label="Previous memory"
              >
                <ArrowLeft />
              </button>
              <div className="photo-dots">
                {current.photoIds.map((p, i) => (
                  <button
                    aria-label={`View image ${i + 1}`}
                    aria-pressed={photo === i}
                    key={p}
                    onClick={() => {
                      setPhoto(i);
                      setZoom(false);
                    }}
                  />
                ))}
              </div>
              <span>
                {items.findIndex((m) => m.id === current.id) + 1} /{" "}
                {items.length}
              </span>
              <button
                className="world-icon"
                onClick={() => navigate(1)}
                aria-label="Next memory"
              >
                <ArrowRight />
              </button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  );
}
