import { destinations, expeditions } from "./expeditions";
import { gallery } from "./memories";
import { detailedDays, sampleJourneyRoute } from "./journey-details";
import { sampleJourneyTelemetry } from "./journey-telemetry";
import type { Expedition } from "./types";
import {publishedRoute} from "../../lib/public-trips/route";
import {formatJourneyDuration,type TripDetailData} from "../../lib/public-trips/detail";

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

