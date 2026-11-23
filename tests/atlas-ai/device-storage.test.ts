import { test } from "node:test";
import assert from "node:assert/strict";
import {
  AtlasStore,
  type DeviceAssistantBackend,
  type AtlasData,
} from "../../src/lib/atlas-ai/storage";
function backend() {
  let record: { revision: number; data?: AtlasData } = { revision: 0 };
  const device: DeviceAssistantBackend = {
    openAssistant: async () => structuredClone(record),
    saveAssistant: async (input) => {
      if (input.revision !== record.revision) throw Error("ASSISTANT_CHANGED");
      record = {
        revision: record.revision + 1,
        data: structuredClone(input.data),
      };
      return structuredClone(record) as { revision: number; data: AtlasData };
    },
  };
  return device;
}
test("device-secured Atlas opens and persists without a phrase, PIN or JS encryption key", async () => {
  const device = backend(),
    store = new AtlasStore();
  await store.openDevice(device);
  const id = await store.create("A local conversation");
  await store.append(id, { role: "user", text: "Remember the lake" });
  await store.saveMemory("Travel light");
  store.lock();
  await store.openDevice(device);
  assert.equal(store.history(id).messages[0].text, "Remember the lake");
  assert.equal(store.memories()[0].text, "Travel light");
  await assert.rejects(store.exportArchive(), /Backup & recovery/);
});
test("a stale writer and a late unlock cannot overwrite or resurrect assistant state", async () => {
  const device = backend(),
    a = new AtlasStore(),
    b = new AtlasStore();
  await a.openDevice(device);
  await b.openDevice(device);
  await a.create("Keep this");
  await assert.rejects(b.create("Stale change"), /CHANGED/);
  const reopened = new AtlasStore();
  await reopened.openDevice(device);
  assert.equal(reopened.sessions().length, 1);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const pending = reopened.openDevice({
    ...device,
    openAssistant: async () => {
      await gate;
      return device.openAssistant();
    },
  });
  reopened.lock();
  release();
  await assert.rejects(pending, /closed/);
  assert.throws(() => reopened.snapshot());
});
test("recovering a valid archive merges copies and invalid recovery never changes the vault", async () => {
  const store = new AtlasStore();
  await store.openDevice(backend());
  const id = await store.create("Keep original");
  const recovered = store.snapshot();
  await store.mergeRecovered(recovered);
  assert.equal(store.sessions().length, 2);
  assert.ok(store.sessions().some((c) => c.id === id));
  assert.equal(new Set(store.sessions().map((c) => c.id)).size, 2);
  const before = store.snapshot();
  const invalid = { ...recovered, version: 99 } as unknown as AtlasData;
  assert.throws(() => store.mergeRecovered(invalid));
  assert.deepEqual(store.snapshot(), before);
});
