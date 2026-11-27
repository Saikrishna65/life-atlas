import { test } from "node:test";
import assert from "node:assert/strict";
import { createLibraryCache } from "../../src/lib/music/library-cache";
import { createPlaybackClock } from "../../src/lib/music/playback-clock";
import type { MusicTrack } from "../../src/lib/music/types";
const track = { id: "one", title: "Original", addedAt: 1, audioBlob: new Blob(["untouched original bytes"]) } as MusicTrack;

test("library readers share one scan and cannot mutate each other's cached rows", async () => {
  const cache = createLibraryCache();
  let reads = 0;
  const load = async () => { reads++; return [track]; };
  try {
    const results = await Promise.all(Array.from({ length: 8 }, () => cache.read(load)));
    assert.equal(reads, 1);
    results[0][0].title = "Edited outside storage";
    results[0].pop();
    const warm = await cache.read(load);
    assert.equal(warm[0].title, "Original");
    assert.equal(reads, 1);
    assert.equal(await warm[0].audioBlob?.text(), "untouched original bytes");
    assert.equal(warm[0].audioBlob, track.audioBlob, "Immutable blobs need no second JS copy");
  } finally { cache.invalidate(); }
});
test("a write during a pending scan cannot restore stale cache contents", async () => {
  const cache = createLibraryCache();
  let release!: (rows: MusicTrack[]) => void;
  let reads = 0;
  const load = () => ++reads === 1
    ? new Promise<MusicTrack[]>((resolve) => { release = resolve; })
    : Promise.resolve([{ ...track, title: "Updated" }]);
  try {
    const pending = cache.read(load);
    cache.invalidate();
    release([track]);
    assert.equal((await pending)[0].title, "Updated");
    assert.equal(cache.peek()?.[0].title, "Updated");
    assert.equal(reads, 2);
  } finally { cache.invalidate(); }
});
test("expired caches and failed scans do not retain stale data or block retry", async () => {
  const cache = createLibraryCache(1);
  await cache.read(async () => [track]);
  await new Promise((resolve) => setTimeout(resolve, 8));
  assert.equal(cache.peek(), undefined);
  await assert.rejects(cache.read(async () => { throw Error("Storage unavailable"); }));
  assert.equal((await cache.read(async () => [{ ...track, title: "Recovered" }]))[0].title, "Recovered");
  cache.invalidate();
});
test("playback clock notifies only progress subscribers and removes listeners", () => {
  const clock = createPlaybackClock();
  let changes = 0;
  const unsubscribe = clock.subscribe(() => { changes++; });
  clock.set(1); clock.set(1); clock.set(2);
  assert.equal(changes, 2);
  assert.equal(clock.getSnapshot(), 2);
  unsubscribe(); clock.set(3);
  assert.equal(changes, 2);
  clock.set(Number.NaN);
  assert.equal(clock.getSnapshot(), 0);
});
