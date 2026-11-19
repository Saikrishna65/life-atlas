import { test } from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import {
  deviceAsset,
  cloudAsset,
  statusLabel,
  mediaStamp,
  assetAssignments,
  publishedAsset,
  matchesStatus,
  currentBucketTransfers,
} from "../../src/lib/gallery/model";
import {
  galleryAssignments,
  assignGalleryMedia,
  saveGalleryPreference,
  readGalleryPreference,
} from "../../src/lib/gallery/store";
import { savePastTrip } from "../../src/lib/studio/store";
import { addTripPlace } from "../../src/lib/studio/trip-places";
import type { DeviceMedia } from "../../src/lib/gallery/types";
import type { Transfer, PublishedMedia } from "../../src/lib/r2/types";
const media: DeviceMedia = {
  id: "image:external:42",
  name: "photo.jpg",
  kind: "photo",
  mimeType: "image/jpeg",
  size: 100,
  addedAt: 100,
  modifiedAt: 200,
  width: 4000,
  height: 3000,
  duration: 0,
  album: "Camera",
  uri: "content://media/external/images/media/42",
};
const job: Transfer = {
  id: "upload",
  galleryId: media.id,
  sourceStamp: mediaStamp(media),
  slot: "public",
  direction: "upload",
  key: "galleries/originals/a.bin",
  name: "photo.jpg",
  mimeType: "image/jpeg",
  createdAt: 300,
  status: "complete",
  verified: true,
};
test("unchecked never means not uploaded; stale file versions never inherit cloud proof", () => {
  assert.equal(statusLabel(deviceAsset(media, []), []), "Not checked");
  assert.equal(
    statusLabel(deviceAsset(media, [job]), []),
    "Public copy recorded",
  );
  assert.equal(
    statusLabel(deviceAsset({ ...media, modifiedAt: 201 }, [job]), []),
    "Not checked",
  );
  assert.equal(
    statusLabel(
      deviceAsset(
        {
          ...media,
          copies: { public: { state: "not-found", checkedAt: 500 } },
        },
        [],
      ),
      [],
    ),
    "No matching known upload",
  );
  assert.equal(
    statusLabel(
      deviceAsset(
        { ...media, copies: { public: { state: "missing", checkedAt: 500 } } },
        [],
      ),
      [],
    ),
    "Cloud copy missing",
  );
  assert.equal(
    matchesStatus(
      deviceAsset(
        { ...media, copies: { public: { state: "missing", checkedAt: 500 } } },
        [],
      ),
      "failed",
      [],
    ),
    true,
  );
  assert.equal(
    matchesStatus(
      deviceAsset(
        { ...media, copies: { public: { state: "missing", checkedAt: 500 } } },
        [],
      ),
      "cloud",
      [],
    ),
    false,
  );
});
test("private and public cloud objects keep separate identities and private objects never acquire public URLs", () => {
  const object = {
    key: "encrypted/photos/a.atlasenc",
    size: 100,
    modifiedAt: "2026-11-19",
    etag: "x",
  };
  const privateAsset = cloudAsset(object, "private", "https://media.example", [
    { ...job, slot: "private", key: object.key },
  ]);
  assert.equal(privateAsset.url, undefined);
  assert.equal(privateAsset.name, "photo.jpg");
  assert.equal(privateAsset.kind, "photo");
  assert.notEqual(
    privateAsset.id,
    cloudAsset(object, "public", "https://media.example", []).id,
  );
});
test("assignment and favorite metadata survive reopen; assignments remain trip and file-version specific", async () => {
  const a = await savePastTrip({
      title: "Trip A",
      destination: "Lake",
      startDate: "",
      endDate: "",
    }),
    b = await savePastTrip({
      title: "Trip B",
      destination: "Temple",
      startDate: "",
      endDate: "",
    });
  const aa = (await addTripPlace(a.id, "The lake")).websitePlaces![0];
  await assignGalleryMedia([
    {
      deviceId: media.id,
      sourceStamp: mediaStamp(media),
      tripId: a.id,
      placeId: aa.id,
    },
  ]);
  await assignGalleryMedia([
    {
      deviceId: media.id,
      sourceStamp: mediaStamp(media),
      tripId: a.id,
      placeId: aa.id,
    },
  ]);
  const records = await galleryAssignments();
  assert.equal(records.filter((r) => r.deviceId === media.id).length, 1);
  assert.equal(
    assetAssignments(deviceAsset(media, []), records, [
      { ...a, websitePlaces: [aa] },
      b,
    ]).length,
    1,
  );
  assert.equal(
    assetAssignments(deviceAsset({ ...media, modifiedAt: 999 }, []), records, [
      a,
      b,
    ]).length,
    0,
  );
  await saveGalleryPreference("favorites", [media.id]);
  assert.deepEqual(await readGalleryPreference("favorites", []), [media.id]);
});
test("cloud storage or a publication manifest alone is not proof that the website trip was published", async () => {
  const trip = await savePastTrip({
    title: "A",
    destination: "",
    startDate: "",
    endDate: "",
  });
  const item = {
    id: "published-photo",
    key: job.key,
    url: "https://media.example/a.jpg",
  } as PublishedMedia;
  const prepared = {
    ...trip,
    publishedSlug: "a",
    websitePlaces: [
      {
        id: "place",
        name: "Lake",
        files: [],
        transferIds: {},
        publishedMedia: [item],
      },
    ],
  };
  const asset = deviceAsset(media, [job]);
  assert.equal(publishedAsset(asset, [prepared]), false);
  assert.equal(
    publishedAsset(asset, [
      { ...prepared, websitePublishedMediaIds: [item.id] },
    ]),
    true,
  );
  assert.equal(
    statusLabel(asset, [{ ...prepared, websitePublishedMediaIds: [item.id] }]),
    "Published on website",
  );
  assert.equal(assetAssignments(asset, [], [prepared])[0].placeId, "place");
});

test("bucket changes never reuse another bucket’s status or cached object identity", () => {
  const summary = {
    public: {
      slot: "public",
      configured: true,
      storageScope: "new-bucket",
      revision: "new",
    },
    private: { slot: "private", configured: false },
  } as import("../../src/lib/r2/types").StorageSummary;
  assert.equal(
    currentBucketTransfers(
      [{ ...job, storageScope: "old-bucket", revision: "old" }],
      summary,
    ).length,
    0,
  );
  assert.equal(
    currentBucketTransfers(
      [{ ...job, storageScope: "new-bucket", revision: "rotated" }],
      summary,
    ).length,
    1,
  );
  assert.equal(
    currentBucketTransfers([{ ...job, revision: "old" }], summary).length,
    0,
  );
  const object = {
    key: job.key,
    size: 100,
    modifiedAt: "2026-11-19",
    etag: "x",
  };
  const previous = cloudAsset(object, "public", "https://old.example", [job], {
    slot: "public",
    configured: true,
    storageScope: "old",
    revision: "old",
  });
  const current = cloudAsset(
    object,
    "public",
    "https://new.example",
    [job],
    summary.public,
  );
  assert.notEqual(previous.id, current.id);
  assert.equal(current.transfer, undefined);
  assert.notEqual(current.name, job.name);
});
test("masonry layout stays deterministic and bounded for thousands of media records", async () => {
  const { galleryLayout } = await import("../../src/lib/gallery/layout");
  const assets = Array.from({ length: 5000 }, (_, i) => ({
    ...deviceAsset(media, []),
    id: String(i),
  }));
  const a = galleryLayout(assets, 390, 3, 6),
    b = galleryLayout(assets, 390, 3, 6);
  assert.deepEqual(a, b);
  assert.ok(a.height > 10000);
  assert.equal(a.placements.length, 5000);
  assert.ok(
    a.placements.every(
      (p) => p.x >= 0 && p.x + p.width <= 390.01 && p.height > 0,
    ),
  );
  const visible = a.placements.filter(
    (p) => p.y + p.height >= 2000 - 600 && p.y <= 2000 + 844 + 600,
  );
  assert.ok(visible.length < 100);
});

test("MediaStore generation catches same-size changes within one timestamp second", () => {
  const before = { ...media, generation: 1 },
    after = { ...media, generation: 2 };
  assert.notEqual(mediaStamp(before), mediaStamp(after));
  assert.equal(
    statusLabel(
      deviceAsset(after, [{ ...job, sourceStamp: mediaStamp(before) }]),
      [],
    ),
    "Not checked",
  );
});

test("failed cloud checks are distinct from never checked files", () => {
  const asset = deviceAsset(
    { ...media, copies: { public: { state: "unavailable", checkedAt: 300 } } },
    [],
  );
  assert.equal(statusLabel(asset, []), "Cloud check unavailable");
  assert.equal(matchesStatus(asset, "unchecked", []), false);
});
