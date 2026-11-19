import type { GalleryAssignment } from "./types";
function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open("life_atlas_gallery", 2);
    r.onupgradeneeded = () => {
      if (!r.result.objectStoreNames.contains("assignments"))
        r.result.createObjectStore("assignments", { keyPath: "id" });
      if (!r.result.objectStoreNames.contains("preferences"))
        r.result.createObjectStore("preferences", { keyPath: "id" });
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
export async function galleryAssignments(): Promise<GalleryAssignment[]> {
  const db = await open();
  try {
    return await new Promise((resolve, reject) => {
      const r = db
        .transaction("assignments")
        .objectStore("assignments")
        .getAll();
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  } finally {
    db.close();
  }
}
export async function assignGalleryMedia(
  records: Omit<GalleryAssignment, "id" | "createdAt">[],
) {
  const db = await open();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("assignments", "readwrite");
      for (const record of records)
        tx.objectStore("assignments").put({
          ...record,
          id: `${record.deviceId}|${record.sourceStamp}|${record.tripId}|${record.placeId}`,
          createdAt: new Date().toISOString(),
        });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export async function readGalleryPreference<T>(
  id: string,
  fallback: T,
): Promise<T> {
  const db = await open();
  try {
    return await new Promise((resolve, reject) => {
      const r = db
        .transaction("preferences")
        .objectStore("preferences")
        .get(id);
      r.onsuccess = () => resolve(r.result?.value ?? fallback);
      r.onerror = () => reject(r.error);
    });
  } finally {
    db.close();
  }
}
export async function saveGalleryPreference(id: string, value: unknown) {
  const db = await open();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("preferences", "readwrite");
      tx.objectStore("preferences").put({ id, value });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
