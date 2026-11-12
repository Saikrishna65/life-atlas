"use client";
import Image from "next/image";
import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, ArrowLeft, ArrowRight } from "lucide-react";
import { destinations, expeditions } from "@/data/demo/expeditions";
import { searchRecords } from "@/data/demo/selectors";
import { DemoNote, SearchField, Empty } from "./primitives";
export default function AtlasDirectory({
  initial = "Journeys",
  initialQuery = "",
}: {
  initial?: string;
  initialQuery?: string;
}) {
  const [tab, setTab] = useState(initial);
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState("All terrains");
  const [sort, setSort] = useState("Curated");
  const [page, setPage] = useState(0);
  const records = useMemo(() => {
    const entries =
      tab === "Places"
        ? destinations.map((d) => ({
            id: d.id,
            title: d.name,
            description: d.description,
            category: d.category,
            route: `${d.region} / ${d.country}`,
            href: `/places/${d.slug}`,
            image: d.image,
            days: d.duration,
            cost: d.budget.amount,
          }))
        : expeditions.map((e) => ({
            id: e.id,
            title: e.name,
            description: e.overview,
            category: e.category,
            route: e.route.join(" → "),
            href: `/trips/${e.slug}`,
            image: e.image,
            days: e.duration,
            cost: e.cost.total,
          }));
    const list = searchRecords(
      entries,
      query,
      (d) => `${d.title} ${d.route} ${d.description}`,
    ).filter((d) => category === "All terrains" || d.category === category);
    return sort === "A—Z"
      ? list.sort((a, b) => a.title.localeCompare(b.title))
      : sort === "Shortest first"
        ? list.sort((a, b) => a.days - b.days)
        : list;
  }, [tab, query, category, sort]);
  return (
    <div className="atlas-directory">
      <div className="directory-toolbar">
        <div className="world-filter-pills">
          {["Journeys", "Places"].map((t) => (
            <button
              key={t}
              aria-pressed={tab === t}
              onClick={() => {
                setTab(t);
                setPage(0);
              }}
            >
              {t}
            </button>
          ))}
        </div>
        <SearchField
          value={query}
          onChange={(v) => {
            setQuery(v);
            setPage(0);
          }}
          label="Search the public atlas"
          placeholder="A place, a road, a possibility"
        />
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
              "Nature",
              "Coast",
              "City",
            ].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Sort directory</span>
          <select
            value={sort}
            onChange={(e) => {
              setSort(e.target.value);
              setPage(0);
            }}
          >
            {["Curated", "A—Z", "Shortest first"].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
      </div>
      <DemoNote>
        Fictional journals and itineraries. Landscape studies are illustrative.
      </DemoNote>
      <div className="atlas-directory-list">
        {records.slice(page * 8, page * 8 + 8).map((r, i) => (
          <Link href={r.href} className="atlas-directory-entry" key={r.id}>
            <span>{String(page * 8 + i + 1).padStart(2, "0")}</span>
            <div className="directory-entry-image">
              <Image
                width={1600}
                height={1000}
                sizes="(max-width: 700px) 90vw, 50vw"
                loading="lazy"
                src={r.image.replace(".webp", "-small.webp")}
                alt={`Illustrative landscape for ${r.title}`}
              />
            </div>
            <div className="directory-entry-text">
              <span className="world-eyebrow">{r.route}</span>
              <h2>{r.title}</h2>
              <p>{r.description}</p>
            </div>
            <div className="directory-entry-meta">
              <span>
                {r.days} days / {r.category}
              </span>
              <ArrowUpRight size={25} />
            </div>
          </Link>
        ))}
      </div>
      {!records.length && (
        <Empty
          onReset={() => {
            setQuery("");
            setCategory("All terrains");
          }}
        >
          No matches yet. Follow another direction.
        </Empty>
      )}
      <div className="world-pagination">
        <span aria-live="polite">
          {records.length} {tab.toLowerCase()} to discover
        </span>
        <div>
          <button
            className="world-icon"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
            aria-label="Previous results"
          >
            <ArrowLeft size={18} />
          </button>
          <span>
            {records.length ? page + 1 : 0} / {Math.ceil(records.length / 8)}
          </span>
          <button
            className="world-icon"
            disabled={(page + 1) * 8 >= records.length}
            onClick={() => setPage((p) => p + 1)}
            aria-label="Next results"
          >
            <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
