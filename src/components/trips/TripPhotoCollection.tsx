"use client";
import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Modal } from "@/components/world/primitives";
export interface TripPhoto {
  id: string;
  url: string;
  caption?: string | null;
  location?: string | null;
  category?: string | null;
}
export default function TripPhotoCollection({
  photos,
  illustrative = false,
}: {
  photos: TripPhoto[];
  illustrative?: boolean;
}) {
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
          (category === "All categories" ||
            (p.category || "Uncategorized") === category) &&
          (place === "All places" ||
            (p.location?.trim() || "Unassigned") === place),
      ),
    [photos, place, category],
  );
  const index = visible.findIndex((p) => p.id === selected),
    focus = visible[index];
  useEffect(() => {
    if (!selected) return;
    const key = (event: KeyboardEvent) => {
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
          <p className="world-eyebrow">THE PHOTO JOURNAL</p>
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
        <p>No photographs have been published for this place yet.</p>
      )}
      <div className="trip-photo-wall">
        {visible.slice(0, limit).map((photo, i) => (
          <button
            key={photo.id}
            onClick={() => setSelected(photo.id)}
            aria-label={
              "View " + (photo.caption || "trip photograph " + (i + 1))
            }
          >
            <Image
              src={photo.url}
              alt={photo.caption || "Trip photograph " + (i + 1)}
              width={1000}
              height={800}
              loading="lazy"
              unoptimized
            />
          </button>
        ))}
      </div>
      {limit < visible.length && (
        <button
          className="world-link photo-more"
          onClick={() => setLimit((n) => n + 24)}
        >
          Unfold more photographs ↗
        </button>
      )}
      {focus && (
        <Modal
          title={focus.caption || "Trip photograph"}
          className="photo-journal-modal"
          onClose={() => setSelected(null)}
        >
          <div className="trip-photo-lightbox">
            <Image
              src={focus.url}
              alt={focus.caption || "Trip photograph"}
              width={1600}
              height={1200}
              unoptimized
            />
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
                ← Previous photograph
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
                Next photograph →
              </button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  );
}
