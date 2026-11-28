/** Keep optional engines out of startup and dispose them when disabled/unmounted. */
export function lazyService(enabled: () => boolean, load: () => Promise<() => () => void>) {
  let disposed = false, loading = false, stop: (() => void) | undefined;
  const refresh = () => {
    if (disposed) return;
    if (!enabled()) { stop?.(); stop = undefined; return; }
    if (stop || loading) return;
    loading = true;
    void load().then(start => {
      if (!disposed && enabled() && !stop) stop = start();
    }).catch(() => {}).finally(() => { loading = false; });
  };
  return { refresh, dispose() { disposed = true; stop?.(); stop = undefined; } };
}
