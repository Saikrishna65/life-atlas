import prisma from "../prisma";
import { expeditions } from "@/data/demo/expeditions";
import { gallery } from "@/data/demo/memories";
import type { HeroGalleryPhoto, HeroTrip } from "@/data/demo/hero-films";

/** Public travel records only. Native/local vault databases are never read here. */
export async function getLatestHeroTrips(): Promise<HeroTrip[]> {
  try {
    const trips = await prisma.trip.findMany({
      take: 3,
      orderBy: [{ startDate: "desc" }, { id: "asc" }],
      select: { id: true, slug: true, title: true, coverImage: true },
    });
    if (trips.length)
      return trips.map((trip) => ({
        id: trip.id,
        slug: trip.slug,
        title: trip.title,
        image: trip.coverImage || heroImage(trip.slug),
        sample: false,
      }));
  } catch {
    /* The public homepage also works without a configured public database. */
  }
  return expeditions
    .slice(0, 3)
    .map((e) => ({
      id: e.id,
      slug: e.slug,
      title: e.name,
      image: e.image,
      sample: true,
    }));
}
function heroImage(slug: string) {
  return (
    expeditions.find((e) => e.slug === slug)?.image ||
    "/images/world/mountains.webp"
  );
}

/** One existing public photograph per trip, from two different trip journals. */
export async function getHeroGalleryPhotos(): Promise<HeroGalleryPhoto[]> {
  try {
    const trips = await prisma.trip.findMany({
      where: { photos: { some: { url: { not: "" } } } },
      take: 2,
      orderBy: [{ startDate: "desc" }, { id: "asc" }],
      select: {
        id: true, slug: true, title: true,
        photos: {
          where: { url: { not: "" } },
          take: 1,
          orderBy: [{ isFeatured: "desc" }, { date: "desc" }, { id: "asc" }],
          select: { id: true, url: true },
        },
      },
    });
    const photos = trips.flatMap(trip => trip.photos.map(photo => ({
      id: photo.id, src: photo.url, tripId: trip.id, tripSlug: trip.slug,
      tripTitle: trip.title, sample: false,
    })));
    if (photos.length) return photos;
  } catch {
    /* Never read a native vault when the public database is unavailable. */
  }
  const selected: HeroGalleryPhoto[] = [];
  for (const trip of expeditions) {
    const photo = gallery.find(photo => trip.galleryIds.includes(photo.id)
      && !selected.some(current => current.src === photo.thumbnail)
      && (!["Mountains", "Nature"].includes(trip.category) || !["ocean", "space"].includes(photo.sourceId)));
    if (!photo) continue;
    selected.push({
      id: photo.id, src: photo.thumbnail, tripId: trip.id,
      tripSlug: trip.slug, tripTitle: trip.name, sample: true,
    });
    if (selected.length === 2) break;
  }
  return selected;
}
