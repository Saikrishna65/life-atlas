/** One bounded queue for thumbnail I/O. It never retains completed private URLs. */
interface Consumer<T> {
  needed: () => boolean;
  resolve: (value: T) => void;
  reject: (reason: Error) => void;
}
interface Request<T> {
  key: string;
  priority: number;
  work: () => Promise<T>;
  consumers: Consumer<T>[];
}
const cancelled = () =>
  new DOMException("Media no longer visible", "AbortError");
export class MediaRequestQueue {
  private active = 0;
  private scheduled = false;
  private waiting: Request<unknown>[] = [];
  private requests = new Map<string, Request<unknown>>();
  constructor(private readonly concurrency = 3) {
    if (!Number.isInteger(concurrency) || concurrency < 1)
      throw new Error("Invalid concurrency");
  }
  run<T>(
    key: string,
    needed: () => boolean,
    work: () => Promise<T>,
    priority = 1,
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      let request = this.requests.get(key) as Request<T> | undefined;
      if (!request) {
        request = { key, work, priority, consumers: [] };
        this.requests.set(key, request as Request<unknown>);
        this.waiting.push(request as Request<unknown>);
      }
      request.priority = Math.min(request.priority, priority);
      request.consumers.push({ needed, resolve, reject });
      if (!this.scheduled) {
        this.scheduled = true;
        queueMicrotask(() => {
          this.scheduled = false;
          this.pump();
        });
      }
    });
  }
  private pump() {
    this.waiting.sort((a, b) => a.priority - b.priority);
    while (this.active < this.concurrency && this.waiting.length) {
      const request = this.waiting.shift()!;
      request.consumers = request.consumers.filter((consumer) => {
        if (consumer.needed()) return true;
        consumer.reject(cancelled());
        return false;
      });
      if (!request.consumers.length) {
        this.requests.delete(request.key);
        continue;
      }
      this.active++;
      void Promise.resolve()
        .then(request.work)
        .then(
          (value) => {
            this.requests.delete(request.key);
            request.consumers.forEach((c) =>
              c.needed() ? c.resolve(value) : c.reject(cancelled()),
            );
          },
          (error) => {
            this.requests.delete(request.key);
            request.consumers.forEach((c) => c.reject(error));
          },
        )
        .finally(() => {
          this.active--;
          this.pump();
        });
    }
  }
}
export const galleryMediaRequests = new MediaRequestQueue(3);

/** Match native size buckets so nearby layout measurements share the same work. */
export function thumbnailPixels(pixels: number) {
  const edge = Math.max(
    256,
    Math.min(2560, Number.isFinite(pixels) ? pixels : 768),
  );
  return [256, 384, 512, 768, 1024, 1280, 1920, 2560].find(
    (value) => value >= edge,
  )!;
}
