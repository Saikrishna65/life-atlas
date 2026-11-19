import { test } from "node:test";
import assert from "node:assert/strict";
import {
  emptyPlaces,
  suggestPlaces,
  metres,
  placeVisits,
  movePlaceMedia,
  mergePlaces,
  publicPlacePoint,
  exportPlaceCatalog,
  validatePlaceCatalog,
  mergeRestoredPlaces,
  type PlaceMedia,
  type SavedPlace,
} from "../../src/lib/gallery/places";
import {
  recordLocationReads,
  reconnectFingerprints,
} from "../../src/lib/gallery/place-store";
const media = (
  id: string,
  lat = 30.488,
  lon = 79.217,
  time = Date.UTC(2026, 10, 5),
): PlaceMedia => ({
  id,
  name: id + ".jpg",
  kind: "photo",
  size: 100,
  gps: { latitude: lat, longitude: lon },
  capturedAt: time,
  timeSource: "camera-offset",
  sourceStamp: "100:123",
  scanState: "found",
});
const place = (id: string, members: string[] = []): SavedPlace => ({
  id,
  name: id,
  anchor: { latitude: 30.488, longitude: 79.217 },
  radius: 200,
  members,
  excluded: [],
  precision: "approximate",
  visitNames: {},
  confirmedAt: "2026-11-19",
});
test("fixed anchor radius does not chain a walking route into one place", () => {
  const frames = [media("a"), media("b", 30.4895), media("c", 30.491)];
  const groups = suggestPlaces(frames, [], 200);
  assert.equal(groups.length, 2);
  for (const g of groups)
    for (const id of g.members)
      assert.ok(metres(g.anchor, frames.find((m) => m.id === id)!.gps!) <= 200);
  assert.deepEqual(groups, suggestPlaces([...frames].reverse(), [], 200));
});
test("spatial bins cluster across date line and keep distinct coordinates separate", () => {
  const groups = suggestPlaces(
    [media("a", 0, 179.9999), media("b", 0, -179.9999), media("c", 0, 179)],
    [],
    100,
  );
  assert.equal(groups.length, 2);
  assert.equal(groups[0].members.length, 2);
  assert.equal(
    suggestPlaces(
      [media("a", 89.99, 179.99), media("b", 89.99, -179.99)],
      [],
      100,
    ).length,
    1,
  );
});
test("confirmed places invite nearby additions without mutating them; removed and ignored files stay unassigned", () => {
  const p = place("temple", ["a"]);
  p.excluded = ["b"];
  const data = [media("a"), media("b"), media("c"), media("d")];
  const groups = suggestPlaces(data, [p], 200, ["d"]);
  assert.deepEqual(groups[0].members, ["c"]);
  assert.equal(groups[0].nearPlaceId, p.id);
  assert.deepEqual(p.members, ["a"]);
});
test("separate visits retain capture dates and custom labels", () => {
  const p = place("temple", ["a", "b", "c"]);
  p.visitNames.c = "Return in winter";
  const visits = placeVisits(p, [
    media("a"),
    media("b", 30, 79, Date.UTC(2026, 10, 5, 5)),
    media("c", 30, 79, Date.UTC(2026, 11, 8)),
  ]);
  assert.equal(visits.length, 2);
  assert.equal(visits[1].title, "Return in winter");
  assert.equal(visits[0].members.length, 2);
});
test("manual assignment works without GPS, bulk moves, splits and merges preserve single membership", () => {
  let lib = emptyPlaces();
  const noGps = media("b");
  delete noGps.gps;
  lib.media = [media("a"), noGps];
  lib.places = [place("one", ["a", "b"]), place("two")];
  lib = movePlaceMedia(lib, ["b"], "two");
  assert.deepEqual(lib.places[0].members, ["a"]);
  assert.deepEqual(lib.places[1].members, ["b"]);
  assert.ok(lib.places[0].excluded.includes("b"));
  lib = mergePlaces(lib, "two", "one");
  assert.deepEqual(new Set(lib.places[0].members), new Set(["a", "b"]));
  assert.equal(lib.places.length, 1);
  assert.equal(lib.media[1].gps, undefined);
  assert.throws(() => movePlaceMedia(lib, ["gone"], "one"));
});
test("public map precision never mutates original GPS", () => {
  const p = place("temple");
  assert.deepEqual(publicPlacePoint(p), { latitude: 30.49, longitude: 79.22 });
  p.precision = "exact";
  assert.equal(publicPlacePoint(p), p.anchor);
  p.precision = "hidden";
  assert.equal(publicPlacePoint(p), undefined);
  assert.deepEqual(p.anchor, { latitude: 30.488, longitude: 79.217 });
});
test("encrypted recovery catalog exports no source URI and rejects broken references", () => {
  const lib = emptyPlaces(),
    m = media("one");
  m.device = {
    id: "image:external:42",
    uri: "content://private",
    name: "a",
    kind: "photo",
    size: 100,
    modifiedAt: 123,
    addedAt: 123,
    width: 100,
    height: 100,
    duration: 0,
    album: "Camera",
    mimeType: "image/jpeg",
  };
  lib.media = [m, media("unassigned")];
  lib.places = [place("temple", ["one"])];
  const exported = exportPlaceCatalog(lib);
  assert.equal(exported.media.length, 1);
  assert.ok(!JSON.stringify(exported).includes("content://"));
  assert.equal(validatePlaceCatalog(exported).media[0].device, undefined);
  assert.throws(() =>
    validatePlaceCatalog({ ...exported, places: [place("bad", ["missing"])] }),
  );
  assert.throws(() =>
    validatePlaceCatalog({
      ...exported,
      media: [{ ...m, gps: { latitude: 999, longitude: 79 } }],
    }),
  );
  assert.throws(() =>
    validatePlaceCatalog({
      ...exported,
      places: [place("a", ["one"]), place("b", ["one"])],
    }),
  );
});
test("restore merges preserve newer local names and assignments", () => {
  const local = emptyPlaces();
  local.media = [media("a")];
  local.places = [place("here", ["a"])];
  local.places[0].name = "Corrected name";
  const remote = structuredClone(local);
  remote.media.push(media("b"));
  remote.places[0].name = "Old name";
  remote.places[0].members.push("b");
  const merged = mergeRestoredPlaces(local, remote);
  assert.equal(merged.places[0].name, "Corrected name");
  assert.deepEqual(new Set(merged.places[0].members), new Set(["a", "b"]));
});
test("exact-file recovery restores a manually located photo with no camera GPS", () => {
  let lib = emptyPlaces();
  const old = media("restored");
  delete old.gps;
  old.fingerprint = "a".repeat(24) + ":" + "b".repeat(64);
  lib.media = [old];
  lib.places = [place("temple", ["restored"])];
  const device = {
    id: "image:external:900",
    name: "renamed.jpg",
    kind: "photo" as const,
    mimeType: "image/jpeg",
    size: 100,
    modifiedAt: 456,
    addedAt: Date.UTC(2026, 10, 19),
    uri: "content://media/external/images/media/900",
    width: 100,
    height: 100,
    duration: 0,
    album: "Camera",
  };
  lib = reconnectFingerprints(
    lib,
    [device],
    [
      {
        id: device.id,
        sourceStamp: "100:456",
        state: "missing",
        fingerprint: old.fingerprint,
      },
    ],
  );
  assert.equal(lib.media.length, 1);
  assert.equal(lib.media[0].device?.id, device.id);
  assert.equal(lib.media[0].capturedAt, old.capturedAt);
  assert.equal(lib.media[0].gps, undefined);
  assert.equal(lib.places[0].members[0], lib.media[0].id);
});
test("reconnection maps duplicate originals one-to-one, preserving distinct place memberships", () => {
  let lib = emptyPlaces();
  const a = media("a"),
    b = media("b");
  a.fingerprint = b.fingerprint = "a".repeat(24) + ":" + "b".repeat(64);
  lib.media = [a, b];
  lib.places = [place("one", ["a"]), place("two", ["b"])];
  const d = {
    id: "image:external:90",
    name: "same.jpg",
    kind: "photo" as const,
    mimeType: "image/jpeg",
    size: 100,
    modifiedAt: 123,
    addedAt: 123,
    uri: "content://media/external/images/media/90",
    width: 100,
    height: 100,
    duration: 0,
    album: "Camera",
  };
  lib = reconnectFingerprints(
    lib,
    [d],
    [
      {
        id: d.id,
        sourceStamp: "100:123",
        state: "missing",
        fingerprint: a.fingerprint,
      },
    ],
  );
  assert.notEqual(lib.places[0].members[0], lib.places[1].members[0]);
  assert.equal(lib.media.filter((m) => !m.device).length, 1);
});

test("a changed original becomes an unassigned new version; old place metadata is not silently rebound", () => {
  const device = {
    id: "image:external:1",
    name: "photo.jpg",
    kind: "photo" as const,
    mimeType: "image/jpeg",
    size: 100,
    modifiedAt: 123,
    addedAt: 123,
    uri: "content://media/1",
    width: 100,
    height: 100,
    duration: 0,
    album: "Camera",
  };
  let lib = emptyPlaces();
  lib = recordLocationReads(
    lib,
    [device],
    [
      {
        id: device.id,
        sourceStamp: "100:123",
        state: "found",
        gps: { latitude: 30, longitude: 79 },
      },
    ],
  );
  const first = lib.media[0].id;
  lib.places = [place("temple", [first])];
  lib = recordLocationReads(
    lib,
    [{ ...device, modifiedAt: 456 }],
    [
      {
        id: device.id,
        sourceStamp: "100:456",
        state: "found",
        gps: { latitude: 31, longitude: 80 },
      },
    ],
  );
  assert.equal(lib.media.length, 2);
  assert.equal(lib.media.find((m) => m.id === first)?.device, undefined);
  assert.equal(lib.places[0].members[0], first);
  assert.equal(lib.media.find((m) => m.device)?.gps?.latitude, 31);
});
test("cloud object references round-trip separately from originals and reject unsafe paths", () => {
  const lib = emptyPlaces();
  const m = media("one");
  m.cloud = [
    {
      slot: "private",
      scope: "a".repeat(64),
      key: "encrypted/photos/original.atlas",
    },
  ];
  lib.media = [m];
  lib.places = [place("temple", ["one"])];
  assert.deepEqual(
    validatePlaceCatalog(exportPlaceCatalog(lib)).media[0].cloud,
    m.cloud,
  );
  m.cloud[0].key = "../unrelated";
  assert.throws(
    () => validatePlaceCatalog(exportPlaceCatalog(lib)),
    /cloud references/,
  );
});
