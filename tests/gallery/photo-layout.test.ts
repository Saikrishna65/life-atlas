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
test("mosaic uses bounded square cells, wide pairs and four-cell features without overlap", () => {
  const items = Array.from({ length: 40 }, (_, i) =>
    asset(String(i), 1, i % 2 ? 6000 : 1000, i % 2 ? 2000 : 8000),
  );
  for (const width of [320, 390, 900, 1440]) {
    const columns = width < 700 ? 3 : 5,
      gap = 4,
      cell = (width - gap * (columns - 1)) / columns;
    const grid = galleryLayout(items, width, columns, gap);
    const areas = new Set<number>();
    for (const p of grid.placements) {
      const sx = Math.round((p.width + gap) / (cell + gap)),
        sy = Math.round((p.height + gap) / (cell + gap));
      assert.ok(
        [
          [1, 1],
          [2, 1],
          [2, 2],
        ].some(([x, y]) => x === sx && y === sy),
      );
      areas.add(sx * sy);
      assert.ok(p.height <= 2 * cell + gap + 0.001, "No long portrait columns");
      assert.ok(p.x >= 0 && p.x + p.width <= width + 0.001);
      for (const q of grid.placements) {
        if (q.index <= p.index) continue;
        assert.ok(
          p.x + p.width <= q.x + 0.001 ||
            q.x + q.width <= p.x + 0.001 ||
            p.y + p.height <= q.y + 0.001 ||
            q.y + q.height <= p.y + 0.001,
          "No overlapping tiles",
        );
      }
    }
    assert.ok(areas.has(1) && areas.has(2) && areas.has(4));
    assert.deepEqual(
      grid,
      galleryLayout(items, width, columns, gap),
      "Stable on rerender",
    );
  }
});
test("chronological headers separate mosaic groups, including enlarged cells", () => {
  const items = [
    asset("a", new Date(2026, 10, 19).getTime(), 2000, 6000),
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
    grid.headers[1].y >
      Math.max(...grid.placements.slice(0, 2).map((p) => p.y + p.height)),
  );
});
test("sparse groups do not become full-width features and unknown dimensions stay bounded", () => {
  const grid = galleryLayout([asset("one", 1, 0, 0)], 900, 5, 4);
  assert.equal(grid.placements[0].width, grid.placements[0].height);
  assert.ok(grid.placements[0].width < 400);
  assert.equal(galleryDay(NaN), "unknown");
  assert.equal(galleryLayout([], 390, 3, 3, true).height, 0);
});

test("invalid saved density cannot hang packing or produce non-finite geometry", () => {
  const items = Array.from({ length: 20 }, (_, i) => asset(String(i), 1));
  for (const columns of [NaN, Infinity, -4, 2.5]) {
    const grid = galleryLayout(items, 390, columns, 3);
    assert.equal(grid.placements.length, 20);
    assert.ok(
      grid.placements.every((p) => Object.values(p).every(Number.isFinite)),
    );
  }
});
