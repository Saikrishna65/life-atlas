import { test } from "node:test";
import assert from "node:assert/strict";
import { visiblePoll } from "../../src/lib/performance/visible-poll";
const tick = () => new Promise(resolve => setTimeout(resolve, 20));
test("polling pauses while hidden, avoids overlapping reads and stops on disposal", async () => {
  class Visibility extends EventTarget { hidden = true; }
  const visibility = new Visibility();
  let calls = 0, finish: () => void = () => {};
  const stop = visiblePoll(async () => { calls++; await new Promise<void>(resolve => { finish = resolve; }); }, 2, visibility);
  await tick(); assert.equal(calls, 0);
  visibility.hidden = false; visibility.dispatchEvent(new Event("visibilitychange"));
  await tick(); assert.equal(calls, 1);
  await tick(); assert.equal(calls, 1);
  visibility.hidden = true; visibility.dispatchEvent(new Event("visibilitychange")); finish();
  await tick(); assert.equal(calls, 1);
  visibility.hidden = false; visibility.dispatchEvent(new Event("visibilitychange"));
  await tick(); assert.equal(calls, 2);
  stop(); finish(); await tick(); assert.equal(calls, 2);
});
