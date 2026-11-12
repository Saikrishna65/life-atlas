import test from "node:test";
import assert from "node:assert/strict";
import { publishedRoute, validPoint } from "../../src/lib/public-trips/route";
test("missing GPS never becomes a fabricated line or measurement", () => {
  const r = publishedRoute(null);
  assert.deepEqual(r.paths, []);
  assert.equal(r.maxSpeed, null);
  assert.equal(r.elapsed, null);
  assert.equal(validPoint({ latitude: 91, longitude: 0 }), false);
});
test("published samples preserve winding GPS geometry and segment gaps", () => {
  const points = [
    { latitude: 30, longitude: 79, altitude: 2000, speed: 4 },
    { latitude: 30.01, longitude: 79.02, altitude: 2100, speed: 6 },
    { latitude: 30.02, longitude: 79.01, altitude: null, speed: null },
  ];
  const r = publishedRoute({
    totalDistanceKm: 4,
    movingSeconds: 3600,
    totalDurationSeconds: 4000,
    legs: [
      { coordinates: points, maxSpeedKmh: 7 },
      { coordinates: [...points, { latitude: 999, longitude: 79 }, ...points] },
    ],
  });
  assert.equal(r.paths.length, 3);
  assert.deepEqual(r.paths[0], points);
  assert.equal(r.maxAltitude, 2100);
  assert.equal(r.maxSpeed, 7);
  assert.equal(r.averageSpeed, 4);
  assert.equal(r.elapsed, 4000);
});
