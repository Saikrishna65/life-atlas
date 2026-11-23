import test from "node:test";
import assert from "node:assert/strict";
import {
  cloudObjectRole,
  cloudPageRequest,
  emptyCloudListing,
  mergeCloudPage,
} from "../../src/lib/r2/storage-layout";
const object = (key: string, size = 10) => ({
  key,
  size,
  modifiedAt: "2026-11-23T00:00:00Z",
  etag: "synthetic",
});
test("public and private recovery records/previews are separated from originals, including legacy keys", () => {
  for (const slot of ["public", "private"] as const) {
    assert.equal(cloudObjectRole(slot, "atlas/catalog/current.json"), "system");
    assert.equal(
      cloudObjectRole(slot, "encrypted/catalog/library/key/items/a.atlas"),
      "system",
    );
    assert.equal(
      cloudObjectRole(slot, "encrypted/catalog/gallery-ai/key/snapshot.atlas"),
      "system",
    );
    assert.equal(cloudObjectRole(slot, "galleries/previews/a.jpg"), "preview");
    assert.equal(
      cloudObjectRole(slot, "encrypted/previews/a.atlas"),
      "preview",
    );
  }
  assert.equal(
    cloudObjectRole("private", "encrypted/photos/a.atlasenc"),
    "original",
  );
  assert.equal(
    cloudObjectRole("public", "galleries/originals/uuid.jpg"),
    "original",
  );
  assert.equal(
    cloudObjectRole("public", "travel/old-original.jpg"),
    "original",
  );
  assert.equal(
    cloudObjectRole("public", "encrypted/photos/a.atlasenc"),
    "system",
  );
});
test("continuations retain their applied prefix even while a different prefix is typed", () => {
  const current = mergeCloudPage(
    emptyCloudListing(),
    { objects: [object("trip/a")], cursor: "page2", complete: false },
    "trip/",
    false,
  );
  assert.deepEqual(cloudPageRequest(current, "another-trip/", true), {
    prefix: "trip/",
    cursor: "page2",
  });
  assert.deepEqual(cloudPageRequest(current, " another-trip/ ", false), {
    prefix: "another-trip/",
    cursor: "",
  });
  assert.throws(
    () => cloudPageRequest(emptyCloudListing(), "", true),
    /no next page/,
  );
});
test("pages deduplicate overlapping keys and fresh folder loads replace previous contents", () => {
  const first = mergeCloudPage(
    emptyCloudListing(),
    { objects: [object("a")], cursor: "next", complete: false },
    "",
    false,
  );
  const next = mergeCloudPage(
    first,
    { objects: [object("a", 20), object("b")], cursor: "", complete: true },
    "",
    true,
  );
  assert.deepEqual(
    next.objects.map((item) => [item.key, item.size]),
    [
      ["a", 20],
      ["b", 10],
    ],
  );
  assert.throws(
    () =>
      mergeCloudPage(
        first,
        { objects: [], cursor: "", complete: true },
        "other/",
        true,
      ),
    /folder changed/,
  );
  const replaced = mergeCloudPage(
    next,
    { objects: [object("c")], cursor: "", complete: true },
    "new/",
    false,
  );
  assert.deepEqual(
    replaced.objects.map((item) => item.key),
    ["c"],
  );
  assert.equal(first.objects[0].size, 10);
});
