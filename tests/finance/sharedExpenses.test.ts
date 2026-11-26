import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { test, beforeEach, afterEach } from "node:test";
import {
  allocate,
  balances,
  checkSettlement,
  suggestions,
  validateGroup,
  type SharedGroup,
} from "@/lib/finance/shared/domain";
import {
  listSharedGroups,
  saveSharedGroup,
} from "@/lib/finance/shared/service";
import {
  deleteFinanceDB,
  closeFinanceDB,
  getFinanceDB,
} from "@/lib/finance/storage/indexeddb/database";
import {
  FINANCE_DB_NAME,
  migrateToV1,
  migrateToV2,
  migrateToV3,
  migrateToV4,
} from "@/lib/finance/storage/indexeddb/migrations";
import { setControlRestoreActive } from "@/lib/control-room/maintenance";
const now = "2026-11-26T10:00:00.000Z";
function group(): SharedGroup {
  return {
    schemaVersion: 1,
    id: "group",
    title: "Weekend away",
    currency: "INR",
    selfId: "me",
    members: [
      { id: "me", name: "You" },
      { id: "a", name: "Aarav" },
      { id: "m", name: "Maya" },
    ],
    expenses: [],
    settlements: [],
    createdAt: now,
    updatedAt: now,
    version: 1,
  };
}
function expense(g: SharedGroup, total = 10000) {
  g.expenses.push({
    id: "dinner",
    title: "Dinner",
    payerId: "me",
    amountPaise: total,
    shares: allocate(total, ["me", "a", "m"], "equal"),
    splitMode: "equal",
    weights: [],
    date: "2026-11-26",
    createdAt: now,
  });
  return g;
}
beforeEach(async () => {
  await deleteFinanceDB();
  setControlRestoreActive(false);
});
afterEach(async () => {
  setControlRestoreActive(false);
  await deleteFinanceDB();
});
test("equal splits allocate every paise deterministically, even a one-paise bill", () => {
  assert.deepEqual(
    allocate(100, ["me", "a", "m"], "equal").map((s) => s.amountPaise),
    [34, 33, 33],
  );
  assert.deepEqual(
    allocate(1, ["me", "a", "m"], "equal").map((s) => s.amountPaise),
    [1, 0, 0],
  );
});
test("exact and percentage splits preserve totals without floating-point multiplication", () => {
  assert.deepEqual(
    allocate(10001, ["me", "a"], "exact", [9999, 2]).map((s) => s.amountPaise),
    [9999, 2],
  );
  assert.deepEqual(
    allocate(100, ["me", "a", "m"], "percentage", [3333, 3333, 3334]).map(
      (s) => s.amountPaise,
    ),
    [33, 33, 34],
  );
  const shares = allocate(
    Number.MAX_SAFE_INTEGER,
    ["me", "a", "m"],
    "percentage",
    [1250, 2250, 6500],
  );
  assert.equal(
    shares.reduce((s, v) => s + BigInt(v.amountPaise), BigInt(0)),
    BigInt(Number.MAX_SAFE_INTEGER),
  );
});
test("bad totals, duplicate participants, malformed weights and unsupported modes are rejected", () => {
  for (const total of [0, -1, 1.1, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])
    assert.throws(() => allocate(total, ["a"], "equal"));
  assert.throws(() => allocate(100, [], "equal"));
  assert.throws(() => allocate(100, ["a", "a"], "equal"));
  assert.throws(() => allocate(100, ["a"], "exact", [99]));
  assert.throws(() => allocate(100, ["a"], "exact", [-1]));
  assert.throws(() => allocate(100, ["a"], "percentage", [9999]));
  assert.throws(() => allocate(100, ["a"], "percentage", []));
  assert.throws(() => allocate(100, ["a"], "other" as "equal"));
});
test("multiple payers and excluded payers reconcile; suggestions settle every balance", () => {
  const g = expense(group(), 9000);
  g.expenses.push({
    ...g.expenses[0],
    id: "taxi",
    payerId: "a",
    amountPaise: 2000,
    shares: allocate(2000, ["me", "m"], "equal"),
  });
  assert.deepEqual(balances(g), { me: 5000, a: -1000, m: -4000 });
  for (const p of suggestions(g)) {
    checkSettlement(g, p, true);
    g.settlements.push({
      ...p,
      id: `s${g.settlements.length}`,
      date: "2026-11-26",
      note: "",
      createdAt: now,
    });
  }
  assert.deepEqual(balances(g), { me: 0, a: 0, m: 0 });
  validateGroup(g);
});
test("partial repayments and explicit overpayments are supported, without silently accepting mistakes", () => {
  const g = expense(group(), 9000),
    p = { fromId: "a", toId: "me", amountPaise: 1000 };
  assert.throws(() => checkSettlement(g, p, false));
  checkSettlement(g, p, true);
  g.settlements.push({
    ...p,
    id: "partial",
    date: "2026-11-26",
    note: "",
    createdAt: now,
  });
  assert.equal(balances(g).a, -2000);
  assert.equal(balances(g).me, 5000);
  assert.throws(() => checkSettlement(g, { ...p, amountPaise: 3000 }, true));
  checkSettlement(g, { ...p, amountPaise: 3000 }, true, true);
  assert.throws(() => checkSettlement(g, { ...p, toId: "a" }, true, true));
});
test("cancelling an expense keeps actual payments and reveals any refund owed", () => {
  const g = expense(group(), 9000);
  g.settlements.push({
    id: "paid",
    fromId: "a",
    toId: "me",
    amountPaise: 3000,
    date: "2026-11-26",
    note: "",
    createdAt: now,
  });
  g.expenses[0].voidedAt = now;
  assert.deepEqual(balances(g), { me: -3000, a: 3000, m: 0 });
  g.settlements[0].voidedAt = now;
  assert.deepEqual(balances(g), { me: 0, a: 0, m: 0 });
  validateGroup(g);
});
test("restore validation rejects broken relationships, corrupted splits and duplicate IDs", () => {
  const original = expense(group());
  validateGroup(original);
  const cases: ((g: SharedGroup) => void)[] = [
    (g) => {
      g.members.pop();
    },
    (g) => {
      g.expenses[0].shares[0].amountPaise++;
    },
    (g) => {
      g.expenses.push(g.expenses[0]);
    },
    (g) => {
      g.currency = "JPY";
    },
    (g) => {
      g.selfId = "missing";
    },
    (g) => {
      g.members.push(g.members[0]);
    },
    (g) => {
      g.expenses[0].date = "no";
    },
    (g) => {
      g.version = 0;
    },
    (g) => {
      g.expenses[0].payerId = "missing";
    },
  ];
  for (const mutate of cases) {
    const g = structuredClone(original);
    mutate(g);
    assert.throws(() => validateGroup(g));
  }
});
test("group writes persist with audit receipts and never change bank records or sync outbox", async () => {
  const saved = await saveSharedGroup("group", 0, () => expense(group()));
  assert.equal(saved.version, 1);
  await closeFinanceDB();
  assert.equal((await listSharedGroups())[0].expenses[0].title, "Dinner");
  const db = await getFinanceDB();
  const counts = await Promise.all(
    ["accounts", "transactions", "sync_outbox", "audit_log"].map(
      (store) =>
        new Promise<number>((resolve, reject) => {
          const r = db.transaction(store).objectStore(store).count();
          r.onsuccess = () => resolve(r.result);
          r.onerror = () => reject(r.error);
        }),
    ),
  );
  assert.deepEqual(counts, [0, 0, 0, 1]);
});
test("concurrent edits cannot overwrite each other and failed validation rolls back audit too", async () => {
  await saveSharedGroup("group", 0, () => group());
  const updates = await Promise.allSettled([
    saveSharedGroup("group", 1, (g) => ({ ...g!, title: "One" })),
    saveSharedGroup("group", 1, (g) => ({ ...g!, title: "Two" })),
  ]);
  assert.equal(updates.filter((r) => r.status === "fulfilled").length, 1);
  assert.match(
    String(
      (updates.find((r) => r.status === "rejected") as PromiseRejectedResult)
        .reason,
    ),
    /changed/,
  );
  await assert.rejects(
    saveSharedGroup("group", 2, (g) => ({ ...g!, title: "" })),
  );
  assert.equal((await listSharedGroups())[0].version, 2);
  await assert.rejects(
    saveSharedGroup("group", 2, (g) => ({ ...g!, currency: "USD" })),
    /cannot change/,
  );
  const db = await getFinanceDB();
  assert.equal(
    await new Promise((resolve) => {
      const r = db.transaction("audit_log").objectStore("audit_log").count();
      r.onsuccess = () => resolve(r.result);
    }),
    2,
  );
});
test("restores block writes without deleting local groups", async () => {
  await saveSharedGroup("group", 0, () => group());
  setControlRestoreActive(true);
  await assert.rejects(
    saveSharedGroup("group", 1, (g) => g!),
    /restore/,
  );
  assert.equal((await listSharedGroups()).length, 1);
});
test("upgrading a real V4 database preserves its records and creates the empty shared store", async () => {
  const old = await new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open(FINANCE_DB_NAME, 4);
    r.onupgradeneeded = () => {
      migrateToV1(r.result, r.transaction!);
      migrateToV2(r.result, r.transaction!);
      migrateToV3(r.result, r.transaction!);
      migrateToV4(r.result, r.transaction!);
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
  await new Promise<void>((resolve) => {
    const tx = old.transaction("settings", "readwrite");
    tx.objectStore("settings").put({ key: "existing", value: "preserved" });
    tx.oncomplete = () => resolve();
  });
  old.close();
  const db = await getFinanceDB();
  assert.equal(db.version, 5);
  assert.deepEqual(await listSharedGroups(), []);
  assert.deepEqual(
    await new Promise((resolve) => {
      const r = db
        .transaction("settings")
        .objectStore("settings")
        .get("existing");
      r.onsuccess = () => resolve(r.result);
    }),
    { key: "existing", value: "preserved" },
  );
});

test("calendar dates and irrelevant equal-split weights cannot enter backups", () => {
  const g = expense(group());
  g.expenses[0].date = "2026-02-31";
  assert.throws(() => validateGroup(g), /calendar date/);
  g.expenses[0].date = "2026-11-26";
  g.expenses[0].weights = [1];
  assert.throws(() => validateGroup(g), /custom weights/);
});
test("expense edits retain their before and after values in the atomic audit receipt", async () => {
  await saveSharedGroup("group", 0, () => expense(group()));
  await saveSharedGroup("group", 1, (g) => {
    g!.expenses[0].title = "Corrected dinner";
    return g!;
  });
  const db = await getFinanceDB();
  const rows = await new Promise<
    {
      changes: Record<
        string,
        { oldVal: { title?: string }; newVal: { title?: string } }
      >;
    }[]
  >((resolve) => {
    const r = db.transaction("audit_log").objectStore("audit_log").getAll();
    r.onsuccess = () => resolve(r.result);
  });
  const receipt = rows.find(
    (r) => r.changes["expenses:dinner"]?.newVal?.title === "Corrected dinner",
  );
  assert.equal(receipt?.changes["expenses:dinner"].oldVal.title, "Dinner");
  assert.equal(
    receipt?.changes["expenses:dinner"].newVal.title,
    "Corrected dinner",
  );
});
test(
  "blocked cross-tab notifications cannot turn a successful save into a stuck operation",
  { timeout: 2000 },
  async () => {
    const oldWindow = Object.getOwnPropertyDescriptor(globalThis, "window"),
      oldChannel = Object.getOwnPropertyDescriptor(
        globalThis,
        "BroadcastChannel",
      );
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: new EventTarget(),
    });
    Object.defineProperty(globalThis, "BroadcastChannel", {
      configurable: true,
      value: class {
        constructor() {
          throw new Error("Disabled by browser");
        }
      },
    });
    try {
      const saved = await saveSharedGroup("group", 0, () => group());
      assert.equal(saved.version, 1);
      assert.equal((await listSharedGroups()).length, 1);
    } finally {
      if (oldWindow) Object.defineProperty(globalThis, "window", oldWindow);
      else Reflect.deleteProperty(globalThis, "window");
      if (oldChannel)
        Object.defineProperty(globalThis, "BroadcastChannel", oldChannel);
      else Reflect.deleteProperty(globalThis, "BroadcastChannel");
    }
  },
);
