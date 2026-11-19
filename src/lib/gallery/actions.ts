import { Capacitor } from "@capacitor/core";
import { R2, systemAction } from "../r2/native";
import { addPlaceFiles, rememberPlaceTransfer } from "../studio/trip-places";
import { getTrip } from "../vault/storage";
import { websiteSlug } from "../vault/website-payload";
import { assignGalleryMedia } from "./store";
import { mediaStamp } from "./model";
import type { DeviceMedia } from "./types";
export const gallerySource = (value: string) => Capacitor.convertFileSrc(value);
export async function prepareGalleryTrip(
  media: DeviceMedia[],
  tripId: string,
  placeId: string,
) {
  const trip = await getTrip(tripId);
  if (!trip?.websitePlaces?.some((p) => p.id === placeId))
    throw Error("Choose a place in this trip.");
  if (!media.length || media.length > 100)
    throw Error("Select between 1 and 100 files per batch.");
  // Check capacity before adding any group; native selected originals remain untouched on failure.
  const { files } = await R2.registerDeviceMedia({
    ids: media.map((m) => m.id),
    versions: Object.fromEntries(media.map((m) => [m.id, mediaStamp(m)])),
  });
  const target = trip.websitePlaces.find((p) => p.id === placeId)!;
  const newFiles = files.filter(
    (f) => !target.files.some((old) => old.id === f.id),
  );
  if (
    (trip.websitePlaces || []).reduce(
      (n, p) => n + p.files.length + p.publishedMedia.length,
      0,
    ) +
      newFiles.length >
    250
  )
    throw Error("This trip supports up to 250 public media items.");
  for (let i = 0; i < newFiles.length; i += 20)
    await addPlaceFiles(tripId, placeId, newFiles.slice(i, i + 20));
  await assignGalleryMedia(
    media.map((m) => ({
      deviceId: m.id,
      sourceStamp: mediaStamp(m),
      tripId,
      placeId,
    })),
  );
  return files;
}
export async function uploadGalleryTrip(
  media: DeviceMedia[],
  tripId: string,
  placeId: string,
) {
  const files = await prepareGalleryTrip(media, tripId, placeId),
    trip = await getTrip(tripId);
  if (!trip) throw Error("Trip not found.");
  const group = trip.websitePlaces!.find((p) => p.id === placeId)!;
  const [progress, configuration] = await Promise.all([
    R2.getTransferProgress(),
    R2.getConfigurationSummary(),
  ]);
  const saved = Object.fromEntries(
    files
      .filter(
        (f) =>
          group.transferIds[f.id] &&
          progress.transfers.some(
            (job) =>
              job.id === group.transferIds[f.id] &&
              job.revision === configuration.public.revision,
          ),
      )
      .map((f) => [f.id, group.transferIds[f.id]]),
  );
  const result = await systemAction(() =>
    R2.beginTripPublication({
      collection: websiteSlug(trip),
      selectionIds: files.map((f) => f.id),
      transferIds: Object.values(saved),
      transfersBySelection: saved,
    }),
  );
  try {
    for (const file of files) {
      const id = result.transferIds[file.id];
      if (!id)
        throw Error(
          "Android did not confirm this queued file. Selections remain saved.",
        );
      await rememberPlaceTransfer(tripId, placeId, file.id, id);
    }
  } finally {
    void R2.endTripPublication({
      publicationSession: result.publicationSession,
    }).catch(() => {});
  }
  return result.transferIds;
}
export async function uploadGalleryPrivate(media: DeviceMedia[]) {
  const { files } = await R2.registerDeviceMedia({
    ids: media.map((m) => m.id),
    versions: Object.fromEntries(media.map((m) => [m.id, mediaStamp(m)])),
  });
  return systemAction(() =>
    R2.queueGalleryUploads({
      slot: "private",
      selectionIds: files.map((f) => f.id),
    }),
  );
}
