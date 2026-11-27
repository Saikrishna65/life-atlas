/** One page-lifetime snapshot. Explicit writes/resume invalidate it; never stored outside memory. */
export class FinanceReadCache<T> {
  private value: Promise<T> | null = null;
  get(load: () => Promise<T>): Promise<T> {
    if (!this.value) {
      const pending = Promise.resolve()
        .then(load)
        .catch((error) => {
          if (this.value === pending) this.value = null;
          throw error;
        });
      this.value = pending;
    }
    return this.value;
  }
  invalidate() {
    this.value = null;
  }
}
