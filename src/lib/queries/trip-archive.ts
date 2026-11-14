import prisma from "../prisma";
import { expeditions, destinations } from "@/data/demo/expeditions";
import type { TripArchiveEntry } from "../public-trips/archive";

/** Public web journeys only. A missing database never opens a private vault. */
export async function getTripArchive(): Promise<TripArchiveEntry[]> {
  try {
    const trips = await prisma.trip.findMany({
      orderBy: [{ startDate: "desc" }, { id: "asc" }],
      select: { id: true, slug: true, title: true, destination: true, startDate: true,
        duration: true, coverImage: true,
        tripPlaces: { orderBy: [{ visitDate: "asc" }, { id: "asc" }], select: { place: { select: { name: true, country: true } } } },
        _count: { select: { photos: true, tripDays: true } },
      },
    });
    if (trips.length) return trips.map(trip => ({
      id: trip.id, slug: trip.slug, title: trip.title, image: trip.coverImage || "",
      places: trip.tripPlaces.length ? trip.tripPlaces.map(({ place }) => place.name) : [trip.destination],
      country: [...new Set(trip.tripPlaces.map(({ place }) => place.country))].join(" / ") || "Other places",
      duration: trip.duration || (trip._count.tripDays ? `${trip._count.tripDays} days` : "Travel journal"),
      days: trip._count.tripDays || null, date: trip.startDate.toISOString(), photoCount: trip._count.photos, sample: false,
    }));
  } catch { /* The public demo stays available without a database. */ }
  return expeditions.map(trip => ({
    id: trip.id, slug: trip.slug, title: trip.name, image: trip.image,
    places: trip.route, country: [...new Set(trip.destinationIds.map(id => destinations.find(place => place.id === id)?.country).filter(Boolean))].join(" / "),
    duration: `${trip.duration} days`, days: trip.duration, date: null, photoCount: null, sample: true,
  }));
}
