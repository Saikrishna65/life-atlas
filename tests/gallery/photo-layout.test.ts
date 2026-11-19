import { test } from "node:test";
import assert from "node:assert/strict";
import { galleryLayout, galleryDay } from "../../src/lib/gallery/layout";
import type { GalleryAsset } from "../../src/lib/gallery/types";
const asset = (
  id: string,
  date: number,
  width = 4000,
  height = 3000,
): GalleryAsset => ({
  id,
  date,
  name: id,
  kind: "photo",
  size: 100,
  mimeType: "image/jpeg",
  device: {
    id,
    name: id,
    kind: "photo",
    size: 100,
    addedAt: date,
    modifiedAt: date,
    mimeType: "image/jpeg",
    width,
    height,
    uri: "content://test/" + id,
    album: "Camera",
    duration: 0,
  },
});
test("chronological groups have date headings and thumbnails never overlap them", () => {
  const items = [
    asset("a", new Date(2026, 10, 19).getTime()),
    asset("b", new Date(2026, 10, 19).getTime()),
    asset("c", new Date(2026, 10, 18).getTime()),
  ];
  const grid = galleryLayout(items, 390, 3, 3, true);
  assert.equal(grid.headers.length, 2);
  assert.deepEqual(grid.headers[0].indices, [0, 1]);
  for (const h of grid.headers)
    for (const index of h.indices)
      assert.ok(grid.placements.find((p) => p.index === index)!.y >= h.y + 44);
  assert.ok(
    grid.headers[1].y > grid.placements[1].y + grid.placements[1].height,
  );
});
test("completed photo rows fill the available width while mixed formats keep their proportions", () => {
  const grid = galleryLayout(
    [
      asset("landscape", 1),
      asset("portrait", 1, 3000, 4000),
      asset("wide", 1, 6000, 3000),
    ],
    600,
    3,
    4,
  );
  assert.equal(grid.placements[0].y, grid.placements[2].y);
  assert.ok(
    Math.abs(grid.placements.at(-1)!.x + grid.placements.at(-1)!.width - 600) <
      0.01,
  );
  for (const p of grid.placements)
    assert.ok(
      p.x >= 0 && p.width > 0 && p.height > 0 && p.x + p.width <= 600.01,
    );
  assert.notEqual(grid.placements[0].width, grid.placements[1].width);
});
test("nonchronological sorting can disable date headings and one item is not stretched across the library", () => {
  const item = asset("one", 1);
  const grid = galleryLayout([item], 900, 5, 4);
  assert.equal(grid.headers.length, 0);
  assert.ok(grid.placements[0].width < 400);
  assert.equal(galleryDay(NaN), "unknown");
  assert.equal(galleryLayout([], 390, 3, 3, true).height, 0);
});
