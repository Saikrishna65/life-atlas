/** Progress changes must not rerender library rows, queues or the app shell. */
export function createPlaybackClock() {
  let seconds = 0;
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => seconds,
    getServerSnapshot: () => 0,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    set(value: number) {
      const next = Number.isFinite(value) ? Math.max(0, value) : 0;
      if (next === seconds) return;
      seconds = next;
      listeners.forEach((listener) => listener());
    },
  };
}
