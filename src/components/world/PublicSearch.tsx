"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { destinations, expeditions } from "@/data/demo/expeditions";
import { memories } from "@/data/demo/memories";
import { playlists } from "@/data/demo/music";
import { searchRecords } from "@/data/demo/selectors";
import { DemoNote, Modal, SearchField } from "./primitives";
import "./world.css";
const entries = [
  ...destinations.map((d) => ({
    title: d.name,
    description: `${d.region} ${d.country} ${d.description}`,
    type: "Place",
    href: `/places/${d.slug}`,
  })),
  ...expeditions.map((e) => ({
    title: e.name,
    description: e.route.join(" "),
    type: "Journey",
    href: `/trips/${e.slug}`,
  })),
  ...memories.map((m) => ({
    title: m.title,
    description: m.description,
    type: "Memory",
    href: "/photography",
  })),
  ...playlists.map((p) => ({
    title: p.title,
    description: `${p.mood} ${p.description}`,
    type: "Sound",
    href: "/#sound",
  })),
];
export default function PublicSearch({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const results = query.trim()
    ? searchRecords(entries, query, (r) => `${r.title} ${r.description}`)
    : entries.slice(0, 6);
  return (
    <Modal
      title="Search the public atlas"
      onClose={onClose}
      className="public-search"
    >
      <SearchField
        value={query}
        onChange={setQuery}
        label="Search places, journeys, memories, sound"
        placeholder="What are you drawn to?"
      />
      <DemoNote>Search this public demonstration. No private records.</DemoNote>
      <div className="search-public-results" aria-live="polite">
        {results.slice(0, 16).map((r) => (
          <Link href={r.href} key={`${r.type}-${r.title}`} onClick={onClose}>
            <div>
              <small>{r.type}</small>
              <h3>{r.title}</h3>
            </div>
            <ArrowUpRight size={18} />
          </Link>
        ))}
        {!results.length && (
          <p>No matches. Try a place, a feeling, or a different word.</p>
        )}
      </div>
      {results.length > 16 && (
        <Link
          className="world-link"
          href={`/search?q=${encodeURIComponent(query)}`}
          onClick={onClose}
        >
          Explore more results <ArrowUpRight size={16} />
        </Link>
      )}
    </Modal>
  );
}
