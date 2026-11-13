import test from "node:test";
import assert from "node:assert/strict";
import { heroHandoffAt, HERO_DISSOLVE_MS } from "../../src/components/home/hero-playback";

test("automatic handoffs leave moving footage throughout the dissolve", () => {
  for (const duration of [4, 6, 10, 15, 37]) {
    const handoff = heroHandoffAt(duration);
    assert.ok(handoff > 0);
    assert.ok(handoff + HERO_DISSOLVE_MS / 1000 < Math.min(duration, 10));
  }
});
test("unknown or invalid metadata yields a finite bounded handoff", () => {
  for (const duration of [NaN, Infinity, 0, -4]) {
    assert.ok(Number.isFinite(heroHandoffAt(duration)));
    assert.ok(heroHandoffAt(duration) > 0 && heroHandoffAt(duration) < 10);
  }
});
