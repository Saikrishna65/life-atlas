import type { DevicePage } from "./types";
/** Metadata only. Bound memory, retain native cursors, and invalidate on media changes. */
export class GalleryPageCache {
  private pages = new Map<string, { page: DevicePage; revision: number }>();
  get(key: string, revision: number) {
    const value = this.pages.get(key);
    if (!value) return;
    if (value.revision !== revision) {
      this.pages.delete(key);
      return;
    }
    this.pages.delete(key);
    this.pages.set(key, value);
    return value.page;
  }
  put(key: string, page: DevicePage, revision: number) {
    this.pages.delete(key);
    if (page.items.length > 6000) return;
    this.pages.set(key, { page, revision });
    let count = [...this.pages.values()].reduce(
      (n, value) => n + value.page.items.length,
      0,
    );
    while (this.pages.size > 6 || count > 6000) {
      const oldest = this.pages.keys().next().value!;
      count -= this.pages.get(oldest)!.page.items.length;
      this.pages.delete(oldest);
    }
  }
}
