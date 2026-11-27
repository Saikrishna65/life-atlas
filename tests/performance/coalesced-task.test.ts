import { test } from "node:test";
import assert from "node:assert/strict";
import { coalescedTask } from "../../src/lib/performance/coalesced-task";
const tick = () => new Promise(resolve => setTimeout(resolve, 15));
test("bursts share one refresh and changes during it trigger one subsequent refresh", async () => {
  let calls = 0, finish: () => void = () => {};
  const task = coalescedTask(async () => { calls++; if (calls === 1) await new Promise<void>(resolve => { finish = resolve; }); }, 0);
  for (let i = 0; i < 100; i++) task.schedule();
  await tick(); assert.equal(calls, 1);
  for (let i = 0; i < 100; i++) task.schedule();
  await tick(); assert.equal(calls, 1);
  finish(); await tick(); assert.equal(calls, 2); task.dispose();
});
test("disposal cancels scheduled work and prevents trailing refreshes", async () => {
  let calls = 0;
  const task = coalescedTask(async () => { calls++; }, 0);
  task.schedule(); task.dispose(); task.schedule(); await tick(); assert.equal(calls, 0);
});
