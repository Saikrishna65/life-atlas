import test from "node:test";
import assert from "node:assert/strict";
import { expeditions } from "../../src/data/demo/expeditions";
import {
  detailedDays,
  sampleJourneyRoute,
} from "../../src/data/demo/journey-details";
import { publishedRoute, validPoint } from "../../src/lib/public-trips/route";
test("each sample has deterministic, explicitly illustrative winding route geometry", () => {
  for (const e of expeditions) {
    const sample = sampleJourneyRoute(e);
    assert.equal(sample.illustrative, true);
    const paths = publishedRoute(sample).paths;
    assert.ok(paths.length > 0);
    assert.ok(paths.flat().length > 30);
    assert.ok(paths.flat().every(validPoint));
    assert.deepEqual(sample, sampleJourneyRoute(e));
  }
});
test("each itinerary day includes a coherent detailed schedule and overnight plan", () => {
  for (const e of expeditions) {
    const days = detailedDays(e);
    assert.equal(days.length, e.itinerary.length);
    for (const day of days) {
      assert.equal(day.beats.length, 5);
      assert.equal(new Set(day.beats.map((b) => b.time)).size, 5);
      assert.ok(day.beats.every((b) => b.description.length > 40));
      assert.ok(day.overnight);
    }
  }
});
