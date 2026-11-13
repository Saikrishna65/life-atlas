import test from "node:test";
import assert from "node:assert/strict";
import { selectHeroGalleryPhotos } from "../../src/lib/public-trips/hero-gallery";
import type { HeroGalleryPhoto, HeroTrip } from "../../src/data/demo/hero-films";
import type { PublishedMedia } from "../../src/lib/r2/types";
const trips: HeroTrip[] = [
  { id: "a", slug: "mountain-road", title: "The Mountain Road", image: "/a.webp", sample: false },
  { id: "b", slug: "river-days", title: "River Days", image: "/b.webp", sample: false },
];
const fallback: HeroGalleryPhoto[] = trips.map(trip => ({
  id: `sample-${trip.id}`, src: trip.image, tripId: trip.id,
  tripSlug: trip.slug, tripTitle: trip.title, sample: true,
}));
function photo(id: string, collection: string, overrides: Partial<PublishedMedia> = {}): PublishedMedia {
  return { id, collection, key: `galleries/${id}.jpg`, url: `https://media.example.com/galleries/${id}.jpg`,
    title: "From the road", description: "", category: "expedition", mimeType: "image/jpeg",
    size: 200, tags: [], publishedAt: "2026-11-13T10:00:00Z", metadataPolicy: "removed", ...overrides };
}
test("gallery takes photos from two trips, resolving title/slug aliases and preferring previews", () => {
  const items = [photo("1", "mountain-road", { thumbnailUrl: "https://media.example.com/galleries/previews/1.jpg" }),
    photo("2", " THE MOUNTAIN ROAD "), photo("3", "river-days"), photo("4", "river-days")];
  const before = structuredClone(items);
  const result = selectHeroGalleryPhotos(items, fallback, trips);
  assert.deepEqual(result.map(item => item.id), ["published-1", "published-3"]);
  assert.deepEqual(result.map(item => item.tripId), ["a", "b"]);
  assert.equal(result[0].src, items[0].thumbnailUrl);
  assert.ok(result.every(item => !item.sample));
  assert.deepEqual(items, before);
});
test("videos, non-trip media and unassigned collections never enter the photo card", () => {
  const items = [photo("film", "river-days", { mimeType: "video/mp4" }),
    photo("gallery", "river-days", { category: "gallery" }), photo("none", " ")];
  assert.deepEqual(selectHeroGalleryPhotos(items, fallback, trips), fallback);
});
test("a single real trip photo is not duplicated or mixed with fictional galleries", () => {
  assert.equal(selectHeroGalleryPhotos([photo("real", "mountain-road")], fallback, trips).length, 1);
  const actual = fallback.map(item => ({ ...item, sample: false }));
  const result = selectHeroGalleryPhotos([photo("real", "mountain-road")], actual, trips);
  assert.deepEqual(result.map(item => item.id), ["published-real", "sample-b"]);
});
test("reusing the same photo in two collections does not repeat the image", () => {
  const items = [photo("1", "mountain-road"), photo("2", "river-days", { url: "https://media.example.com/galleries/1.jpg" })];
  assert.equal(selectHeroGalleryPhotos(items, [], trips).length, 1);
  assert.deepEqual(selectHeroGalleryPhotos([], [], trips), []);
});
