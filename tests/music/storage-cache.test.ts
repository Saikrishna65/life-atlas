import "fake-indexeddb/auto";
import { IDBObjectStore } from "fake-indexeddb";
import { test } from "node:test";
import assert from "node:assert/strict";
import { saveTrack, getAllTracks, closeMusicDB, deleteMusicDB } from "../../src/lib/music/storage";
import type { MusicTrack } from "../../src/lib/music/types";

test("committed song writes invalidate the warm library, preserving exact audio", async () => {
  await deleteMusicDB();
  const original = IDBObjectStore.prototype.getAll;
  let scans = 0;
  IDBObjectStore.prototype.getAll = function (...args: Parameters<typeof original>) { scans++; return original.apply(this, args); };
  try {
    const song = { id: "cache-song", title: "Before", addedAt: 1, audioBlob: new Blob(["original recording"]) } as MusicTrack;
    await saveTrack(song);
    await Promise.all(Array.from({ length: 6 }, () => getAllTracks()));
    await getAllTracks();
    assert.equal(scans, 1, "Seven readers use a single database scan");
    await saveTrack({ ...song, title: "After" });
    const updated = await getAllTracks();
    assert.equal(scans, 2);
    assert.equal(updated[0].title, "After");
    assert.equal(await updated[0].audioBlob?.text(), "original recording");
    closeMusicDB();
    await getAllTracks();
    assert.equal(scans, 3, "Reopening does not reuse a closed database snapshot");
  } finally {
    IDBObjectStore.prototype.getAll = original;
    closeMusicDB();
    await deleteMusicDB();
  }
});
