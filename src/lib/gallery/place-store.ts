import { readGalleryPreference, editGalleryPreference } from "./store";
import {
  emptyPlaces,
  type PlaceLibrary,
  type LocationRead,
  type PlaceMedia,
} from "./places";
import type { DeviceMedia } from "./types";
import { mediaStamp } from "./model";
const KEY = "place-library-v1";
interface State {
  current: PlaceLibrary;
  undo: PlaceLibrary[];
}
export async function readPlaces() {
  return (
    await readGalleryPreference<State>(KEY, {
      current: emptyPlaces(),
      undo: [],
    })
  ).current;
}
export async function changePlaces(
  edit: (library: PlaceLibrary) => PlaceLibrary,
  undo = true,
) {
  const state = await editGalleryPreference<State>(
    KEY,
    { current: emptyPlaces(), undo: [] },
    (old) => ({
      current: {
        ...edit(structuredClone(old.current)),
        revision: old.current.revision + 1,
        updatedAt: new Date().toISOString(),
      },
      undo: undo ? [...old.undo, old.current].slice(-5) : old.undo,
    }),
  );
  return state.current;
}
export async function undoPlaces() {
  const state = await editGalleryPreference<State>(
    KEY,
    { current: emptyPlaces(), undo: [] },
    (old) => {
      const previous = old.undo.at(-1);
      if (!previous) throw Error("No place edits to undo.");
      return {
        current: {
          ...previous,
          media: [
            ...new Map(
              [...previous.media, ...old.current.media].map((m) => [m.id, m]),
            ).values(),
          ],
          revision: old.current.revision + 1,
          updatedAt: new Date().toISOString(),
        },
        undo: old.undo.slice(0, -1),
      };
    },
  );
  return state.current;
}
export function recordLocationReads(
  library: PlaceLibrary,
  devices: DeviceMedia[],
  reads: LocationRead[],
) {
  const versions = new Map(devices.map((d) => [d.id, mediaStamp(d)]));
  const media = library.media.map((m) =>
      m.device &&
      versions.has(m.device.id) &&
      versions.get(m.device.id) !== m.sourceStamp
        ? { ...m, device: undefined, scanState: "unavailable" as const }
        : m,
    ),
    bySource = new Map(
      media.flatMap((m, i) =>
        m.device ? [[m.device.id + "|" + m.sourceStamp, i] as const] : [],
      ),
    );
  for (const device of devices) {
    const stamp = mediaStamp(device),
      read = reads.find((r) => r.id === device.id && r.sourceStamp === stamp);
    if (!read) continue;
    const index = bySource.get(device.id + "|" + stamp),
      old = index !== undefined ? media[index] : undefined;
    const next: PlaceMedia = {
      ...old,
      id: old?.id || crypto.randomUUID(),
      device,
      sourceDeviceId: device.id,
      sourceStamp: stamp,
      name: device.name,
      kind: device.kind,
      size: device.size,
      gps: read.gps ?? old?.gps,
      gpsSource:read.gpsSource??old?.gpsSource,
      capturedAt: read.capturedAt || old?.capturedAt || device.addedAt,
      timeSource: read.timeSource || old?.timeSource || "library-added",
      scanState: read.fingerprint && old ? old.scanState : read.state,
      fingerprint: read.fingerprint || old?.fingerprint,
    };
    if (index === undefined) {
      bySource.set(device.id + "|" + stamp, media.length);
      media.push(next);
    } else media[index] = next;
  }
  return { ...library, media };
}
/** Match exact original bytes after reinstall, even for pictures with no GPS. Never guesses by filename. */
export function reconnectFingerprints(
  library: PlaceLibrary,
  devices: DeviceMedia[],
  reads: LocationRead[],
) {
  let next = recordLocationReads(library, devices, reads);
  for (const read of reads) {
    if (!read.fingerprint) continue;
    const live = next.media.find(
      (m) => m.device?.id === read.id && m.sourceStamp === read.sourceStamp,
    );
    if (!live) continue;
    const detached = next.media.filter(
      (m) =>
        m.id !== live.id && m.fingerprint === read.fingerprint && !m.device,
    );
    for (const old of detached.slice(0, 1)) {
      next = {
        ...next,
        media: next.media
          .filter((m) => m.id !== old.id)
          .map((m) =>
            m.id === live.id
              ? {
                  ...m,
                  gps: m.gps ?? old.gps,
                  capturedAt:
                    m.timeSource === "library-added"
                      ? old.capturedAt
                      : m.capturedAt,
                  timeSource:
                    m.timeSource === "library-added"
                      ? old.timeSource
                      : m.timeSource,
                  scanState: old.gps && !m.gps ? "found" : m.scanState,
                }
              : m,
          ),
        places: next.places.map((p) => ({
          ...p,
          members: [
            ...new Set(p.members.map((id) => (id === old.id ? live.id : id))),
          ],
          excluded: [
            ...new Set(p.excluded.map((id) => (id === old.id ? live.id : id))),
          ],
          visitNames: {
            ...p.visitNames,
            ...(p.visitNames[old.id]
              ? { [live.id]: p.visitNames[old.id] }
              : {}),
          },
        })),
      };
    }
  }
  return next;
}
