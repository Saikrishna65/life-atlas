import type { DeviceMedia } from "./types";
export interface GeoPoint {
  latitude: number;
  longitude: number;
}
export interface LocationRead {
  id: string;
  sourceStamp: string;
  state: "found" | "missing" | "unsupported" | "unavailable";
  gps?: GeoPoint;
  capturedAt?: number;
  timeSource?: string;
  fingerprint?: string;
}
export interface PlaceMedia {
  sourceDeviceId?: string;
  cloud?: { slot: "public" | "private"; key: string; scope: string }[];
  id: string;
  device?: DeviceMedia;
  sourceStamp: string;
  name: string;
  kind: "photo" | "video";
  size: number;
  gps?: GeoPoint;
  capturedAt: number;
  timeSource: string;
  scanState: LocationRead["state"];
  fingerprint?: string;
}
export type PinPrecision = "exact" | "approximate" | "hidden";
export interface SavedPlace {
  tripLinks?: { tripId: string; title: string; slug?: string }[];
  id: string;
  name: string;
  anchor?: GeoPoint;
  radius: number;
  members: string[];
  excluded: string[];
  precision: PinPrecision;
  visitNames: Record<string, string>;
  confirmedAt: string;
}
export interface PlaceLibrary {
  format: "life-atlas-places";
  version: 1;
  revision: number;
  media: PlaceMedia[];
  places: SavedPlace[];
  ignored: string[];
  updatedAt: string;
}
export const emptyPlaces = (): PlaceLibrary => ({
  format: "life-atlas-places",
  version: 1,
  revision: 0,
  media: [],
  places: [],
  ignored: [],
  updatedAt: new Date().toISOString(),
});
export const validGeo = (p: unknown): p is GeoPoint =>
  !!p &&
  typeof p === "object" &&
  Number.isFinite((p as GeoPoint).latitude) &&
  Number.isFinite((p as GeoPoint).longitude) &&
  Math.abs((p as GeoPoint).latitude) <= 90 &&
  Math.abs((p as GeoPoint).longitude) <= 180;
export function metres(a: GeoPoint, b: GeoPoint) {
  const rad = Math.PI / 180,
    dlat = (b.latitude - a.latitude) * rad,
    dlon = (b.longitude - a.longitude) * rad;
  return (
    6371008.8 *
    2 *
    Math.asin(
      Math.sqrt(
        Math.min(
          1,
          Math.sin(dlat / 2) ** 2 +
            Math.cos(a.latitude * rad) *
              Math.cos(b.latitude * rad) *
              Math.sin(dlon / 2) ** 2,
        ),
      ),
    )
  );
}
export function publicPlacePoint(place: SavedPlace) {
  if (!place.anchor || place.precision === "hidden") return undefined;
  return place.precision === "exact"
    ? place.anchor
    : {
        latitude: Math.round(place.anchor.latitude * 100) / 100,
        longitude: Math.round(place.anchor.longitude * 100) / 100,
      };
}
/** Fixed anchors stop a chain of nearby frames from joining two distant places. 3D spatial bins also work across the date line and near the poles. */
export function suggestPlaces(
  media: PlaceMedia[],
  places: SavedPlace[],
  radius: number,
  ignored: string[] = [],
) {
  const distance = Math.max(25, Math.min(5000, radius)),
    cell = 2 * Math.sin(distance / 6371008.8 / 2),
    occupied = new Set(places.flatMap((p) => p.members)),
    skip = new Set(ignored),
    bins = new Map<string, number[]>();
  const result: {
    id: string;
    anchor: GeoPoint;
    members: string[];
    nearPlaceId?: string;
  }[] = [];
  const xyz = (p: GeoPoint) => {
    const lat = (p.latitude * Math.PI) / 180,
      lon = (p.longitude * Math.PI) / 180;
    return [
      Math.cos(lat) * Math.cos(lon),
      Math.cos(lat) * Math.sin(lon),
      Math.sin(lat),
    ].map((n) => Math.floor(n / cell));
  };
  for (const item of [...media].sort((a, b) => a.id.localeCompare(b.id))) {
    if (!item.gps || occupied.has(item.id) || skip.has(item.id)) continue;
    const excluded = places.some((p) => p.excluded.includes(item.id));
    if (excluded) continue;
    const near = places
      .filter((p) => p.anchor && metres(p.anchor, item.gps!) <= p.radius)
      .sort(
        (a, b) => metres(a.anchor!, item.gps!) - metres(b.anchor!, item.gps!),
      )[0];
    if (near) {
      const existing = result.find((g) => g.nearPlaceId === near.id);
      if (existing) existing.members.push(item.id);
      else
        result.push({
          id: "near-" + near.id,
          anchor: near.anchor!,
          members: [item.id],
          nearPlaceId: near.id,
        });
      continue;
    }
    const coords = xyz(item.gps);
    let best = -1,
      nearest = Infinity;
    for (let x = -1; x <= 1; x++)
      for (let y = -1; y <= 1; y++)
        for (let z = -1; z <= 1; z++)
          for (const index of bins.get(
            [coords[0] + x, coords[1] + y, coords[2] + z].join(":"),
          ) || []) {
            const d = metres(result[index].anchor, item.gps);
            if (d <= distance && d < nearest) {
              best = index;
              nearest = d;
            }
          }
    if (best >= 0) result[best].members.push(item.id);
    else {
      const index = result.length;
      result.push({
        id: "suggest-" + item.id,
        anchor: item.gps,
        members: [item.id],
      });
      const key = coords.join(":");
      bins.set(key, [...(bins.get(key) || []), index]);
    }
  }
  return result;
}
export function placeVisits(
  place: SavedPlace,
  media: PlaceMedia[],
  gapHours = 36,
) {
  const selected = new Set(place.members),
    ordered = media
      .filter((m) => selected.has(m.id))
      .sort((a, b) => a.capturedAt - b.capturedAt || a.id.localeCompare(b.id));
  const visits: {
    id: string;
    title: string;
    from: number;
    to: number;
    members: string[];
  }[] = [];
  for (const item of ordered) {
    let visit = visits.at(-1);
    if (!visit || item.capturedAt - visit.to > gapHours * 3600000) {
      const id = item.id;
      visit = {
        id,
        title:
          place.visitNames[id] ||
          new Date(item.capturedAt).toLocaleDateString(),
        from: item.capturedAt,
        to: item.capturedAt,
        members: [],
      };
      visits.push(visit);
    }
    visit.to = item.capturedAt;
    visit.members.push(item.id);
  }
  return visits;
}
export function movePlaceMedia(
  library: PlaceLibrary,
  ids: string[],
  target?: string,
) {
  const chosen = new Set(ids);
  if (ids.some((id) => !library.media.some((m) => m.id === id)))
    throw Error("A selected photo is no longer in this library.");
  if (target && !library.places.some((p) => p.id === target))
    throw Error("Choose a saved place.");
  return {
    ...library,
    places: library.places.map((p) => ({
      ...p,
      members:
        p.id === target
          ? [...new Set([...p.members, ...ids])]
          : p.members.filter((id) => !chosen.has(id)),
      excluded:
        p.id === target
          ? p.excluded.filter((id) => !chosen.has(id))
          : [
              ...new Set([
                ...p.excluded,
                ...p.members.filter((id) => chosen.has(id)),
              ]),
            ],
    })),
  };
}
export function mergePlaces(
  library: PlaceLibrary,
  source: string,
  target: string,
) {
  if (source === target) throw Error("Choose two different places.");
  const from = library.places.find((p) => p.id === source);
  if (!from) throw Error("Place not found.");
  const next = movePlaceMedia(library, from.members, target);
  return { ...next, places: next.places.filter((p) => p.id !== source) };
}
/** Export organization only. URI paths and device IDs never become recovery identifiers. */
export function exportPlaceCatalog(library: PlaceLibrary) {
  const assigned = new Set(library.places.flatMap((p) => p.members));
  return {
    ...library,
    ignored: [],
    media: library.media
      .filter((m) => assigned.has(m.id))
      .map((item) => {
        const copy = { ...item };
        delete copy.device;
        delete copy.sourceDeviceId;
        return copy;
      }),
  };
}
export function validatePlaceCatalog(value: unknown): PlaceLibrary {
  if (!value || typeof value !== "object")
    throw Error("Invalid place catalog.");
  const lib = value as PlaceLibrary;
  if (
    lib.format !== "life-atlas-places" ||
    lib.version !== 1 ||
    !Array.isArray(lib.media) ||
    !Array.isArray(lib.places) ||
    lib.media.length > 50000 ||
    lib.places.length > 5000
  )
    throw Error("Unsupported place catalog.");
  const ids = new Set<string>(),
    places = new Set<string>();
  const safe = (id: unknown) =>
    typeof id === "string" && /^[-a-zA-Z0-9_]{1,80}$/.test(id);
  for (const m of lib.media) {
    if (
      !m ||
      !safe(m.id) ||
      ids.has(m.id) ||
      typeof m.name !== "string" ||
      m.name.length > 1024 ||
      !["photo", "video"].includes(m.kind) ||
      !Number.isFinite(m.size) ||
      m.size < 0 ||
      !Number.isFinite(m.capturedAt) ||
      !["found", "missing", "unsupported", "unavailable"].includes(
        m.scanState,
      ) ||
      typeof m.sourceStamp !== "string" ||
      (m.gps !== undefined && !validGeo(m.gps)) ||
      (m.fingerprint !== undefined &&
        !/^[a-f0-9]{24}:[a-f0-9]{64}$/.test(m.fingerprint))
    )
      throw Error("Invalid media record in catalog.");
    if (
      m.cloud !== undefined &&
      (!Array.isArray(m.cloud) ||
        m.cloud.length > 20 ||
        m.cloud.some(
          (c) =>
            !c ||
            !["public", "private"].includes(c.slot) ||
            typeof c.key !== "string" ||
            c.key.length > 1024 ||
            c.key.split("/").some((s) => s === ".." || s === ".") ||
            typeof c.scope !== "string" ||
            !/^[a-f0-9]{64}$/.test(c.scope),
        ))
    )
      throw Error("Invalid cloud references in catalog.");
    ids.add(m.id);
  }
  const assigned = new Set<string>();
  for (const p of lib.places) {
    if (
      !p ||
      !safe(p.id) ||
      places.has(p.id) ||
      typeof p.name !== "string" ||
      !p.name.trim() ||
      p.name.length > 54 ||
      (p.anchor !== undefined && !validGeo(p.anchor)) ||
      !Number.isFinite(p.radius) ||
      p.radius < 25 ||
      p.radius > 5000 ||
      !["exact", "approximate", "hidden"].includes(p.precision) ||
      !Array.isArray(p.members) ||
      !Array.isArray(p.excluded) ||
      !p.visitNames ||
      typeof p.visitNames !== "object" ||
      Array.isArray(p.visitNames) ||
      Object.values(p.visitNames).some(
        (v) => typeof v !== "string" || v.length > 80,
      )
    )
      throw Error("Invalid place in catalog.");
    if (
      p.tripLinks !== undefined &&
      (!Array.isArray(p.tripLinks) ||
        p.tripLinks.length > 500 ||
        p.tripLinks.some(
          (t) =>
            !t ||
            !safe(t.tripId) ||
            typeof t.title !== "string" ||
            t.title.length > 150 ||
            (t.slug !== undefined &&
              (typeof t.slug !== "string" || t.slug.length > 200)),
        ))
    )
      throw Error("Invalid trip references in catalog.");
    for (const id of p.members) {
      if (!ids.has(id) || assigned.has(id))
        throw Error("Duplicated or missing place member.");
      assigned.add(id);
    }
    if (!p.excluded.every((id) => typeof id === "string"))
      throw Error("Invalid place exclusions.");
    places.add(p.id);
  }
  return {
    format: "life-atlas-places",
    version: 1,
    revision: Number.isSafeInteger(lib.revision) ? lib.revision : 0,
    updatedAt:
      typeof lib.updatedAt === "string"
        ? lib.updatedAt
        : new Date().toISOString(),
    ignored: Array.isArray(lib.ignored)
      ? lib.ignored.filter((id) => typeof id === "string")
      : [],
    media: lib.media.map((m) => ({
      ...m,
      device: undefined,
      sourceDeviceId: undefined,
    })),
    places: lib.places.map((p) => ({ ...p })),
  };
}
export function mergeRestoredPlaces(local: PlaceLibrary, remote: PlaceLibrary) {
  const mapping = new Map<string, string>(),
    media = [...local.media];
  const matchedLocal = new Set<string>();
  for (const incoming of remote.media) {
    const same = local.media.find(
      (m) =>
        !matchedLocal.has(m.id) &&
        (m.id === incoming.id ||
          (incoming.fingerprint && m.fingerprint === incoming.fingerprint)),
    );
    if (same) matchedLocal.add(same.id);
    mapping.set(incoming.id, same?.id || incoming.id);
    if (!same) media.push({ ...incoming, device: undefined });
  }
  let places = [...local.places];
  const occupied = new Set(places.flatMap((p) => p.members));
  for (const p of remote.places) {
    const same = places.find((old) => old.id === p.id);
    const members = p.members
      .map((id) => mapping.get(id)!)
      .filter((id) => !occupied.has(id));
    if (same)
      places = places.map((old) =>
        old.id === p.id
          ? { ...old, members: [...new Set([...old.members, ...members])] }
          : old,
      );
    else
      places.push({
        ...p,
        members,
        excluded: p.excluded.map((id) => mapping.get(id) || id),
      });
    members.forEach((id) => occupied.add(id));
  }
  return { ...local, media, places };
}
