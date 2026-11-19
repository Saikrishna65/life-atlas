import type { PublicPlace } from "../queries/public-content";
import { validGeo } from "../gallery/places";
interface GlobeTrip {
  id: string;
  slug: string;
  title: string;
  destination: string;
  coverImage: string | null;
  routeData: unknown;
  tripPlaces: {
    place: {
      id: string;
      slug: string;
      name: string;
      latitude: number | null;
      longitude: number | null;
      country: string;
      region: string | null;
      description: string | null;
      coverImage: string | null;
    };
  }[];
}
/** One explicit trip pin, never the collection of individual photo-place coordinates. */
export function globeTripPins(trips: GlobeTrip[]): PublicPlace[] {
  return trips.flatMap((trip) => {
    const legacy = trip.tripPlaces.find(
      (p) => p.place.slug === trip.slug + "-trip-location",
    )?.place;
    const location = (
      trip.routeData as { publication?: { tripLocation?: unknown } } | null
    )?.publication?.tripLocation;
    const point = validGeo(location)
      ? location
      : validGeo(legacy)
        ? legacy
        : null;
    if (!point) return [];
    return [
      {
        id: trip.id,
        slug: trip.slug,
        name: trip.destination || trip.title,
        country: legacy?.country || "",
        region: legacy?.region || "",
        description: legacy?.description || "",
        image: trip.coverImage || legacy?.coverImage || "",
        latitude: point.latitude,
        longitude: point.longitude,
        tripPlaces: [{ trip: { title: trip.title, slug: trip.slug } }],
      },
    ];
  });
}
