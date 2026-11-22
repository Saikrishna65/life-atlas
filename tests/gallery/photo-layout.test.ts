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
test("masonry preserves portrait, landscape and video proportions without overlapping tiles", () => {
  const items = [
    asset("portrait", 1, 2000, 4000),
    asset("landscape", 1, 4000, 2000),
    asset("square", 1, 2000, 2000),
    asset("wide", 1, 6000, 2000),
    asset("tall", 1, 2000, 6000),
  ];
  for (const width of [320, 390, 900, 1440]) {
    const layout = galleryLayout(items, width, width < 700 ? 3 : 5, 4);
    for (const p of layout.placements) {
      assert.ok(
        Math.abs(
          p.width / p.height -
            items[p.index].device!.width / items[p.index].device!.height,
        ) < 0.0001,
      );
      assert.ok(p.x >= 0 && p.x + p.width <= width + 0.001);
      for (const q of layout.placements) {
        if (q.index <= p.index) continue;
        assert.ok(
          p.x + p.width <= q.x + 0.001 ||
            q.x + q.width <= p.x + 0.001 ||
            p.y + p.height <= q.y + 0.001 ||
            q.y + q.height <= p.y + 0.001,
          "Tiles never overlap",
        );
      }
    }
    assert.ok(layout.placements[0].height > layout.placements[0].width);
    assert.ok(
      new Set(layout.placements.map((p) => Math.round(p.height))).size >= 3,
    );
  }
});
test("chronological headers separate masonry groups, including their tallest images", () => {
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
test("wide landscapes receive more space, sparse groups stay compact and unknown dimensions are safe", () => {
  const grid = galleryLayout(
    [asset("wide", 1, 6000, 2000), asset("square", 1, 2000, 2000)],
    900,
    5,
    4,
  );
  assert.ok(grid.placements[0].width > grid.placements[1].width * 1.9);
  assert.ok(
    galleryLayout([asset("one", 1)], 900, 5, 4).placements[0].width < 400,
  );
  assert.equal(galleryDay(NaN), "unknown");
  assert.equal(galleryLayout([], 390, 3, 3, true).height, 0);
});
