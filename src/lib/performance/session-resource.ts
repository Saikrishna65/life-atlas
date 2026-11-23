/** One session-only value/read shared by consumers. No persistence or background polling. */
export class SessionResource<T> {
  private state: { value: T; ready: boolean; error: string | null };
  private readonly empty;
  private listeners = new Set<() => void>();
  private revision = 0;
  private epoch = 0;
  private pending?: Promise<void>;
  constructor(
    private readonly load: () => Promise<T>,
    initial: T,
    private readonly message: string,
  ) {
    this.state = this.empty = { value: initial, ready: false, error: null };
  }
  snapshot = () => this.state;
  serverSnapshot = () => this.empty;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private publish(value: typeof this.state) {
    this.state = value;
    for (const listener of this.listeners) listener();
  }
  invalidate = () => {
    this.revision++;
  };
  clear = () => {
    this.revision++;
    this.epoch++;
    this.pending = undefined;
    this.publish(this.empty);
  };
  refresh = (): Promise<void> => {
    if (this.pending) return this.pending;
    const epoch = this.epoch;
    const task = (async () => {
      // A change during a read requires a fresh read, never a stale publish.
      for (;;) {
        const version = this.revision;
        try {
          const value = await this.load();
          if (epoch !== this.epoch) return;
          if (version !== this.revision) continue;
          this.publish({ value, ready: true, error: null });
        } catch {
          if (epoch !== this.epoch) return;
          if (version !== this.revision) continue;
          this.publish({ ...this.state, ready: true, error: this.message });
        }
        return;
      }
    })().finally(() => {
      if (this.pending === task) this.pending = undefined;
    });
    this.pending = task;
    return task;
  };
}
