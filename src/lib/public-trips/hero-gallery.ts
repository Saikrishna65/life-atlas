import type { HeroGalleryPhoto, HeroTrip } from "../../data/demo/hero-films";
import type { PublishedMedia } from "../r2/types";

const normalize = (value: string) => value.trim().normalize("NFC").toLocaleLowerCase("en");

/** Only explicitly public trip photographs are eligible; films and unrelated collections are excluded. */
export function selectHeroGalleryPhotos(
  published: PublishedMedia[],
  fallback: HeroGalleryPhoto[],
  trips: Pick<HeroTrip, "id" | "slug" | "title">[],
): HeroGalleryPhoto[] {
  const known = [...trips, ...fallback.map(photo => ({
    id: photo.tripId, slug: photo.tripSlug, title: photo.tripTitle,
  }))];
  const candidates: HeroGalleryPhoto[] = published
    .filter(item => item.category === "expedition" && item.mimeType.startsWith("image/") && item.collection.trim())
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || a.id.localeCompare(b.id))
    .map(item => {
      const trip = known.find(trip => [trip.slug, trip.title].some(value => normalize(value) === normalize(item.collection)));
      return {
        id: `published-${item.id}`,
        src: item.thumbnailUrl || item.url,
        tripId: trip?.id || `collection-${normalize(item.collection)}`,
        tripSlug: trip?.slug || item.collection.trim(),
        tripTitle: trip?.title || item.collection.trim(),
        sample: false,
      };
    });
  candidates.push(...fallback.filter(photo => !photo.sample));
  // Illustrations never fill an empty slot beside a real published photograph.
  if (!candidates.length) candidates.push(...fallback);
  const selected: HeroGalleryPhoto[] = [];
  for (const photo of candidates) {
    if (!selected.some(current => current.tripId === photo.tripId || current.src === photo.src)) selected.push(photo);
    if (selected.length === 2) break;
  }
  return selected;
}
