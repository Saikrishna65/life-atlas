import { Capacitor, registerPlugin } from '@capacitor/core';
import { installMobileNetwork } from './network';
const RESET_VERSION = 'atlas-clean-offline-2026-11-01-v1';
async function start() {
  // Runs before application imports open any connections, once for this clean test build.
  if (localStorage.getItem('atlas_clean_build') !== RESET_VERSION) {
    for (const name of ['life_atlas_finance_db','life_atlas_finance_demo_v2','life_atlas_trip_vault_db','life_atlas_music_db','life_atlas_studio_db','life_atlas_control_room']) {
      await new Promise<void>((resolve,reject) => { const r = indexedDB.deleteDatabase(name); r.onsuccess = () => resolve(); r.onerror = () => reject(r.error); r.onblocked = () => reject(new Error('Close other Atlas windows to finish the clean reset.')); });
    }
    for (const key of Object.keys(localStorage)) if (/^(life_atlas|lifeatlas|atlas_|pending_youtube|music_)/.test(key)) localStorage.removeItem(key);
    sessionStorage.clear();
    if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('KotakNotificationTracker')) {
      const plugin = registerPlugin<{clearTrackingData: () => Promise<unknown>}>('KotakNotificationTracker');
      await plugin.clearTrackingData();
    }
    localStorage.setItem('atlas_clean_build', RESET_VERSION);
  }
  // No old hosted cache or remote music library can refill the clean local databases.
  if ('serviceWorker' in navigator) for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
  if ('caches' in window) for (const key of await caches.keys()) await caches.delete(key);
  if (!location.pathname.startsWith('/secret')) history.replaceState({}, '', '/secret');
  installMobileNetwork();
  const { flushStudioEntries } = await import('./studio-storage');
  window.addEventListener('online', () => { void flushStudioEntries(); });
  void flushStudioEntries();
  await import('./App');
}
start().catch(error => {
  document.body.textContent = `Atlas could not initialize storage: ${error.message}. Close and reopen the app to retry.`;
});
