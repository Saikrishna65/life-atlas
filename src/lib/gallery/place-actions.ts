import { R2, systemAction } from "../r2/native";
import { mediaStamp } from "./model";
import {
  readPlaces,
  changePlaces,
  recordLocationReads,
  reconnectFingerprints,
} from "./place-store";
import {
  exportPlaceCatalog,
  validatePlaceCatalog,
  mergeRestoredPlaces,
  publicPlacePoint,
  type SavedPlace,
  type PlaceLibrary,
} from "./places";
import { editTripPlaces } from "../studio/trip-places";
import { prepareGalleryTrip } from "./actions";
import { getTrip } from "../vault/storage";
import type { DeviceMedia } from "./types";
export async function scanPlaceLibrary(
  progress: (count: number, text: string) => void,
  cancelled: () => boolean,
  fingerprints = false,
) {
  let cursor = "",
    count = 0;
  const seen = new Set<string>();
  do {
    if (cancelled()) break;
    const page = await R2.listDeviceMedia({
      cursor,
      query: "",
      kind: "all",
      album: "",
      order: "newest",
    });
    const library = await readPlaces();
    for (let i = 0; i < page.items.length; i += fingerprints ? 1 : 20) {
      if (cancelled()) break;
      const batch = page.items.slice(i, i + (fingerprints ? 1 : 20));
      let needed = batch;
      if (!fingerprints)
        needed = batch.filter(
          (d) =>
            !library.media.some(
              (m) =>
                m.device?.id === d.id &&
                m.sourceStamp === mediaStamp(d) &&
                m.scanState !== "unavailable",
            ),
        );
      if (needed.length) {
        const result = await systemAction(() =>
          fingerprints
            ? R2.fingerprintGalleryMedia({
                ids: needed.map((m) => m.id),
                versions: Object.fromEntries(
                  needed.map((m) => [m.id, mediaStamp(m)]),
                ),
              })
            : R2.readDeviceLocations({
                ids: needed.map((m) => m.id),
                versions: Object.fromEntries(
                  needed.map((m) => [m.id, mediaStamp(m)]),
                ),
              }),
        );
        await changePlaces(
          (old) =>
            fingerprints
              ? reconnectFingerprints(old, needed, result.items)
              : recordLocationReads(old, needed, result.items),
          false,
        );
      }
      count += batch.length;
      progress(
        count,
        fingerprints
          ? "Matching original bytes to recovered places"
          : "Reading saved GPS and capture dates",
      );
    }
    if (page.complete || !page.cursor) break;
    if (seen.has(page.cursor))
      throw Error(
        "Android repeated a library page. Previous scan results are saved.",
      );
    seen.add(page.cursor);
    cursor = page.cursor;
    if (count >= 50000)
      throw Error(
        "Scanned 50,000 accessible files. Results are saved; narrow library access to scan more.",
      );
  } while (!cancelled());
  return readPlaces();
}
export async function backupPlaces(
  progress: (count: number, text: string) => void,
  cancelled: () => boolean,
) {
  const configuration = await R2.getConfigurationSummary();
  if (!configuration.private.configured)
    throw Error(
      "Configure private Cloud Storage before backing up place records.",
    );
  if (!configuration.recoveryVerified)
    throw Error(
      "Create or restore and verify your private recovery kit in Cloud Storage first.",
    );
  const library = await readPlaces(),
    ids = new Set(library.places.flatMap((p) => p.members)),
    members = library.media.filter((m) => ids.has(m.id) && m.device);
  let count = 0;
  for (let i = 0; i < members.length; i += 1) {
    if (cancelled())
      throw Error("Backup cancelled. Local place records are saved.");
    const batch = members.slice(i, i + 1).map((m) => m.device!);
    const { items } = await systemAction(() =>
      R2.fingerprintGalleryMedia({
        ids: batch.map((m) => m.id),
        versions: Object.fromEntries(batch.map((m) => [m.id, mediaStamp(m)])),
      }),
    );
    await changePlaces(
      (old) => reconnectFingerprints(old, batch, items),
      false,
    );
    count += batch.length;
    progress(count, "Preparing recoverable file identities");
  }
  if (cancelled())
    throw Error("Backup cancelled. Local place records are saved.");
  const current = await readPlaces(),
    catalog = exportPlaceCatalog(current);
  if (catalog.media.some((m) => !m.fingerprint))
    throw Error(
      "Some saved photos are unavailable and have no recovery fingerprint. Reconnect them before backing up; existing backups are unchanged.",
    );
  const result = await systemAction(() => R2.backupPlaceCatalog({ catalog }));
  return result;
}
export async function restorePlaces(key: string) {
  const result = await systemAction(() => R2.restorePlaceCatalog({ key })),
    catalog = validatePlaceCatalog(result.catalog);
  return changePlaces((local) => mergeRestoredPlaces(local, catalog));
}
export async function addSavedPlaceToTrip(
  place: SavedPlace,
  library: PlaceLibrary,
  tripId: string,
  members = place.members,
) {
  const trip = await getTrip(tripId);
  if (!trip) throw Error("Choose an existing trip.");
  const selected = new Set(members),
    media = library.media.filter((m) => selected.has(m.id));
  if (!media.length) throw Error("Choose at least one photo or video.");
  if (media.some((m) => !m.device))
    throw Error(
      "Reconnect the restored photos before adding this place to a trip.",
    );
  const existing =
    trip.websitePlaces?.find((p) => p.libraryPlaceId === place.id) ||
    trip.websitePlaces?.find(
      (p) => p.name.toLocaleLowerCase() === place.name.toLocaleLowerCase(),
    );
  if (existing?.libraryPlaceId && existing.libraryPlaceId !== place.id)
    throw Error(
      "This trip has a different saved place with that name. Rename this place to keep their photos separate.",
    );
  const id = existing?.id || crypto.randomUUID();
  const already = new Set(
    (existing?.files || []).map((f) => f.galleryId + "|" + f.sourceStamp),
  );
  const fresh = media.filter(
    (m) =>
      !already.has(m.device!.id + "|" + m.sourceStamp) &&
      !existing?.libraryMediaIds?.includes(m.id),
  );
  const total = (trip.websitePlaces || []).reduce(
    (n, p) => n + p.files.length + p.publishedMedia.length,
    0,
  );
  if (total + fresh.length > 250)
    throw Error(
      "This trip supports 250 media items. Choose a visit or a smaller selection.",
    );
  await editTripPlaces(tripId, (places) => {
    const record = {
      ...(places.find((p) => p.id === id) || {
        id,
        files: [],
        transferIds: {},
        publishedMedia: [],
      }),
      name: place.name,
      libraryPlaceId: place.id,
      mapLocation: publicPlacePoint(place),
      mapPrecision: place.anchor ? place.precision : "hidden",
    };
    return [...places.filter((p) => p.id !== id), record];
  });
  for (let i = 0; i < fresh.length; i += 100)
    await prepareGalleryTrip(
      fresh.slice(i, i + 100).map((m) => m.device!) as DeviceMedia[],
      tripId,
      id,
    );
  await editTripPlaces(tripId, (places) =>
    places.map((p) =>
      p.id === id
        ? {
            ...p,
            libraryMediaIds: [
              ...new Set([
                ...(p.libraryMediaIds || []),
                ...media.map((m) => m.id),
              ]),
            ],
          }
        : p,
    ),
  );
  await changePlaces(
    (old) => ({
      ...old,
      places: old.places.map((p) =>
        p.id === place.id
          ? {
              ...p,
              tripLinks: [
                ...(p.tripLinks || []).filter((t) => t.tripId !== tripId),
                {
                  tripId,
                  title: trip.title,
                  ...(trip.publishedSlug ? { slug: trip.publishedSlug } : {}),
                },
              ],
            }
          : p,
      ),
    }),
    false,
  );
  return id;
}
