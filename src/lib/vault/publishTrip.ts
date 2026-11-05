import { getTrip, getItinerariesForTrip, getMemoriesForTrip, saveTrip } from "./storage";
import { notifyVaultChange } from "./useTripVault";
import type { ID, TripRecord } from "./types";

export interface PublishTripResult {
  success: boolean;
  slug: string;
  publicUrl: string;
  placesCount: number;
  photoCount: number;
  memoryCount: number;
  message: string;
}

/**
 * Publishes or updates a trip from the local Trip Vault directly to the public website.
 * Syncs trip details, days, waypoints/places, multi-image memories, and GPS expedition distance.
 */
export async function publishTripToWebsite(
  tripId: ID,
  selectedMemoryIds?: string[]
): Promise<PublishTripResult> {
  const trip = await getTrip(tripId);
  if (!trip) throw new Error("Trip not found in local vault.");
  if (!trip.startDate) throw new Error("Set the trip travel dates before publishing.");

  const [itineraries, allMemories] = await Promise.all([
    getItinerariesForTrip(tripId),
    getMemoriesForTrip(tripId),
  ]);

  const memoriesToExport =
    selectedMemoryIds && selectedMemoryIds.length > 0
      ? allMemories.filter((m) => selectedMemoryIds.includes(m.id))
      : allMemories;

  // Extract all unique places from waypoints, destinations, and memories
  const placesMap = new Map<
    string,
    { name: string; latitude?: number; longitude?: number; region?: string }
  >();

  if (trip.destination) {
    placesMap.set(trip.destination.toLowerCase(), {
      name: trip.destination,
      region: "Uttarakhand",
    });
  }

  for (const wp of trip.waypoints || []) {
    const wpTitle = wp.title?.trim();
    if (wpTitle) {
      placesMap.set(wpTitle.toLowerCase(), {
        name: wpTitle,
        latitude: typeof wp.latitude === "number" && wp.latitude !== 0 ? wp.latitude : undefined,
        longitude: typeof wp.longitude === "number" && wp.longitude !== 0 ? wp.longitude : undefined,
        region: "Uttarakhand",
      });
    }
  }

  for (const mem of memoriesToExport) {
    const p = (mem.placeName || mem.location)?.trim();
    if (p && !placesMap.has(p.toLowerCase())) {
      placesMap.set(p.toLowerCase(), { name: p, region: "Uttarakhand" });
    }
  }

  // Cover image fallback
  const cover =
    trip.coverImage ||
    memoriesToExport.find((m) => m.imageDataUrl)?.imageDataUrl ||
    memoriesToExport.find((m) => m.images?.[0])?.images?.[0];

  const payload = {
    tripId: trip.id,
    title: trip.title,
    destination: trip.destination,
    startDate: trip.startDate,
    endDate: trip.endDate || trip.completedAt,
    description:
      trip.notes ||
      `Expedition across ${trip.destination}. Published directly from Life Atlas Trip Vault.`,
    coverImage: cover,
    totalDistanceKm: trip.liveExpedition?.totalDistanceKm,
    existingSlug: trip.publishedSlug,
    places: Array.from(placesMap.values()),
    memories: memoriesToExport.map((m) => ({
      title: m.title,
      caption: m.caption,
      date: m.date,
      placeName: m.placeName || m.location,
      imageUrl: m.imageDataUrl,
      images: m.images,
    })),
    itineraryDays: itineraries.map((d) => ({
      dayIndex: d.dayIndex,
      date: d.date,
      title: d.title || `Day ${d.dayIndex + 1}`,
      description:
        d.description ||
        d.activities?.map((a) => `${a.startTime || ""} ${a.title}`).join(", "),
    })),
  };

  const response = await fetch("/api/vault/export", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data.success) {
    throw new Error(data.error || `Failed to export trip (HTTP ${response.status})`);
  }

  // Stamp publishedSlug and publishedAt on the local trip
  const updatedTrip: TripRecord = {
    ...trip,
    publishedSlug: data.slug,
    publishedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await saveTrip(updatedTrip);
  notifyVaultChange();

  return data as PublishTripResult;
}
