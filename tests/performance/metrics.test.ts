import { test } from "node:test";
import assert from "node:assert/strict";
import {
  LocalPerformanceMetrics,
  type MetricName,
  measureOperation,
  localPerformance,
} from "../../src/lib/performance/metrics";
import { FrameIntervals } from "../../src/lib/performance/frame-sample";
test("local performance aggregates accept only fixed numeric metrics and retain no media content", () => {
  const data = new LocalPerformanceMetrics();
  data.record("search-local", 12);
  data.record("search-local", 20, true);
  data.record("private-photo.jpg" as MetricName, 30);
  data.record("navigation", NaN);
  data.gauge("gallery-mounted", 40);
  const snapshot = data.snapshot();
  assert.deepEqual(Object.keys(snapshot.metrics), ["search-local"]);
  assert.equal(snapshot.metrics["search-local"].averageMs, 16);
  assert.equal(snapshot.metrics["search-local"].failed, 1);
  assert.equal(snapshot.gauges["gallery-mounted"], 40);
  assert.ok(!JSON.stringify(snapshot).includes("private-photo"));
  data.clear();
  assert.deepEqual(data.snapshot().metrics, {});
  assert.deepEqual(data.snapshot().gauges, {});
});
test("measurement preserves successful return values and original failures", async () => {
  localPerformance.clear();
  assert.equal(await measureOperation("collection", async () => 7), 7);
  const failure = new Error("Synthetic sensitive detail");
  await assert.rejects(
    measureOperation("collection", async () => {
      throw failure;
    }),
    (error) => error === failure,
  );
  const snapshot = localPerformance.snapshot();
  assert.equal(snapshot.metrics.collection.count, 2);
  assert.equal(snapshot.metrics.collection.failed, 1);
  assert.ok(!JSON.stringify(snapshot).includes(failure.message));
});
test("frame samples report actual intervals without assuming a refresh rate", () => {
  const frames = new FrameIntervals();
  for (const at of [0, 8, 16, 56, 64]) frames.add(at);
  const sample = frames.snapshot();
  assert.equal(sample.intervals, 4);
  assert.equal(sample.over32ms, 1);
  assert.equal(sample.longestMs, 40);
  assert.equal(sample.averageMs, 16);
  assert.equal(sample.durationMs, 64);
  frames.add(NaN);
  frames.add(63);
  assert.deepEqual(frames.snapshot(), sample);
});

test("screen readiness ignores superseded navigation and records a committed screen only once", async () => {
  const { beginAppStartup, beginNavigation, finishScreen, navigationToken } =
    await import("../../src/lib/performance/metrics");
  localPerformance.clear();
  beginAppStartup();
  const old = beginNavigation();
  const current = beginNavigation();
  assert.equal(navigationToken(), current);
  finishScreen(old);
  assert.deepEqual(localPerformance.snapshot().metrics, {});
  finishScreen(current);
  finishScreen(current);
  const values = localPerformance.snapshot().metrics;
  assert.equal(values.navigation.count, 1);
  assert.equal(values["app-first-screen"].count, 1);
});

test("explicit frame sampling stops and releases callbacks when the app is hidden", async () => {
  const { sampleFrames } = await import(
    "../../src/lib/performance/frame-sample"
  );
  const previous = {
    raf: globalThis.requestAnimationFrame,
    cancel: globalThis.cancelAnimationFrame,
    document: globalThis.document,
  };
  const document = Object.assign(new EventTarget(), { hidden: false });
  const frames = new Map<number, FrameRequestCallback>();
  let sequence = 0;
  globalThis.document = document as unknown as Document;
  globalThis.requestAnimationFrame = (callback) => {
    const id = ++sequence;
    frames.set(id, callback);
    return id;
  };
  globalThis.cancelAnimationFrame = (id) => {
    frames.delete(id);
  };
  const reports: unknown[] = [];
  let stop: (() => void) | undefined;
  try {
    stop = sampleFrames((value) => reports.push(value));
    for (const time of [16, 64]) {
      const [id, callback] = [...frames][0];
      frames.delete(id);
      callback(time);
    }
    document.hidden = true;
    document.dispatchEvent(new Event("visibilitychange"));
    assert.equal(frames.size, 0);
    assert.deepEqual(reports, [
      {
        intervals: 1,
        over32ms: 1,
        averageMs: 48,
        longestMs: 48,
        durationMs: 48,
        reason: "hidden",
      },
    ]);
    stop();
    assert.equal(reports.length, 1);
  } finally {
    stop?.();
    globalThis.requestAnimationFrame = previous.raf;
    globalThis.cancelAnimationFrame = previous.cancel;
    globalThis.document = previous.document;
  }
});
