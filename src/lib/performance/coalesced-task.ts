/** Collapse event bursts while retaining one follow-up for changes during a run. */
export function coalescedTask(work: () => Promise<void>, delay = 120) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let running = false, pending = false, disposed = false;
  const schedule = () => {
    if (disposed) return;
    pending = true;
    if (running || timer) return;
    timer = setTimeout(() => {
      timer = undefined;
      if (disposed) return;
      pending = false; running = true;
      void Promise.resolve().then(work).catch(() => {}).finally(() => {
        running = false;
        if (pending && !disposed) schedule();
      });
    }, delay);
  };
  return { schedule, dispose() { disposed = true; pending = false; clearTimeout(timer); } };
}
