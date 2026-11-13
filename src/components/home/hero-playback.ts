/** Start dissolving before the outgoing clip stops moving. Shared with browser checks. */
export const HERO_DISSOLVE_MS = 1400;
export const HERO_RELEASE_MS = HERO_DISSOLVE_MS + 100;
export const HERO_CLIP_SECONDS = 10;
export const HERO_PRELOAD_AT_SECONDS = 1.5;
export function heroHandoffAt(duration: number) {
  const end = Math.min(
    Number.isFinite(duration) && duration > 0 ? duration : HERO_CLIP_SECONDS,
    HERO_CLIP_SECONDS,
  );
  return Math.max(end * 0.55, end - HERO_DISSOLVE_MS / 1000 - 0.35);
}
