import assert from "node:assert/strict";
import test from "node:test";
import { reusableLoad } from "../../mobile/route-prefetch";
import { cleanupHostedCaches } from "../../mobile/startup-maintenance";

test("intent prefetch shares a load and retries a failed request", async () => {
  let calls = 0;
  const load = reusableLoad(async () => {
    if (++calls === 1) throw new Error("Unavailable");
    return { default: "screen" };
  });
  await assert.rejects(load());
  const first = load();
  assert.equal(load(), first);
  assert.deepEqual(await first, { default: "screen" });
  assert.equal(calls, 2);
});

test("hosted worker migration is one-time and preserves user caches and other workers", async () => {
  const originals = new Map(
    ["localStorage", "navigator", "location", "caches"].map((key) => [
      key,
      Object.getOwnPropertyDescriptor(globalThis, key),
    ]),
  );
  const records = new Map<string, string>();
  const removed: string[] = [];
  let scans = 0;
  try {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => records.get(key),
        setItem: (key: string, value: string) => records.set(key, value),
      },
    });
    Object.defineProperty(globalThis, "location", {
      configurable: true,
      value: { origin: "https://localhost" },
    });
    Object.defineProperty(globalThis, "caches", {
      configurable: true,
      value: {
        delete: () => {
          throw new Error("Must preserve cached media");
        },
      },
    });
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: {
        serviceWorker: {
          getRegistrations: async () => {
            scans++;
            return [
              "/sw.js",
              "/other-worker.js",
              "https://other.example/sw.js",
            ].map((path) => ({
              active: { scriptURL: new URL(path, "https://localhost").href },
              unregister: async () => {
                removed.push(path);
              },
            }));
          },
        },
      },
    });
    await cleanupHostedCaches();
    await cleanupHostedCaches();
    assert.equal(scans, 1);
    assert.deepEqual(removed, ["/sw.js"]);
  } finally {
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
