"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import {
  timelineEvents,
  expeditions,
  destinations,
  milestones,
} from "@/data/demo/expeditions";
import { formatDate, searchRecords } from "@/data/demo/selectors";
import { DemoNote, SearchField, Empty } from "./primitives";
export default function PublicTimeline() {
  const [query, setQuery] = useState("");
  const [month, setMonth] = useState("All months");
  const [limit, setLimit] = useState(20);
  const [mode, setMode] = useState("Journal");
  const entries: {
    id: string;
    title: string;
    date: string;
    description: string;
    place: (typeof destinations)[number];
    expedition: (typeof expeditions)[number] | undefined;
  }[] =
    mode === "Journal"
      ? timelineEvents.map((t) => ({
          ...t,
          place: destinations.find((d) => d.id === t.destinationId)!,
          expedition: expeditions.find((e) => e.id === t.expeditionId),
          description: t.description,
        }))
      : milestones.map((m) => ({
          ...m,
          expeditionId: undefined,
          place: destinations.find((d) => d.id === m.destinationId)!,
          expedition: undefined,
          description:
            "An imagined travel milestone, linked to a place in the sample atlas.",
        }));
  const filtered = searchRecords(
    entries,
    query,
    (t) => `${t.title} ${t.place.name} ${t.description}`,
  ).filter((t) => month === "All months" || t.date.slice(5, 7) === month);
  return (
    <div className="public-timeline">
      <div className="directory-toolbar">
        <SearchField
          value={query}
          onChange={(v) => {
            setQuery(v);
            setLimit(20);
          }}
          label="Search timeline"
          placeholder="Find a chapter in time"
        />
        <div className="world-filter-pills">
          {["Journal", "Milestones"].map((m) => (
            <button
              key={m}
              aria-pressed={mode === m}
              onClick={() => {
                setMode(m);
                setLimit(20);
              }}
            >
              {m}
            </button>
          ))}
        </div>
        <label>
          <span className="sr-only">Timeline month</span>
          <select
            value={month}
            onChange={(e) => {
              setMonth(e.target.value);
              setLimit(20);
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
      <DemoNote>
        120 fictional journal events / 42 imagined milestones.
      </DemoNote>
      <ol className="public-timeline-list">
        {filtered.slice(0, limit).map((t) => (
          <li key={t.id}>
            <time>{formatDate(t.date)}</time>
            <div>
              <span className="world-eyebrow">
                {t.place.name} / {t.place.country}
              </span>
              <h2>{t.title}</h2>
              <p>{t.description}</p>
              <Link
                className="world-link"
                href={
                  t.expedition
                    ? `/trips/${t.expedition.slug}`
                    : `/places/${t.place.slug}`
                }
              >
                Follow the story <ArrowUpRight size={15} />
              </Link>
            </div>
          </li>
        ))}
      </ol>
      {!filtered.length && (
        <Empty
          onReset={() => {
            setMonth("All months");
            setQuery("");
          }}
        >
          No moments match this search.
        </Empty>
      )}
      <div className="world-pagination">
        <span>
          {Math.min(limit, filtered.length)} of {filtered.length} entries
        </span>
        {limit < filtered.length && (
          <button
            className="world-link"
            onClick={() => setLimit((n) => n + 20)}
          >
            Read another chapter <ArrowUpRight size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
