"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import { Modal } from "@/components/world/primitives";
export interface TripPhoto {
  id: string;
  url: string;
  caption?: string | null;
  location?: string | null;
}
export default function TripPhotoCollection({
  photos,
  illustrative = false,
}: {
  photos: TripPhoto[];
  illustrative?: boolean;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  useEffect(() => {
    if (selected === null) return;
    const key = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight")
        setSelected((i) => ((i ?? 0) + 1) % photos.length);
      if (event.key === "ArrowLeft")
        setSelected((i) => ((i ?? 0) - 1 + photos.length) % photos.length);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [selected, photos.length]);
  return (
    <section className="trip-photo-section">
      <p className="world-eyebrow">THE PHOTO JOURNAL</p>
      <h2>
        The places.
        <br />
        <em>The moments between.</em>
      </h2>
      {illustrative && (
        <p className="journey-disclosure">
          Illustrative landscape studies for this sample itinerary, not
          photographs of an actual completed trip.
        </p>
      )}
      {!photos.length && <p>No trip photographs have been published yet.</p>}
      <div className="trip-photo-wall">
        {photos.map((photo, index) => (
          <button
            key={photo.id}
            onClick={() => setSelected(index)}
            aria-label={
              "View " + (photo.caption || "trip photograph " + (index + 1))
            }
          >
            <Image
              src={photo.url}
              alt={photo.caption || "Published trip photograph"}
              width={1000}
              height={800}
              loading="lazy"
              unoptimized
            />
            <span>{photo.location}</span>
            <p>{photo.caption}</p>
          </button>
        ))}
      </div>
      {selected !== null && photos[selected] && (
        <Modal
          title={photos[selected].caption || "Trip photograph"}
          onClose={() => setSelected(null)}
        >
          <div className="trip-photo-lightbox">
            <Image
              src={photos[selected].url}
              alt={photos[selected].caption || "Trip photograph"}
              width={1600}
              height={1200}
              unoptimized
            />
            <p>
              {photos[selected].location} · {photos[selected].caption}
            </p>
            <div>
              <button
                className="world-link"
                onClick={() =>
                  setSelected((selected - 1 + photos.length) % photos.length)
                }
              >
                ← Previous photograph
              </button>
              <span>
                {selected + 1} / {photos.length}
              </span>
              <button
                className="world-link"
                onClick={() => setSelected((selected + 1) % photos.length)}
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
