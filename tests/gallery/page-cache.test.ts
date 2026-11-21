import { test } from "node:test";
import assert from "node:assert/strict";
import { GalleryPageCache } from "../../src/lib/gallery/page-cache";
import { GalleryScrollPositions } from "../../src/lib/gallery/use-gallery-scroll";
import type { DevicePage } from "../../src/lib/gallery/types";
const page = (size: number, cursor = "next"): DevicePage => ({
  items: Array.from(
    { length: size },
    (_, i) => ({ id: String(i) }) as DevicePage["items"][number],
  ),
  cursor,
  complete: false,
});
test("returning to a gallery view retains all loaded metadata and the native continuation", () => {
  const cache = new GalleryPageCache(),
    photos = page(240, "page-4");
  cache.put("photos", photos, 1);
  cache.put("favourites", page(3), 1);
  assert.equal(cache.get("photos", 1), photos);
  assert.equal(cache.get("photos", 1)?.cursor, "page-4");
  assert.equal(
    cache.get("photos", 2),
    undefined,
    "changed native media invalidates old lists",
  );
});
test("view cache stays bounded without silently truncating a native page or its cursor", () => {
  const cache = new GalleryPageCache();
  for (let i = 0; i < 7; i++) cache.put(String(i), page(10), 0);
  assert.equal(cache.get("0", 0), undefined);
  assert.ok(cache.get("6", 0));
  cache.put("large", page(5990), 0);
  assert.equal(cache.get("5", 0), undefined);
  assert.ok(cache.get("large", 0));
  cache.put("too-large", page(6001), 0);
  assert.equal(cache.get("too-large", 0), undefined);
});
test("scroll positions belong to individual pages and do not grow without bounds", () => {
  const positions = new GalleryScrollPositions();
  positions.remember("photos", 350);
  positions.remember("people", 1200);
  assert.equal(positions.read("photos"), 350);
  assert.equal(positions.read("favourites"), 0);
  positions.remember("people", -12);
  assert.equal(positions.read("people"), 0);
  for (let i = 0; i < 41; i++) positions.remember("page-" + i, i);
  assert.equal(positions.read("photos"), 0);
});
