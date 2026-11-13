import test from "node:test";
import assert from "node:assert/strict";
import { mediaForTrip, mediaKind } from "../../src/lib/r2/public-media";
import type { PublishedMedia } from "../../src/lib/r2/types";
const item = (
  id: string,
  collection: string,
  category: PublishedMedia["category"],
  mimeType: string,
): PublishedMedia => ({
  id,
  collection,
  category,
  mimeType,
  key: `galleries/${id}`,
  url: `https://media.example.com/galleries/${id}`,
  title: "",
  description: "",
  tags: [],
  size: 100,
  publishedAt: "2026-01-01T00:00:00Z",
  metadataPolicy: "removed",
});
test("trip catalogs accept photos and films only from the explicitly matching expedition", () => {
  const items = [
    item("photo", "himalayan-journey", "expedition", "image/jpeg"),
    item("film", " The Himalayan Journey ", "expedition", "video/mp4"),
    item("other-trip", "himalayan-journey-2", "expedition", "video/mp4"),
    item("other-placement", "himalayan-journey", "memory", "image/jpeg"),
    item("audio", "himalayan-journey", "expedition", "audio/mp3"),
  ];
  assert.deepEqual(
    mediaForTrip(items, "himalayan-journey", "The Himalayan Journey").map(
      (m) => m.id,
    ),
    ["photo", "film"],
  );
  assert.equal(mediaKind(items[0].mimeType), "photo");
  assert.equal(mediaKind(items[1].mimeType), "video");
});
test("matching supports Unicode normalization without substring collection leaks", () => {
  const items = [
    item("exact", "Cafe\u0301 trail", "expedition", "image/webp"),
    item("suffix", "Café trails", "expedition", "image/webp"),
  ];
  assert.deepEqual(
    mediaForTrip(items, "cafe-trail", "Café trail").map((m) => m.id),
    ["exact"],
  );
});
