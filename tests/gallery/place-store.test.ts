import { test } from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import {
  changePlaces,
  readPlaces,
  undoPlaces,
} from "../../src/lib/gallery/place-store";
import { emptyPlaces, type PlaceMedia } from "../../src/lib/gallery/places";
test("place edits persist, concurrent changes compose, and undo keeps later metadata scans", async () => {
  await changePlaces(() => emptyPlaces(), false);
  await changePlaces((lib) => ({
    ...lib,
    places: [
      {
        id: "t",
        name: "Temple",
        radius: 200,
        precision: "approximate",
        members: [],
        excluded: [],
        visitNames: {},
        confirmedAt: "2026-11-19",
      },
    ],
  }));
  await Promise.all([
    changePlaces((lib) => ({
      ...lib,
      places: lib.places.map((p) => ({ ...p, name: "Tungnath" })),
    })),
    changePlaces((lib) => ({
      ...lib,
      places: lib.places.map((p) => ({ ...p, radius: 300 })),
    })),
  ]);
  let saved = await readPlaces();
  assert.equal(saved.places[0].name, "Tungnath");
  assert.equal(saved.places[0].radius, 300);
  const photo: PlaceMedia = {
    id: "new",
    name: "new.jpg",
    sourceStamp: "10:123",
    kind: "photo",
    size: 10,
    capturedAt: 1000,
    timeSource: "camera-offset",
    scanState: "found",
    gps: { latitude: 30, longitude: 79 },
  };
  await changePlaces(
    (lib) => ({ ...lib, media: [...lib.media, photo] }),
    false,
  );
  saved = await undoPlaces();
  assert.equal(saved.places[0].radius, 200);
  assert.equal(saved.places[0].name, "Tungnath");
  assert.equal(saved.media[0].id, "new");
});
