import { test } from "node:test";
import assert from "node:assert/strict";
import { indexedDB, IDBObjectStore } from "fake-indexeddb";
import {
  getMusicDB,
  getMusicLibrarySummary,
  getTrack,
} from "../../src/lib/music/storage";

test("dashboard counts use cursor reads, return no media blobs and preserve original records", async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "indexedDB");
  Object.defineProperty(globalThis, "indexedDB", {
    configurable: true,
    value: indexedDB,
  });
  const originalGetAll = IDBObjectStore.prototype.getAll;
  try {
    const db = await getMusicDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("tracks", "readwrite"),
        store = tx.objectStore("tracks");
      store.clear();
      store.put({
        id: "one",
        isFavorite: true,
        audioBlob: new Blob(["original audio"]),
      });
      store.put({ id: "two", isFavorite: false, audioBlob: new Blob([]) });
      store.put({ id: "three", isFavorite: true });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    IDBObjectStore.prototype.getAll = function () {
      throw new Error("Dashboard must not materialize all tracks");
    };
    const summary = await getMusicLibrarySummary();
    assert.deepEqual(summary, { total: 3, favorites: 2, offline: 1 });
    assert.equal(
      await (await getTrack("one"))?.audioBlob?.text(),
      "original audio",
    );
  } finally {
    IDBObjectStore.prototype.getAll = originalGetAll;
    if (previous) Object.defineProperty(globalThis, "indexedDB", previous);
    else Reflect.deleteProperty(globalThis, "indexedDB");
  }
});
