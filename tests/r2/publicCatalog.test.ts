import test from "node:test";
import assert from "node:assert/strict";
import {
  publicCatalogSource,
  validatePublicCatalog,
} from "../../src/lib/r2/public-catalog";
const source = "https://media.example/atlas/catalog/current.json";
function fixture() {
  return {
    format: "life-atlas-public-media",
    version: 1,
    revision: "version-one",
    updatedAt: "2026-11-12T00:00:00Z",
    items: [
      {
        id: "public-one",
        key: "galleries/originals/one.bin",
        url: "https://media.example/galleries/originals/one.bin",
        title: "Morning light",
        description: "An explicitly published image",
        collection: "Chopta",
        category: "destination",
        mimeType: "image/jpeg",
        size: 123,
        publishedAt: "2026-11-12T00:00:00Z",
        tags: ["morning"],
        metadataPolicy: "removed",
      },
    ],
  };
}
test("versioned public catalog preserves approved media and collections", () =>
  assert.equal(
    validatePublicCatalog(fixture(), source).items[0].collection,
    "Chopta",
  ));
test("catalog source rejects credential URLs, private endpoints and local hosts", () => {
  for (const url of [
    "http://media.example/atlas/catalog/current.json",
    "https://user:secret@media.example/atlas/catalog/current.json",
    source + "?X-Amz-Credential=token",
    "https://localhost/atlas/catalog/current.json",
    "https://0123456789abcdef0123456789abcdef.r2.cloudflarestorage.com/atlas/catalog/current.json",
  ])
    assert.throws(() => publicCatalogSource(url));
});
test("catalog rejects private objects, foreign origins, duplicate IDs and executable media", () => {
  for (const change of [
    (v: ReturnType<typeof fixture>) =>
      (v.items[0].url = "https://evil.example/file.jpg"),
    (v: ReturnType<typeof fixture>) =>
      (v.items[0].key = "encrypted/photos/private"),
    (v: ReturnType<typeof fixture>) => v.items.push({ ...v.items[0] }),
    (v: ReturnType<typeof fixture>) => (v.items[0].mimeType = "text/html"),
  ]) {
    const value = fixture();
    change(value);
    assert.throws(() => validatePublicCatalog(value, source));
  }
});
test("catalog rejects unsupported versions, traversal and invalid sizes", () => {
  for (const change of [
    (v: ReturnType<typeof fixture>) => (v.version = 2),
    (v: ReturnType<typeof fixture>) => (v.items[0].key = "../private"),
    (v: ReturnType<typeof fixture>) => (v.items[0].size = -1),
  ]) {
    const value = fixture();
    change(value);
    assert.throws(() => validatePublicCatalog(value, source));
  }
});
