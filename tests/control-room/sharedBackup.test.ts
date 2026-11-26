import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { test, beforeEach, afterEach } from "node:test";
import {
  saveSharedGroup,
  listSharedGroups,
} from "@/lib/finance/shared/service";
import type { SharedGroup } from "@/lib/finance/shared/domain";
import { snapshotVault } from "@/lib/control-room/local";
import {
  validateBackup,
  previewRestore,
  restoreBackup,
  encryptPayload,
  decryptArchive,
  type BackupPayload,
} from "@/lib/control-room/backup";
import { deleteFinanceDB } from "@/lib/finance/storage/indexeddb/database";
Object.defineProperty(globalThis, "window", {
  configurable: true,
  value: new EventTarget(),
});
const now = new Date().toISOString();
const group: SharedGroup = {
  schemaVersion: 1,
  id: "backup-group",
  title: "Shared dinner",
  currency: "INR",
  selfId: "me",
  members: [
    { id: "me", name: "You" },
    { id: "friend", name: "Friend" },
  ],
  expenses: [
    {
      id: "e",
      title: "Dinner",
      payerId: "me",
      amountPaise: 10000,
      splitMode: "equal",
      weights: [],
      shares: [
        { memberId: "me", amountPaise: 5000 },
        { memberId: "friend", amountPaise: 5000 },
      ],
      date: "2026-11-26",
      createdAt: now,
    },
  ],
  settlements: [],
  createdAt: now,
  updatedAt: now,
  version: 1,
};
const payload = async (): Promise<BackupPayload> => ({
  format: "life-atlas-v1",
  createdAt: now,
  media: false,
  vaults: [await snapshotVault("finance")],
});
beforeEach(async () => {
  await deleteFinanceDB();
});
afterEach(async () => {
  await deleteFinanceDB();
});
test("shared groups round-trip through encrypted Finance backups and restore as independent records", async () => {
  await saveSharedGroup(group.id, 0, () => group);
  const p = await payload();
  await validateBackup(p);
  const restored = await decryptArchive(
    await encryptPayload(p, "synthetic-backup-key"),
    "synthetic-backup-key",
  );
  assert.deepEqual(
    restored.vaults[0].stores.find((s) => s.name === "shared_groups")?.rows[0]
      .value,
    (await listSharedGroups())[0],
  );
  const plan = await previewRestore(restored);
  await restoreBackup(plan.payload, "synthetic-backup-key", plan.fingerprint);
  assert.equal((await listSharedGroups())[0].expenses[0].amountPaise, 10000);
});
test("complete V4 backups remain restorable; preview does not delete existing shared groups", async () => {
  await saveSharedGroup(group.id, 0, () => group);
  const p = await payload();
  p.vaults[0].version = 4;
  p.vaults[0].stores = p.vaults[0].stores.filter(
    (s) => s.name !== "shared_groups",
  );
  const before = structuredClone(p);
  await validateBackup(p);
  const plan = await previewRestore(p);
  assert.deepEqual(p, before);
  assert.equal((await listSharedGroups()).length, 1);
  assert.equal(plan.payload.vaults[0].version, 5);
  await validateBackup(plan.payload);
  await restoreBackup(plan.payload, "synthetic-backup-key", plan.fingerprint);
  assert.deepEqual(await listSharedGroups(), []);
});
test("current backups must contain the new store; legacy backups cannot replace another required store with it", async () => {
  const p = await payload(),
    noGroups = structuredClone(p);
  noGroups.vaults[0].stores = noGroups.vaults[0].stores.filter(
    (s) => s.name !== "shared_groups",
  );
  await assert.rejects(validateBackup(noGroups), /incomplete/);
  const invalidLegacy = structuredClone(p);
  invalidLegacy.vaults[0].version = 4;
  invalidLegacy.vaults[0].stores = invalidLegacy.vaults[0].stores.filter(
    (s) => s.name !== "settings",
  );
  await assert.rejects(validateBackup(invalidLegacy), /Invalid store/);
});
test("backup preview rejects a tampered share without writing any records", async () => {
  await saveSharedGroup(group.id, 0, () => group);
  const p = await payload();
  (
    p.vaults[0].stores.find((s) => s.name === "shared_groups")!.rows[0]
      .value as SharedGroup
  ).expenses[0].shares[0].amountPaise++;
  await assert.rejects(previewRestore(p), /reconcile/);
  assert.equal(
    (await listSharedGroups())[0].expenses[0].shares[0].amountPaise,
    5000,
  );
});
