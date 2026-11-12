"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Film,
  Search,
  X,
} from "lucide-react";
import {
  PUBLIC_CATALOG_STORAGE,
  publicCatalogSource,
  readPublicCatalog,
} from "@/lib/r2/public-catalog";
import type { PublicMediaCatalog } from "@/lib/r2/types";
import { ChapterLabel, Modal } from "./primitives";
import { KineticHeading } from "./EditorialElements";
import "./published-media.css";
export default function PublishedMedia() {
  const [source, setSource] = useState(""),
    [catalog, setCatalog] = useState<PublicMediaCatalog | null>(null),
    [error, setError] = useState(false);
  const [query, setQuery] = useState(""),
    [category, setCategory] = useState("All collections"),
    [collection, setCollection] = useState("All places"),
    [visible, setVisible] = useState(18),
    [selected, setSelected] = useState<string | null>(null);
  const lastFetch = useRef(0);
  useEffect(() => {
    let alive = true;
    let address = "";
    try {
      address =
        new URLSearchParams(location.search).get("atlasCatalog") ||
        localStorage.getItem(PUBLIC_CATALOG_STORAGE) ||
        "";
    } catch {
      /* Public browsing still works with browser storage disabled. */
    }
    if (!address) return;
    try {
      address = publicCatalogSource(address);
    } catch {
      queueMicrotask(() => setError(true));
      return;
    }
    queueMicrotask(() => setSource(address));
    let request: AbortController | undefined,
      timeout: ReturnType<typeof setTimeout> | undefined;
    const load = async () => {
      if (Date.now() - lastFetch.current < 30000) return;
      lastFetch.current = Date.now();
      request?.abort();
      request = new AbortController();
      timeout = setTimeout(() => request?.abort(), 10000);
      try {
        const next = await readPublicCatalog(address, request.signal);
        setCatalog(next);
        setError(false);
        try {
          localStorage.setItem(PUBLIC_CATALOG_STORAGE, address);
        } catch {}
      } catch {
        if (alive) setError(true);
      } finally {
        clearTimeout(timeout);
      }
    };
    void load();
    const focus = () => {
      if (document.visibilityState === "visible") void load();
    };
    window.addEventListener("focus", focus);
    document.addEventListener("visibilitychange", focus);
    return () => {
      alive = false;
      lastFetch.current = 0;
      request?.abort();
      clearTimeout(timeout);
      window.removeEventListener("focus", focus);
      document.removeEventListener("visibilitychange", focus);
    };
  }, []);
  const items = useMemo(
    () =>
      (catalog?.items ?? [])
        .filter(
          (item) =>
            (category === "All collections" || item.category === category) &&
            (collection === "All places" || item.collection === collection) &&
            `${item.title} ${item.description} ${item.tags.join(" ")} ${item.collection}`
              .toLowerCase()
              .includes(query.toLowerCase()),
        )
        .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)),
    [catalog, query, category, collection],
  );
  const focus = items.find((item) => item.id === selected);
  const move = (direction: number) => {
    const index = items.findIndex((item) => item.id === selected);
    setSelected(
      items[(index + direction + items.length) % items.length]?.id ?? null,
    );
  };
  useEffect(() => {
    if (!selected) return;
    const key = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
        event.preventDefault();
        const index = items.findIndex((item) => item.id === selected);
        setSelected(
          items[
            (index + (event.key === "ArrowRight" ? 1 : -1) + items.length) %
              items.length
          ]?.id ?? null,
        );
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [selected, items]);
  if (!source && !error) return null;
  return (
    <section className="world-published world-scene" id="published">
      <div className="world-section-bar">
        <ChapterLabel number="↗">The published world</ChapterLabel>
        <span className="world-eyebrow">
          Explicitly shared / Always original
        </span>
      </div>
      <header className="world-editorial-header" data-world-reveal>
        <KineticHeading
          lines={[
            "A life, in the open.",
            <em key="share">Only what you choose to share.</em>,
          ]}
        />
        <p>
          Independent photographs, moving images and places, published from Life
          Atlas. The private archive stays private.
        </p>
      </header>
      {error && (
        <p className="world-published-status" role="status">
          This published collection is temporarily unavailable. The rest of your
          atlas remains here to explore.
        </p>
      )}
      {!catalog && !error && (
        <p className="world-published-status" role="status">
          Opening the published collection…
        </p>
      )}
      {catalog && (
        <>
          <div className="world-published-toolbar">
            <label>
              <Search size={16} />
              <span className="sr-only">Search published media</span>
              <input
                type="search"
                placeholder="A place, a moment, a detail"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setVisible(18);
                }}
              />
            </label>
            <select
              aria-label="Published media category"
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setVisible(18);
              }}
            >
              {[
                "All collections",
                ...new Set(catalog.items.map((item) => item.category)),
              ].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
            <select
              aria-label="Published collection"
              value={collection}
              onChange={(e) => {
                setCollection(e.target.value);
                setVisible(18);
              }}
            >
              {[
                "All places",
                ...new Set(
                  catalog.items.map((item) => item.collection).filter(Boolean),
                ),
              ].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </div>
          <div className="world-published-gallery">
            {items.slice(0, visible).map((item, index) => (
              <button
                key={item.id}
                className={index % 5 === 0 ? "published-large" : ""}
                onClick={() => setSelected(item.id)}
              >
                <div>
                  {item.thumbnailUrl ? (
                    <img
                      src={item.thumbnailUrl}
                      alt={item.title}
                      loading="lazy"
                      decoding="async"
                      onError={(e) => {
                        e.currentTarget.style.visibility = "hidden";
                      }}
                    />
                  ) : (
                    <div className="published-preview-placeholder">
                      {item.mimeType.startsWith("video/") ? (
                        <Film size={34} />
                      ) : (
                        <span>{String(index + 1).padStart(2, "0")}</span>
                      )}
                      <small>Open the original</small>
                    </div>
                  )}
                  {item.mimeType.startsWith("video/") && (
                    <span className="published-video-mark">
                      <Film size={15} />
                      Motion
                    </span>
                  )}
                </div>
                <span>{item.collection || item.category}</span>
                <h3>{item.title}</h3>
                <small>
                  {new Date(item.publishedAt).toLocaleDateString()}{" "}
                  <ArrowUpRight size={15} />
                </small>
              </button>
            ))}
          </div>
          {items.length === 0 && (
            <p className="world-published-status">
              No published media matches this view.
            </p>
          )}
          <footer>
            <span>
              {Math.min(visible, items.length)} of {items.length} published
              moments
            </span>
            {visible < items.length && (
              <button
                className="world-link"
                onClick={() => setVisible((value) => value + 18)}
              >
                Unfold more photographs <ArrowRight size={16} />
              </button>
            )}
            <small>
              Public catalog updated{" "}
              {new Date(catalog.updatedAt).toLocaleDateString()}
            </small>
          </footer>
        </>
      )}
      {focus && (
        <Modal
          title={focus.title}
          onClose={() => setSelected(null)}
          className="published-lightbox"
        >
          <div className="published-original">
            {focus.mimeType.startsWith("video/") ? (
              <video
                key={focus.id}
                src={focus.url}
                controls
                preload="metadata"
                playsInline
              />
            ) : (
              <img key={focus.id} src={focus.url} alt={focus.title} />
            )}
          </div>
          <div className="published-caption">
            <div>
              <span className="world-eyebrow">
                {focus.collection || focus.category}
              </span>
              <h3>{focus.title}</h3>
              <p>{focus.description}</p>
              <small>{focus.tags.join(" / ")}</small>
            </div>
            <a
              className="world-link"
              href={focus.url}
              target="_blank"
              rel="noreferrer"
            >
              Open original <ArrowUpRight size={15} />
            </a>
          </div>
          <div className="published-controls">
            <button
              className="world-icon"
              aria-label="Previous published moment"
              onClick={() => move(-1)}
            >
              <ArrowLeft size={20} />
            </button>
            <span>Use arrow keys to explore</span>
            <button
              className="world-icon"
              aria-label="Next published moment"
              onClick={() => move(1)}
            >
              <ArrowRight size={20} />
            </button>
            <button className="world-link" onClick={() => setSelected(null)}>
              Return to collection <X size={15} />
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
