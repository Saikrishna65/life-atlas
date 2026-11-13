"use client";
import { KineticHeading, RouteDrawing } from "./EditorialElements";
import Link from "next/link";
import Image from "next/image";
import { useMemo, useState } from "react";
import {
  ArrowUpRight,
  ArrowLeft,
  ArrowRight,
  SlidersHorizontal,
} from "lucide-react";
import { expeditions } from "@/data/demo/expeditions";
import { searchRecords } from "@/data/demo/selectors";
import { ChapterLabel, DemoNote, Empty, SearchField } from "./primitives";
export default function Expeditions() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All terrains");
  const [sort, setSort] = useState("Curated");
  const [page, setPage] = useState(0);
  const items = useMemo(() => {
    const list = searchRecords(
      expeditions,
      query,
      (e) => `${e.name} ${e.route.join(" ")} ${e.activities.join(" ")}`,
    ).filter((e) => category === "All terrains" || e.category === category);
    return sort === "Shortest first"
      ? list.sort((a, b) => a.duration - b.duration)
      : sort === "Budget first"
        ? list.sort((a, b) => a.cost.total - b.cost.total)
        : list;
  }, [query, category, sort]);
  const offset =
    Math.min(page, Math.max(0, Math.ceil(items.length / 3) - 1)) * 3;
  return (
    <section id="expeditions" className="world-expeditions world-scene">
      <RouteDrawing className="expedition-route-background" />
      <div className="world-section-bar">
        <ChapterLabel number="04">The Expeditions</ChapterLabel>
        <span className="world-eyebrow">24 ways to take the long way</span>
      </div>
      <header className="world-editorial-header" data-world-reveal>
        <KineticHeading
          lines={["Go somewhere", <em key="stay">that stays with you.</em>]}
        />
        <div>
          <p>
            The early train. The unfamiliar road.
            <br />
            The story you didn’t see coming.
          </p>
          <DemoNote>Sample journeys, thoughtfully imagined.</DemoNote>
        </div>
      </header>
      <div className="expedition-toolbar">
        <SearchField
          value={query}
          label="Search journeys"
          placeholder="Find your next somewhere"
          onChange={(v) => {
            setQuery(v);
            setPage(0);
          }}
        />
        <div>
          <SlidersHorizontal size={15} />
          <label>
            <span className="sr-only">Filter terrain</span>
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setPage(0);
              }}
            >
              {[
                "All terrains",
                "Mountains",
                "Culture",
                "Coast",
                "Nature",
                "City",
              ].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="sr-only">Sort journeys</span>
            <select
              value={sort}
              onChange={(e) => {
                setSort(e.target.value);
                setPage(0);
              }}
            >
              {["Curated", "Shortest first", "Budget first"].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
        </div>
      </div>
      <div className="expedition-passage expedition-atlas-stack">
        <div className="expedition-stage-index">
          <span>TAKE THE LONG WAY</span>
          <span className="passage-instruction">
            Follow the road, one story at a time
          </span>
          <span>FIELD JOURNALS / {String(items.length).padStart(2, "0")}</span>
        </div>
        <div className="expedition-viewport">
          <div className="expedition-cinema">
            {items.slice(offset, offset + 3).map((e, i) => (
              <Link
                href={`/trips/${e.slug}`}
                className={`expedition-panel panel-${i}`}
                key={e.id}
              >
                <div className="expedition-image-plane">
                  <Image
                    data-world-parallax="3"
                    width={1600}
                    height={1000}
                    sizes="(max-width: 700px) 90vw, 50vw"
                    src={e.image}
                    alt={`Illustrative ${e.category.toLowerCase()} landscape`}
                    loading="lazy"
                  />
                </div>
                <div className="expedition-panel-shade" />
                <span className="expedition-big-index" aria-hidden="true">
                  {String(expeditions.indexOf(e) + 1).padStart(2, "0")}
                </span>
                <div className="expedition-panel-top">
                  <span>
                    FIELD JOURNAL /{" "}
                    {String(expeditions.indexOf(e) + 1).padStart(2, "0")}
                  </span>
                  <ArrowUpRight size={23} />
                </div>
                <div className="expedition-panel-caption">
                  <span>{e.route.join(" — ")}</span>
                  <h3>{e.name}</h3>
                  <p>
                    {e.duration} days <i /> {e.category} <i /> {e.difficulty}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
        <div className="expedition-passage-progress" aria-hidden="true">
          <span />
        </div>
      </div>
      {!items.length && (
        <Empty
          onReset={() => {
            setQuery("");
            setCategory("All terrains");
          }}
        >
          No journeys here yet. Try a different direction.
        </Empty>
      )}
      <footer className="world-pagination">
        <span aria-live="polite">
          {items.length
            ? `${String(offset + 1).padStart(2, "0")}—${String(Math.min(offset + 3, items.length)).padStart(2, "0")}`
            : "00"}{" "}
          / {String(items.length).padStart(2, "0")} journeys
        </span>
        <span className="landscape-note">
          Landscape studies / illustrative imagery
        </span>
        <div>
          <button
            className="world-icon"
            onClick={() => {
              setPage((p) => Math.max(0, p - 1));
            }}
            disabled={offset === 0}
            aria-label="Previous journeys"
          >
            <ArrowLeft size={19} />
          </button>
          <button
            className="world-icon"
            onClick={() => {
              setPage((p) => p + 1);
            }}
            disabled={offset + 3 >= items.length}
            aria-label="Next journeys"
          >
            <ArrowRight size={19} />
          </button>
        </div>
      </footer>
    </section>
  );
}
