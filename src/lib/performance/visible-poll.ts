/** No overlapping reads, no timers while hidden, immediate refresh on return. */
export function visiblePoll(work: () => Promise<unknown>, interval: number, visibility: Pick<Document, "hidden" | "addEventListener" | "removeEventListener"> = document) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let active = true, running = false;
  const schedule = (delay: number) => {
    clearTimeout(timer);
    if (active && !visibility.hidden && !running) timer = setTimeout(run, delay);
  };
  const run = () => {
    timer = undefined;
    if (!active || visibility.hidden || running) return;
    running = true;
    void Promise.resolve().then(work).catch(() => {}).finally(() => {
      running = false;
      schedule(interval);
    });
  };
  const changed = () => schedule(0);
  visibility.addEventListener("visibilitychange", changed);
  schedule(interval);
  return () => { active = false; clearTimeout(timer); visibility.removeEventListener("visibilitychange", changed); };
}
