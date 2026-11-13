import prisma from "../prisma";
import { expeditions } from "@/data/demo/expeditions";
import type { HeroTrip } from "@/data/demo/hero-films";

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
