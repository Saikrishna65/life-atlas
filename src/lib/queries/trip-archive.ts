import prisma from "../prisma";
import type { TripArchiveEntry } from "../public-trips/archive";

/** Public web journeys only. A missing database never opens a private vault. */
export async function getTripArchive(slugs?:string[],source=prisma): Promise<TripArchiveEntry[]> {
  try {
    const trips = await source.trip.findMany({
      ...(slugs?{where:{slug:{in:slugs}}}:{}),
      orderBy: [{ startDate: "desc" }, { id: "asc" }],
      select: { id: true, slug: true, title: true, destination: true, startDate: true,
        duration: true, coverImage: true,
        tripPlaces: { orderBy: [{ visitDate: "asc" }, { id: "asc" }], select: { place: { select: { name: true, country: true } } } },
        _count: { select: { photos: true, tripDays: true } },
      },
    });
    if (trips.length) return [...trips].sort((a,b)=>slugs?slugs.indexOf(a.slug)-slugs.indexOf(b.slug):0).map(trip => ({
      id: trip.id, slug: trip.slug, title: trip.title, image: trip.coverImage || "",
      places: trip.tripPlaces.length ? trip.tripPlaces.map(({ place }) => place.name) : [trip.destination],
      country: [...new Set(trip.tripPlaces.map(({ place }) => place.country))].join(" / ") || "Other places",
      duration: trip.duration || (trip._count.tripDays ? `${trip._count.tripDays} days` : "Travel journal"),
      days: trip._count.tripDays || null, date: trip.startDate?.toISOString()||null, photoCount: trip._count.photos, sample: false,
    }));
  } catch { /* The public demo stays available without a database. */ }
  return [];
}
