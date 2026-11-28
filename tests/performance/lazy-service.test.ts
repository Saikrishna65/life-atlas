import { test } from "node:test";
import assert from "node:assert/strict";
import { lazyService } from "../../src/lib/performance/lazy-service";
const tick = () => new Promise(resolve => setImmediate(resolve));
test("disabled engines never load; enabling deduplicates loads and disabling disposes", async () => {
  let enabled = false, loads = 0, starts = 0, stops = 0;
  const service = lazyService(() => enabled, async () => { loads++; return () => { starts++; return () => { stops++; }; }; });
  service.refresh(); await tick(); assert.equal(loads, 0);
  enabled = true; for(let i=0;i<100;i++)service.refresh(); await tick();
  assert.equal(loads, 1); assert.equal(starts, 1);
  enabled = false; service.refresh(); assert.equal(stops, 1);
  enabled = true; service.refresh(); await tick(); assert.equal(starts, 2);
  service.dispose(); service.refresh(); assert.equal(stops, 2);
});
test("late imports cannot start disabled or unmounted engines and failed imports can retry", async () => {
  let resolve!: (start: () => () => void) => void, starts = 0;
  const service = lazyService(() => true, () => new Promise(r => { resolve = r; }));
  service.refresh(); service.dispose(); resolve(() => { starts++; return () => {}; }); await tick(); assert.equal(starts, 0);
  let calls = 0;
  const retry = lazyService(() => true, async () => { if (++calls === 1) throw Error("offline"); return () => { starts++; return () => {}; }; });
  retry.refresh(); await tick(); retry.refresh(); await tick(); assert.equal(starts, 1); retry.dispose();
});
