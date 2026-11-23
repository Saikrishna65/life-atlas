import { test } from "node:test";
import assert from "node:assert/strict";
import { SessionResource } from "../../src/lib/performance/session-resource";
function gate<T>() {
  let release!: (value: T) => void;
  return {
    promise: new Promise<T>((resolve) => {
      release = resolve;
    }),
    resolve: (value: T) => release(value),
  };
}
test("multiple screens share one local read and retain content while refreshing", async () => {
  let calls = 0;
  let read = gate<number>();
  const resource = new SessionResource(
    () => {
      calls++;
      return read.promise;
    },
    0,
    "Read failed",
  );
  assert.equal(resource.snapshot().ready, false);
  const first = resource.refresh();
  assert.equal(resource.refresh(), first);
  assert.equal(calls, 1);
  read.resolve(4);
  await first;
  assert.equal(resource.snapshot().value, 4);
  read = gate<number>();
  const next = resource.refresh();
  assert.equal(resource.snapshot().ready, true);
  assert.equal(resource.snapshot().value, 4);
  read.resolve(5);
  await next;
  assert.equal(resource.snapshot().value, 5);
  assert.equal(calls, 2);
});
test("a mutation while reading never publishes stale data and causes one fresh read", async () => {
  const old = gate<number>();
  let calls = 0;
  const resource = new SessionResource(
    () => (++calls === 1 ? old.promise : Promise.resolve(8)),
    0,
    "Read failed",
  );
  const seen: number[] = [];
  const detach = resource.subscribe(() => seen.push(resource.snapshot().value));
  const pending = resource.refresh();
  resource.invalidate();
  assert.equal(resource.refresh(), pending);
  old.resolve(2);
  await pending;
  assert.deepEqual(seen, [8]);
  assert.equal(calls, 2);
  detach();
});
test("failed refresh preserves cached local content and exposes a safe fixed message", async () => {
  let fail = false;
  const resource = new SessionResource(
    async () => {
      if (fail) throw Error("sensitive body");
      return 7;
    },
    0,
    "Read failed",
  );
  await resource.refresh();
  fail = true;
  await resource.refresh();
  assert.equal(resource.snapshot().value, 7);
  assert.equal(resource.snapshot().error, "Read failed");
});
test("cleared sessions cannot be repopulated by an old read or erase a newer pending read", async () => {
  const old = gate<number>(),
    next = gate<number>();
  let calls = 0;
  const resource = new SessionResource(
    () => (++calls === 1 ? old.promise : next.promise),
    0,
    "Read failed",
  );
  const first = resource.refresh();
  resource.clear();
  const second = resource.refresh();
  old.resolve(99);
  await first;
  assert.equal(resource.snapshot().ready, false);
  assert.equal(resource.refresh(), second);
  next.resolve(3);
  await second;
  assert.equal(resource.snapshot().value, 3);
});
