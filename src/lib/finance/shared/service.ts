import { getFinanceDB } from "../storage/indexeddb/database";
import { isControlRestoreActive } from "../../control-room/maintenance";
import { authorize } from "../../security/authentication";
import type { FieldChange } from "../domain/models";
import { ensure, validateGroup, type SharedGroup } from "./domain";

export async function listSharedGroups(): Promise<SharedGroup[]> {
  const db = await getFinanceDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("shared_groups", "readonly");
    const request = tx.objectStore("shared_groups").getAll();
    tx.oncomplete = () =>
      resolve(
        (request.result as SharedGroup[]).sort((a, b) =>
          b.updatedAt.localeCompare(a.updatedAt),
        ),
      );
    tx.onabort = () =>
      reject(tx.error || new Error("Could not read shared expenses."));
  });
}
function changedFields(
  previous: SharedGroup | undefined,
  next: SharedGroup,
): Record<string, FieldChange> {
  const changes: Record<string, FieldChange> = {
    version: { oldVal: previous?.version || 0, newVal: next.version },
  };
  for (const field of [
    "title",
    "members",
    "tripId",
    "tripTitle",
    "currency",
  ] as const) {
    if (JSON.stringify(previous?.[field]) !== JSON.stringify(next[field]))
      changes[field] = {
        oldVal: previous?.[field] ?? null,
        newVal: next[field] ?? null,
      };
  }
  for (const field of ["expenses", "settlements"] as const) {
    const old = new Map(
      previous?.[field].map((record) => [record.id, record]) || [],
    );
    for (const record of next[field])
      if (JSON.stringify(old.get(record.id)) !== JSON.stringify(record))
        changes[`${field}:${record.id}`] = {
          oldVal: old.get(record.id) || null,
          newVal: record,
        };
  }
  return changes;
}
/** One group and its audit receipt commit together. Bank accounts and transactions are never written. */
export async function saveSharedGroup(
  id: string,
  expectedVersion: number,
  change: (current: SharedGroup | undefined) => SharedGroup,
  destructive = false,
): Promise<SharedGroup> {
  if (destructive) await authorize("deletion");
  ensure(
    !isControlRestoreActive(),
    "A restore is in progress. Try again when it finishes.",
  );
  const db = await getFinanceDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(["shared_groups", "audit_log"], "readwrite");
    const store = tx.objectStore("shared_groups");
    let result: SharedGroup;
    let failure: unknown;
    const request = store.get(id);
    request.onsuccess = () => {
      try {
        ensure(!isControlRestoreActive(), "A restore is in progress.");
        const current = request.result as SharedGroup | undefined;
        ensure(
          (current?.version || 0) === expectedVersion,
          "This group changed in another screen. Close this form and reopen it to use the latest balances.",
        );
        result = change(current ? structuredClone(current) : undefined);
        ensure(result.id === id, "The group identifier cannot change.");
        if (current)
          ensure(
            result.currency === current.currency &&
              result.selfId === current.selfId &&
              result.createdAt === current.createdAt,
            "Group currency and identity cannot change.",
          );
        result.version = expectedVersion + 1;
        result.updatedAt = new Date().toISOString();
        for (const record of current?.expenses || []) if (record.sourceTransactionId) {
          ensure(JSON.stringify(record) === JSON.stringify(result.expenses.find(e => e.id === record.id)), "Edit this linked payment in Atlas Finance. Its split follows the original payment.");
        }
        for (const record of result.expenses) if (record.sourceTransactionId) ensure(current?.expenses.some(e => e.id === record.id && e.sourceTransactionId === record.sourceTransactionId), "Link bank payments from Atlas Finance.");
        validateGroup(result);
        store.put(result);
        tx.objectStore("audit_log").put({
          id: crypto.randomUUID(),
          entityType: "shared_group",
          entityId: id,
          action: destructive ? "reverse" : current ? "update" : "create",
          changes: changedFields(current, result),
          performedAt: result.updatedAt,
        });
      } catch (error) {
        failure = error;
        tx.abort();
      }
    };
    tx.oncomplete = () => {
      // Notification support is optional. A committed write must still resolve if it is blocked.
      try {
        if (typeof window !== "undefined")
          window.dispatchEvent(new Event("finance-shared-updated"));
        if (
          typeof window !== "undefined" &&
          typeof BroadcastChannel !== "undefined"
        ) {
          const channel = new BroadcastChannel("atlas-shared-expenses");
          try {
            channel.postMessage(id);
          } finally {
            channel.close();
          }
        }
      } catch {
        /* The next visible-page refresh reads the committed group. */
      }
      resolve(result);
    };
    tx.onabort = () =>
      reject(
        failure ||
          tx.error ||
          new Error(
            "Could not save shared expenses. Your previous records are unchanged.",
          ),
      );
  });
}
