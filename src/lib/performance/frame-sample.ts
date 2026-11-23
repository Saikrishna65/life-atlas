export interface FrameSample {
  intervals: number;
  over32ms: number;
  averageMs: number;
  longestMs: number;
  durationMs: number;
  reason: "finished" | "hidden" | "cancelled";
}
export class FrameIntervals {
  private last: number | undefined;
  private first: number | undefined;
  private count = 0;
  private slow = 0;
  private total = 0;
  private longest = 0;
  add(at: number) {
    if (!Number.isFinite(at)) return;
    if (this.last === undefined) {
      this.last = at;
      this.first = at;
      return;
    }
    const ms = at - this.last;
    if (ms <= 0) return;
    this.last = at;
    this.count++;
    this.total += ms;
    this.longest = Math.max(this.longest, ms);
    if (ms > 32) this.slow++;
  }
  snapshot(reason: FrameSample["reason"] = "finished"): FrameSample {
    return {
      intervals: this.count,
      over32ms: this.slow,
      averageMs: this.count ? this.total / this.count : 0,
      longestMs: this.longest,
      durationMs: (this.last ?? 0) - (this.first ?? 0),
      reason,
    };
  }
}
/** Explicit, short sample. No ongoing animation loop or observer is installed by default. */
export function sampleFrames(
  done: (sample: FrameSample) => void,
  duration = 10000,
) {
  const intervals = new FrameIntervals();
  let frame = 0,
    ended = false;
  const stop = (reason: FrameSample["reason"]) => {
    if (ended) return;
    ended = true;
    cancelAnimationFrame(frame);
    clearTimeout(timer);
    document.removeEventListener("visibilitychange", visibility);
    done(intervals.snapshot(reason));
  };
  const tick = (at: number) => {
    if (ended) return;
    intervals.add(at);
    frame = requestAnimationFrame(tick);
  };
  const visibility = () => {
    if (document.hidden) stop("hidden");
  };
  const timer = setTimeout(
    () => stop("finished"),
    Math.min(10000, Math.max(100, duration)),
  );
  document.addEventListener("visibilitychange", visibility);
  if (document.hidden) stop("hidden");
  else frame = requestAnimationFrame(tick);
  return () => stop("cancelled");
}
