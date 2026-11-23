import { test } from "node:test";
import assert from "node:assert/strict";
import { GalleryViewportIndex } from "../../src/lib/gallery/viewport-index";
import { galleryLayout } from "../../src/lib/gallery/layout";
import type { GalleryAsset } from "../../src/lib/gallery/types";
test("indexed windows match the original filter and preserve mosaic order across gaps and overlaps", () => {
  const items = Array.from(
    { length: 2000 },
    (_, index) =>
      ({
        id: String(index),
        date: Date.UTC(2026, 10, 23 - Math.floor(index / 25)),
        device: { width: index % 3 ? 4000 : 2000, height: 3000 },
      }) as GalleryAsset,
  );
  const layout = galleryLayout(items, 390, 4, 3, true),
    index = new GalleryViewportIndex(layout.placements);
  for (let top = -1200; top < layout.height; top += 547) {
    const result = index.query(top, 844);
    assert.deepEqual(
      result.items,
      layout.placements.filter(
        (p) => p.y + p.height >= top - 600 && p.y <= top + 844 + 600,
      ),
    );
  }
});
test("large libraries inspect a small tree window rather than every tile", () => {
  const items = Array.from({ length: 100000 }, (_, index) => ({
    index,
    y: Math.floor(index / 4) * 100,
    height: index % 12 === 0 ? 200 : 100,
  }));
  const index = new GalleryViewportIndex(items),
    result = index.query(900000, 844);
  assert.ok(result.visited < 500, `${result.visited} tree nodes visited`);
  assert.deepEqual(
    result.items,
    items.filter((p) => p.y + p.height >= 899400 && p.y <= 901444),
  );
});
test("empty, zero-height and unusually tall overlapping items retain exact intersection semantics", () => {
  const values = [
    { id: "tall", y: 0, height: 100000 },
    { id: "middle", y: 500, height: 1 },
    { id: "last", y: 1000, height: 0 },
  ];
  assert.deepEqual(new GalleryViewportIndex(values).query(999, 1, 0).items, [
    values[0],
    values[2],
  ]);
  assert.deepEqual(new GalleryViewportIndex([]).query(0, 100).items, []);
});
