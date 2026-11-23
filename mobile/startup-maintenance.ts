const CLEANUP_KEY = "atlas-hosted-cache-cleanup-v1";

export async function cleanupHostedCaches() {
  // Only obsolete hosted-shell caches belong to this migration. Never delete
  // gallery thumbnail caches, IndexedDB, credentials, or ordinary user storage.
  try {
    if (localStorage.getItem(CLEANUP_KEY)) return;
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(
        registrations
          .filter((r) => {
            const worker = r.active || r.waiting || r.installing;
            return (
              worker &&
              new URL(worker.scriptURL).origin === location.origin &&
              new URL(worker.scriptURL).pathname === "/sw.js"
            );
          })
          .map((r) => r.unregister()),
      );
    }
    localStorage.setItem(CLEANUP_KEY, "done");
  } catch {
    /* Retry migration next launch; local screens remain usable. */
  }
}

export function scheduleStartupMaintenance() {
  let flush: (() => Promise<unknown>) | undefined;
  const retry = () => {
    void flush?.().catch(() => {});
  };
  // Register event listeners immediately; one delayed flush also covers events
  // received while its optional module is loading.
  window.addEventListener("online", retry);
  window.addEventListener("atlas-cloud-restored", retry);
  setTimeout(() => {
    void cleanupHostedCaches();
    void import("./studio-storage")
      .then((module) => {
        flush = module.flushStudioEntries;
        retry();
      })
      .catch(() => {});
  }, 2000);
}
