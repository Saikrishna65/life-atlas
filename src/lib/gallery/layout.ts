import type { GalleryAsset } from "./types";
export interface GalleryPlacement {
  index: number;
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface GalleryDateHeading {
  key: string;
  label: string;
  y: number;
  indices: number[];
}
export function galleryDay(timestamp: number) {
  const d = new Date(timestamp);
  return Number.isFinite(d.getTime())
    ? `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
    : "unknown";
}
/** Justified photo rows. Date headers share the same coordinates as the virtualized tiles. */
export function galleryLayout(
  items: GalleryAsset[],
  width: number,
  columns: number,
  gap: number,
  groupDates = false,
) {
  const usable = Math.max(1, width),
    count = Math.max(2, Math.min(6, columns)),
    target = usable / count,
    placements: GalleryPlacement[] = [],
    headers: GalleryDateHeading[] = [];
  let y = 0,
    start = 0;
  const ratio = (i: number) => {
    const d = items[i].device;
    return d?.width && d.height
      ? Math.max(0.55, Math.min(2.1, d.width / d.height))
      : 1;
  };
  while (start < items.length) {
    let end = start + 1;
    const day = galleryDay(items[start].date);
    if (groupDates)
      while (end < items.length && galleryDay(items[end].date) === day) end++;
    else end = items.length;
    if (groupDates) {
      if (start) y += 22;
      const date = new Date(items[start].date);
      headers.push({
        key: day + ":" + start,
        label:
          day === "unknown"
            ? "Undated"
            : date.toLocaleDateString(undefined, {
                weekday: "short",
                month: "long",
                day: "numeric",
                year: "numeric",
              }),
        y,
        indices: Array.from({ length: end - start }, (_, i) => start + i),
      });
      y += 44;
    }
    let row: number[] = [],
      sum = 0;
    const flush = (last: boolean) => {
      if (!row.length) return;
      const available = Math.max(1, usable - gap * (row.length - 1));
      const h = last ? Math.min(target, available / sum) : available / sum;
      let x = 0;
      for (const index of row) {
        const w = Math.min(usable - x, ratio(index) * h);
        placements.push({
          index,
          x,
          y,
          width: Math.max(1, w),
          height: Math.max(1, h),
        });
        x += w + gap;
      }
      y += h + gap;
      row = [];
      sum = 0;
    };
    for (let i = start; i < end; i++) {
      row.push(i);
      sum += ratio(i);
      if (sum * target + gap * (row.length - 1) >= usable) flush(false);
    }
    flush(true);
    start = end;
  }
  return {
    placements,
    headers,
    height: Math.max(0, y - (items.length ? gap : 0)),
  };
}
