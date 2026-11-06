/** Display policy only; never grants data or native-action authorization. */
export function canShowAtlasLauncher(path: string, blocked = false, keyboard = false) {
  return !blocked && !keyboard && /^\/secret(?:\/|$)/.test(path) && !/^\/secret\/(?:atlas|unlock|lock|auth|security)(?:\/|$)/.test(path);
}
