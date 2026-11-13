"use client";
import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Film } from "lucide-react";
import { usePublicCatalog } from "@/components/world/usePublicCatalog";
import { mediaForTrip, mediaKind } from "@/lib/r2/public-media";
import { Modal } from "@/components/world/primitives";
export interface TripPhoto {
  id: string;
  url: string;
  caption?: string | null;
  location?: string | null;
  category?: string | null;
  kind?: "photo" | "video";
  poster?: string;
}
export default function TripPhotoCollection({
  photos: sourcePhotos,
  collection,
  illustrative = false,
}: {
  photos: TripPhoto[];
  collection?: { slug: string; title: string };
  illustrative?: boolean;
}) {
  const { catalog, error } = usePublicCatalog();
  const [kind, setKind] = useState("All media");
  const [failed, setFailed] = useState<string | null>(null);
  const photos: TripPhoto[] = useMemo(() => {
    const published = collection
      ? mediaForTrip(
          catalog?.items ?? [],
          collection.slug,
          collection.title,
        ).map((item) => ({
          id: "published-" + item.id,
          url: item.url,
          caption: item.title || undefined,
          category: "Published",
          location: item.tags
            .find((tag) => tag.startsWith("place:"))
            ?.slice(6)
            .trim(),
          kind: mediaKind(item.mimeType),
          poster: item.thumbnailUrl,
        }))
      : [];
    const study: TripPhoto[] = illustrative
      ? [
          {
            id: "motion-study",
            kind: "video",
            url: "/films/mountain-study.mp4",
            poster: "/images/world/mountains-small.webp",
            caption:
              "Silent animated landscape study. Illustrative, not recorded trip footage.",
            category: "Motion studies",
            location: sourcePhotos[0]?.location,
          },
        ]
      : [];
    return [...sourcePhotos, ...study, ...published];
  }, [sourcePhotos, catalog, collection, illustrative]);
  const [category, setCategory] = useState("All categories");
  const [place, setPlace] = useState("All places"),
    [selected, setSelected] = useState<string | null>(null),
    [limit, setLimit] = useState(24);
  const locations = [
    ...new Set(photos.map((p) => p.location?.trim() || "Unassigned")),
  ];
  const visible = useMemo(
    () =>
      photos.filter(
        (p) =>
          (kind === "All media" ||
            (kind === "Films" ? p.kind === "video" : p.kind !== "video")) &&
          (category === "All categories" ||
            (p.category || "Uncategorized") === category) &&
          (place === "All places" ||
            (p.location?.trim() || "Unassigned") === place),
      ),
    [photos, place, category, kind],
  );
  const index = visible.findIndex((p) => p.id === selected),
    focus = visible[index];
  useEffect(() => {
    if (!selected) return;
    const key = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement)?.closest("video,input,textarea,select"))
        return;
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      setSelected(
        visible[
          (index + (event.key === "ArrowRight" ? 1 : -1) + visible.length) %
            visible.length
        ]?.id ?? null,
      );
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [selected, visible, index]);
  return (
    <section id="photo-journal" className="trip-photo-section photo-journal-v2">
      <header>
        <div>
          <p className="world-eyebrow">FRAMES & FILMS</p>
          <h2>
            Less said.
            <br />
            <em>More remembered.</em>
          </h2>
        </div>
        <span>
          {String(visible.length).padStart(2, "0")} frames / a journey in
          fragments
        </span>
      </header>
      {illustrative && (
        <p className="journey-disclosure">
          Illustrative landscape studies for this sample itinerary.
        </p>
      )}
      <nav
        className="photo-place-filters"
        aria-label="Filter photographs by place"
      >
        {["All places", ...locations].map((name) => (
          <button
            key={name}
            aria-pressed={place === name}
            onClick={() => {
              setPlace(name);
              setLimit(24);
              setSelected(null);
            }}
          >
            {name}
          </button>
        ))}
      </nav>
      <div className="trip-media-type" aria-label="Trip media type">
        {["All media", "Photos", "Films"].map((value) => (
          <button
            key={value}
            aria-pressed={kind === value}
            onClick={() => {
              setKind(value);
              setSelected(null);
              setLimit(24);
            }}
          >
            {value}
          </button>
        ))}
      </div>
      {error && (
        <p className="trip-media-error" role="status">
          Published media is temporarily unavailable. The local journal is still
          here.
        </p>
      )}
      <div className="photo-category-filter">
        <label>
          Explore by category{" "}
          <select
            aria-label="Photo category"
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setLimit(24);
              setSelected(null);
            }}
          >
            {[
              "All categories",
              ...new Set(photos.map((p) => p.category || "Uncategorized")),
            ].map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
        </label>
      </div>
      {!visible.length && (
        <p>No media has been published for this place yet.</p>
      )}
      <div className="trip-photo-wall">
        {visible.slice(0, limit).map((photo, i) => (
          <button
            key={photo.id}
            onClick={() => setSelected(photo.id)}
            aria-label={
              "View " +
              (photo.caption ||
                (photo.kind === "video" ? "trip film " : "trip photograph ") +
                  (i + 1))
            }
          >
            {photo.kind === "video" && !photo.poster ? (
              <div className="trip-film-placeholder">
                <Film size={40} />
              </div>
            ) : (
              <Image
                src={photo.kind === "video" ? photo.poster! : photo.url}
                alt={photo.caption || "Trip photograph " + (i + 1)}
                width={1000}
                height={800}
                loading="lazy"
                unoptimized
              />
            )}
            {photo.kind === "video" && (
              <span className="trip-film-mark">
                <Film size={13} /> Film
              </span>
            )}
          </button>
        ))}
      </div>
      {limit < visible.length && (
        <button
          className="world-link photo-more"
          onClick={() => setLimit((n) => n + 24)}
        >
          Unfold more moments ↗
        </button>
      )}
      {focus && (
        <Modal
          title={focus.caption || "Trip photograph"}
          className="photo-journal-modal"
          onClose={() => setSelected(null)}
        >
          <div className="trip-photo-lightbox">
            {focus.kind === "video" ? (
              <video
                key={focus.id}
                src={focus.url}
                poster={focus.poster}
                controls
                playsInline
                preload="metadata"
                onError={() => setFailed(focus.id)}
              />
            ) : (
              <Image
                src={focus.url}
                alt={focus.caption || "Trip photograph"}
                width={1600}
                height={1200}
                unoptimized
              />
            )}
            {failed === focus.id && (
              <p role="status">
                This film could not be loaded.{" "}
                <a href={focus.url} target="_blank" rel="noreferrer">
                  Open the original
                </a>
              </p>
            )}
            <div className="photo-open-details">
              {focus.category && <span>{focus.category} / </span>}
              {focus.location && <span>{focus.location}</span>}
              {focus.caption && <p>{focus.caption}</p>}
            </div>
            <div>
              <button
                className="world-link"
                onClick={() =>
                  setSelected(
                    visible[(index - 1 + visible.length) % visible.length].id,
                  )
                }
              >
                ← Previous moment
              </button>
              <span>
                {index + 1} / {visible.length}
              </span>
              <button
                className="world-link"
                onClick={() =>
                  setSelected(visible[(index + 1) % visible.length].id)
                }
              >
                Next moment →
              </button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  );
}
