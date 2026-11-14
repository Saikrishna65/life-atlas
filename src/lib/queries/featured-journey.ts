import prisma from "../prisma";
import { publishedRoute } from "../public-trips/route";
import type { FeaturedJourney } from "../public-trips/featured-journey";
import { expeditions, destinations } from "@/data/demo/expeditions";
import { sampleJourneyRoute } from "@/data/demo/journey-details";

function sample(): FeaturedJourney {
  const trip = expeditions[0];
  const images = ["valley", "ridge", "mountains"];
  const paths = publishedRoute(sampleJourneyRoute(trip)).paths;
  const fixes = paths.flat();
  const headlines = ["Where the road gets quiet.", "Above the everyday.", "A little closer to the sky."];
  return {
    slug: trip.slug, title: trip.name, region: "Uttarakhand, India", intro: trip.overview,
    image: trip.image, sample: true, duration: `${trip.duration} days`, distance: null, altitude: null,
    paths,
    chapters: trip.destinationIds.slice(0, 3).map((id, index) => {
      const place = destinations.find(place => place.id === id)!;
      // Synthetic chapter positions align with the existing synthetic sample line.
      const fix = fixes[Math.round(index * (fixes.length - 1) / 2)];
      return { id, place: place.name, day: `Chapter ${String(index + 1).padStart(2, "0")}`, title: headlines[index], description: place.description, image: `/images/world/${images[index]}.webp`, film: index === 0 ? "/films/hero/highlands.mp4" : undefined, illustrativeMedia: true, latitude: fix?.latitude ?? place.latitude, longitude: fix?.longitude ?? place.longitude };
    }),
  };
}

/** Reuses public web trip records and published GPS fixes. No native vault access. */
export async function getFeaturedJourney(): Promise<FeaturedJourney> {
  try {
    const trip = await prisma.trip.findFirst({
      orderBy: [{ startDate: "desc" }, { id: "asc" }],
      include: {
        tripPlaces: { orderBy: [{ visitDate: "asc" }, { id: "asc" }], include: { place: true } },
        tripDays: { orderBy: { dayIndex: "asc" }, take: 4 },
        photos: { orderBy: [{ isFeatured: "desc" }, { date: "asc" }], take: 30 },
      },
    });
    if (trip) {
      const route = publishedRoute(trip.routeData);
      const image = trip.coverImage || trip.photos[0]?.url || "/images/world/valley.webp";
      const chapters = trip.tripPlaces.slice(0, 4).map(({ place }, index) => {
        const photo = trip.photos.find(photo => photo.placeId === place.id);
        return { id: place.id, place: place.name, day: `Stop ${String(index + 1).padStart(2, "0")}`, title: place.name, description: place.description || "A stop along this journey. Open the full travel journal for the itinerary and photographs.", image: photo?.url || image, illustrativeMedia: !photo && !trip.coverImage && !trip.photos.length, latitude: place.latitude ?? undefined, longitude: place.longitude ?? undefined };
      });
      return {
        slug: trip.slug, title: trip.title, region: trip.destination, intro: trip.description || "The places, the pauses, and everything in between.", image, sample: false,
        duration: trip.duration || (trip.tripDays.length ? `${trip.tripDays.length} ${trip.tripDays.length === 1 ? "day" : "days"}` : "Travel journal"),
        distance: trip.totalDistanceKm ?? route.distance, altitude: trip.maxElevationMeters ?? route.maxAltitude, paths: route.paths,
        chapters: chapters.length ? chapters : (trip.tripDays.length ? trip.tripDays : [{ id: trip.id, title: trip.title, description: trip.description, dayIndex: 1 }]).map(day => ({ id: day.id, place: trip.destination, day: `Day ${day.dayIndex}`, title: day.title || trip.destination, description: day.description || "Open the journey to explore its full itinerary.", image, illustrativeMedia: !trip.coverImage && !trip.photos.length })),
      };
    }
  } catch { /* Offline/unconfigured public database uses the clearly labeled study. */ }
  return sample();
}
