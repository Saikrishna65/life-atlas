import { installMobileNetwork } from './network';
import { installNativeDownloads } from './downloads';
import { ensureCleanStart } from '../src/lib/cloud-vault/clean-start';
async function start() {
  await ensureCleanStart();
  // No old hosted cache or remote music library can refill the clean local databases.
  if ('serviceWorker' in navigator) for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
  if ('caches' in window) for (const key of await caches.keys()) await caches.delete(key);
  if (!location.pathname.startsWith('/secret')) history.replaceState({}, '', '/secret');
  installMobileNetwork();
  installNativeDownloads();
  const { flushStudioEntries } = await import('./studio-storage');
  window.addEventListener('online', () => { void flushStudioEntries(); });
  window.addEventListener('atlas-cloud-restored', () => { void flushStudioEntries(); });
  void flushStudioEntries();
  await import('./App');
}
start().catch(error => {
  document.body.textContent = `Atlas could not initialize storage: ${error.message}. Close and reopen the app to retry.`;
});
