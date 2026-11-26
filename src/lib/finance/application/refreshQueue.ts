/** One in-flight refresh, one latest follow-up; a burst in the same turn performs a single read. */
export class FinanceRefreshQueue {
  private next: (() => Promise<void>) | null = null;
  private running: Promise<void> | null = null;
  request(task: () => Promise<void>): Promise<void> {
    this.next = task;
    if (!this.running)
      this.running = Promise.resolve().then(async () => {
        try {
          while (this.next) {
            const current = this.next;
            this.next = null;
            await current();
          }
        } finally {
          this.running = null;
        }
      });
    return this.running;
  }
}
