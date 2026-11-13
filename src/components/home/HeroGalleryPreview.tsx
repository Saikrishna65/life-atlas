"use client";
import Image from "next/image";
import { useState } from "react";
import type { HeroGalleryPhoto, HeroTrip } from "@/data/demo/hero-films";
import { selectHeroGalleryPhotos } from "@/lib/public-trips/hero-gallery";
import { usePublicCatalog } from "@/components/world/usePublicCatalog";

export default function HeroGalleryPreview({ photos, trips }: {
  photos: HeroGalleryPhoto[];
  trips: HeroTrip[];
}) {
  const { catalog } = usePublicCatalog();
  const [failed, setFailed] = useState<string[]>([]);
  const selected = selectHeroGalleryPhotos(catalog?.items ?? [], photos, trips)
    .filter(photo => !failed.includes(photo.src));
  return (
    <>
      <span className="trip-film-photo-stack" aria-hidden="true" data-photo-count={selected.length}>
        {selected.map(photo => (
          <Image
            key={photo.id}
            src={photo.src}
            alt=""
            width={110}
            height={72}
            sizes="110px"
            unoptimized
            data-trip-id={photo.tripId}
            data-trip-slug={photo.tripSlug}
            data-sample={photo.sample}
            onError={() => setFailed(current => [...current, photo.src])}
          />
        ))}
      </span>
      <span className="hero-gallery-caption">
        Photo Gallery
        {selected.length > 0 && selected.every(photo => photo.sample) && <small>Sample trip galleries</small>}
      </span>
    </>
  );
}
