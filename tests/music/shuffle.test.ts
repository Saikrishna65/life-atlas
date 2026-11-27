import { test } from "node:test";
import assert from "node:assert/strict";
import { shuffledCopy } from "../../src/lib/music/shuffle";
test("shuffle uses n-1 draws, preserves every track and leaves library order unchanged", () => {
  const items = Array.from({length: 10000}, (_, id) => ({ id }));
  let calls = 0;
  const result = shuffledCopy(items, () => { calls++; return .5; });
  assert.equal(calls, 9999);
  assert.equal(new Set(result).size, items.length);
  assert.ok(result.every(item => items[item.id] === item));
  assert.deepEqual(items.map(item => item.id), Array.from({length:10000}, (_,i)=>i));
  assert.deepEqual(shuffledCopy([]), []);
});
