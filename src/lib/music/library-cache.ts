import type { MusicTrack } from "./types";

/** Short-lived session cache; original blobs remain immutable, never copied into JS buffers. */
export function createLibraryCache(ttl = 30_000) {
  let generation = 0;
  let snapshot: MusicTrack[] | undefined;
  let expires = 0;
  let pending: { generation: number; promise: Promise<MusicTrack[]> } | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  function invalidate() {
    generation++;
    snapshot = undefined;
    pending = undefined;
    if (timer) clearTimeout(timer);
    timer = undefined;
  }
  function peek() {
    return snapshot && Date.now() < expires ? snapshot.map((track) => ({ ...track })) : undefined;
  }
  async function read(load: () => Promise<MusicTrack[]>): Promise<MusicTrack[]> {
    if (snapshot && Date.now() >= expires) invalidate();
    const cached = peek();
    if (cached) return cached;
    const revision = generation;
    if (!pending) pending = { generation: revision, promise: load() };
    const request = pending;
    try {
      const tracks = await request.promise;
      if (revision !== generation) return read(load);
      if (!snapshot) {
        snapshot = tracks.map((track) => ({ ...track }));
        expires = Date.now() + ttl;
        timer = setTimeout(invalidate, ttl);
        // Node tests should not be held open by a browser session cache.
        (timer as unknown as { unref?: () => void }).unref?.();
      }
      return snapshot.map((track) => ({ ...track }));
    } finally {
      if (pending === request) pending = undefined;
    }
  }
  return { read, peek, invalidate };
}
