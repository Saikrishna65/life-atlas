import { destinations, expeditions } from "../../data/demo/expeditions";
import { gallery } from "../../data/demo/memories";
import { detailedDays, sampleJourneyRoute } from "../../data/demo/journey-details";
import { sampleJourneyTelemetry } from "../../data/demo/journey-telemetry";
import type { Expedition } from "../../data/demo/types";
import { publishedRoute, validPoint, type RoutePoint, type RouteStop } from "./route";

export interface DetailMedia {
  id: string; url: string; poster?: string; kind: "photo" | "video";
  place: string; category: string; caption?: string;
}
export interface DetailDay {
  id: string; day: number; title: string; place: string; description: string;
  date?: string; overnight?: string;
  beats: { time: string; title: string; description: string; kind: string }[];
}
export interface TripDetailData {
  id: string; slug: string; title: string; region: string; overview: string;
  cover: string; coverFilm?: string; sample: boolean; date?: string;
  duration: string; paths: RoutePoint[][]; stops: RouteStop[];
  metrics: { label: string; value: string; unit: string }[];
  days: DetailDay[]; media: DetailMedia[];
  next?: { slug: string; title: string; image: string };
}

export function formatJourneyDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor(minutes % 1440 / 60);
  return `${days ? `${days}d ` : ""}${hours}h ${minutes % 60}m`;
}

export function demoTripDetail(trip: Expedition): TripDetailData {
  const route = publishedRoute(sampleJourneyRoute(trip));
  const fixes = route.paths.flat();
  const places = trip.destinationIds.flatMap(id => {
    const place = destinations.find(place => place.id === id);
    return place ? [place] : [];
  });
  const sameCenter = places.every(place => place.latitude === places[0]?.latitude && place.longitude === places[0]?.longitude);
  const next = expeditions[(expeditions.indexOf(trip) + 1) % expeditions.length];
  const film = trip.category === "Coast" ? "coast" : trip.category === "Nature" ? "gardens" : "highlands";
  const telemetry = sampleJourneyTelemetry(trip.id, trip.duration);
  const number = (value: number) => value.toLocaleString("en", { maximumFractionDigits: 1 });
  return {
    id: trip.id, slug: trip.slug, title: trip.name, region: [...new Set(places.map(place => place.region))].join(" / "),
    overview: trip.overview, cover: trip.image, coverFilm: `/films/hero/${film}.mp4`, sample: true, duration: `${trip.duration} days`,
    paths: route.paths,
    stops: places.map((place, index) => {
      // Coincident rounded gazetteer centers are spread along the synthetic study,
      // never presented as measured trail waypoints.
      const fix = sameCenter ? fixes[Math.round(index * (fixes.length - 1) / Math.max(1, places.length - 1))] : place;
      return { id: place.id, name: place.name, latitude: fix?.latitude ?? place.latitude, longitude: fix?.longitude ?? place.longitude, description: place.description };
    }),
    metrics: telemetry ? [
      { label: "Distance travelled", value: number(telemetry.distanceKm), unit: "km" },
      { label: "Highest altitude", value: number(telemetry.highestMeters), unit: "m" },
      { label: "Total ascent", value: number(telemetry.ascentMeters), unit: "m" },
      { label: "Moving time", value: formatJourneyDuration(telemetry.movingSeconds), unit: "" },
      { label: "Elapsed time", value: formatJourneyDuration(telemetry.elapsedSeconds), unit: "" },
      { label: "Average moving speed", value: number(telemetry.distanceKm / (telemetry.movingSeconds / 3600)), unit: "km/h" },
      { label: "Top speed", value: number(telemetry.maxSpeedKmh), unit: "km/h" },
    ] : [],
    days: detailedDays(trip).map(day => ({ ...day, id: `day-${day.day}`, title: day.headline })),
    media: [
      ...gallery.filter(photo => trip.galleryIds.includes(photo.id) && (!["Mountains", "Nature"].includes(trip.category) || !["ocean", "space"].includes(photo.sourceId))).map(photo => ({ id: photo.id, url: photo.src, poster: photo.thumbnail, kind: "photo" as const, place: destinations.find(place => place.id === photo.destinationId)?.name || "Unassigned", category: "Landscape study", caption: undefined })),
      { id: `${trip.id}-film`, url: `/films/hero/${film}.mp4`, poster: trip.image, kind: "video", place: places[0]?.name || "Unassigned", category: "Film study", caption: "Illustrative silent film, not footage of this sample journey." },
    ],
    next: { slug: next.slug, title: next.name, image: next.image },
  };
}

export interface PublicTripInput {
  id: string; slug: string; title: string; destination: string; description: string | null;
  coverImage: string | null; duration: string | null; startDate: Date | null; routeData: unknown;
  totalDistanceKm: number | null; maxElevationMeters: number | null; elevationGainMeters: number | null;
  tripPlaces: { visitDate?: Date | null; place: { id: string; name: string; latitude: number | null; longitude: number | null; description: string | null } }[];
  tripDays: { id: string; dayIndex: number; date: Date | null; title: string | null; description: string | null }[];
  photos: { id: string; url: string; caption: string | null; place?: { name: string } | null }[];
}
export function publicTripDetail(trip: PublicTripInput, next?: { slug: string; title: string; coverImage: string | null } | null): TripDetailData {
  const route = publishedRoute(trip.routeData);
  const metrics: TripDetailData["metrics"] = [];
  const nonnegative = (value: number | null) => value !== null && Number.isFinite(value) && value >= 0 ? value : null;
  const distance = nonnegative(trip.totalDistanceKm) ?? route.distance;
  const altitude = trip.maxElevationMeters !== null && Number.isFinite(trip.maxElevationMeters) ? trip.maxElevationMeters : route.maxAltitude;
  const average = distance !== null && route.moving !== null && route.moving > 0 ? distance / (route.moving / 3600) : null;
  for (const [label, value, unit] of [
    ["Distance travelled", distance, "km"],
    ["Highest altitude", altitude, "m"],
    ["Total ascent", nonnegative(trip.elevationGainMeters) ?? route.ascent, "m"],
    ["Top speed", route.maxSpeed, "km/h"],
    ["Average moving speed", average, "km/h"],
  ] as const) if (value !== null && Number.isFinite(value) && (value >= 0 || label === "Highest altitude")) metrics.push({ label, value: value.toLocaleString("en", { maximumFractionDigits: 1 }), unit });
  if (route.moving !== null) metrics.push({ label: "Moving time", value: formatJourneyDuration(route.moving), unit: "" });
  if (route.elapsed !== null) metrics.push({ label: "Elapsed time", value: formatJourneyDuration(route.elapsed), unit: "" });
  return {
    id: trip.id, slug: trip.slug, title: trip.title, region: trip.destination, overview: trip.description?.trim() || "",
    cover: trip.coverImage || trip.photos.find(photo => photo.url)?.url || "", sample: false, date: trip.startDate?.toISOString(),
    duration: trip.duration?.trim() || "", paths: route.paths,
    stops: [...trip.tripPlaces].sort((a,b) => (a.visitDate?.getTime() ?? Infinity) - (b.visitDate?.getTime() ?? Infinity)).flatMap(({ place }) => validPoint(place) ? [{ id: place.id, name: place.name, latitude: place.latitude, longitude: place.longitude, description: place.description }] : []),
    metrics,
    days: trip.tripDays.filter(day => day.title?.trim() || day.description?.trim()).map(day => ({ id: day.id, day: day.dayIndex, date: day.date?.toISOString(), title: day.title || `Day ${day.dayIndex}`, place: trip.destination, description: day.description?.trim() || "", beats: [] })),
    media: trip.photos.filter(photo => photo.url).map(photo => ({ id: photo.id, url: photo.url, kind: "photo", place: photo.place?.name || "Unassigned", category: "Trip photography", caption: photo.caption || undefined })),
    next: next ? { slug: next.slug, title: next.title, image: next.coverImage || "" } : undefined,
  };
}
