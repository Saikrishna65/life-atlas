import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MediaRequestQueue,
  thumbnailPixels,
} from "../../src/lib/gallery/media-requests";
const tick = () => new Promise((resolve) => setImmediate(resolve));

test("thumbnail work shares in-flight requests and never retains completed private results", async () => {
  const queue = new MediaRequestQueue(2);
  let calls = 0;
  const work = async () => {
    calls++;
    await tick();
    return "temporary-private-url";
  };
  const a = queue.run("session:a", () => true, work);
  const b = queue.run("session:a", () => true, work);
  assert.deepEqual(await Promise.all([a, b]), [
    "temporary-private-url",
    "temporary-private-url",
  ]);
  assert.equal(calls, 1);
  assert.equal(
    await queue.run("session:a", () => true, work),
    "temporary-private-url",
  );
  assert.equal(calls, 2);
});

test("visible thumbnails get priority and cancelled offscreen work is skipped", async () => {
  const queue = new MediaRequestQueue(1),
    started: string[] = [];
  const work = (name: string) => async () => {
    started.push(name);
    return name;
  };
  const near = queue.run("near", () => true, work("near"), 1);
  const gone = queue
    .run("gone", () => false, work("gone"), 0)
    .catch((error) => error.name);
  const visible = queue.run("visible", () => true, work("visible"), 0);
  assert.equal(await gone, "AbortError");
  assert.deepEqual(await Promise.all([near, visible]), ["near", "visible"]);
  assert.deepEqual(started, ["visible", "near"]);
});

test("cancelling one subscriber does not cancel another and concurrency stays bounded", async () => {
  const queue = new MediaRequestQueue(2);
  let live = true,
    active = 0,
    peak = 0;
  const work = async () => {
    active++;
    peak = Math.max(peak, active);
    await tick();
    active--;
    return 7;
  };
  const a = queue.run("shared", () => live, work).catch((error) => error.name);
  const b = queue.run("shared", () => true, work);
  const others = Array.from({ length: 15 }, (_, i) =>
    queue.run("other:" + i, () => true, work),
  );
  live = false;
  assert.equal(await a, "AbortError");
  assert.equal(await b, 7);
  await Promise.all(others);
  assert.equal(peak, 2);
});

test("a failed native request releases its slot and can retry immediately", async () => {
  const queue = new MediaRequestQueue(1);
  await assert.rejects(
    queue.run(
      "file",
      () => true,
      async () => {
        throw new Error("Native read failed");
      },
    ),
  );
  assert.equal(
    await queue.run(
      "file",
      () => true,
      async () => 9,
    ),
    9,
  );
});

test("nearby thumbnail measurements share physical pixel buckets", () => {
  assert.equal(thumbnailPixels(300), 384);
  assert.equal(thumbnailPixels(330), 384);
  assert.equal(thumbnailPixels(99999), 2560);
  assert.equal(thumbnailPixels(-1), 256);
  assert.equal(thumbnailPixels(NaN), 768);
});
test('gesture pressure defers speculation while visible requests continue', async()=>{
 const queue=new MediaRequestQueue(2),started:string[]=[];
 queue.setDeferPrefetch(true);
 const near=queue.run('near',()=>true,async()=>{started.push('near');return 1;},1);
 const visible=queue.run('visible',()=>true,async()=>{started.push('visible');return 2;},0);
 assert.equal(await visible,2);assert.deepEqual(started,['visible']);
 queue.setDeferPrefetch(false);assert.equal(await near,1);assert.deepEqual(started,['visible','near']);
});
test('a hidden Gallery suspends all new decoding and safely discards cancelled work',async()=>{
 const queue=new MediaRequestQueue(2);queue.setSuspended(true);
 let live=true,started=false;
 const task=queue.run('private',()=>live,async()=>{started=true;return 'private-path';},0).catch(error=>error.name);
 await tick();assert.equal(started,false);live=false;queue.setSuspended(false);assert.equal(await task,'AbortError');assert.equal(started,false);
});
test('an offscreen request promoted into view can start during ongoing gestures',async()=>{
 const queue=new MediaRequestQueue(1);queue.setDeferPrefetch(true);let calls=0;
 const work=async()=>++calls;
 const near=queue.run('image',()=>true,work,1);const visible=queue.run('image',()=>true,work,0);
 assert.deepEqual(await Promise.all([near,visible]),[1,1]);assert.equal(calls,1);
});

test("cancelled visible consumers cannot promote remaining speculative work during gestures", async () => {
  const queue = new MediaRequestQueue(1);
  queue.setDeferPrefetch(true);
  let visible = true, calls = 0;
  const a = queue.run("shared", () => visible, async () => ++calls, 0).catch(e => e.name);
  const b = queue.run("shared", () => true, async () => ++calls, 1);
  visible = false;
  await tick();
  assert.equal(await a, "AbortError");
  assert.equal(calls, 0);
  queue.setDeferPrefetch(false);
  assert.equal(await b, 1);
});
