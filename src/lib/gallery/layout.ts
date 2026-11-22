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
/** Dense cell mosaic: 1×1, 2×1 and 2×2 tiles, never unbounded portrait columns. */
export function galleryLayout(
  items: GalleryAsset[],
  width: number,
  columns: number,
  gap: number,
  groupDates = false,
) {
  const usable = Number.isFinite(width) ? Math.max(1, width) : 1,
    count = Math.max(
      2,
      Math.min(6, Number.isFinite(columns) ? Math.round(columns) : 4),
    ),
    gutter = Math.max(
      0,
      Math.min(Number.isFinite(gap) ? gap : 0, usable / (count * 2)),
    ),
    columnWidth = (usable - gutter * (count - 1)) / count,
    placements: GalleryPlacement[] = [],
    headers: GalleryDateHeading[] = [];
  let y = 0,
    start = 0;
  while (start < items.length) {
    let end = start + 1;
    const day = galleryDay(items[start].date);
    if (groupDates)
      while (end < items.length && galleryDay(items[end].date) === day) end++;
    else end = items.length;
    if (groupDates) {
      if (start) y += 20;
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
    const rows: number[] = [],
      full = (1 << count) - 1;
    let firstOpen = 0;
    for (let i = start; i < end; i++) {
      const offset = i - start,
        d = items[i].device;
      const wide = !!d?.height && d.width / d.height >= 1.4;
      const featured = count >= 3 && end - i >= 6 && offset % 12 === 0;
      const spanX =
        featured || (count >= 3 && offset % 9 === 5 && wide) ? 2 : 1;
      const spanY = featured ? 2 : 1;
      let row = firstOpen,
        column = 0,
        found = false;
      for (; !found; row++) {
        for (let c = 0; c <= count - spanX; c++) {
          const mask = ((1 << spanX) - 1) << c;
          if (
            Array.from(
              { length: spanY },
              (_, r) => (rows[row + r] || 0) & mask,
            ).some(Boolean)
          )
            continue;
          column = c;
          for (let r = 0; r < spanY; r++)
            rows[row + r] = (rows[row + r] || 0) | mask;
          found = true;
          break;
        }
      }
      row--;
      placements.push({
        index: i,
        x: column * (columnWidth + gutter),
        y: y + row * (columnWidth + gutter),
        width: spanX * columnWidth + (spanX - 1) * gutter,
        height: spanY * columnWidth + (spanY - 1) * gutter,
      });
      while (rows[firstOpen] === full) firstOpen++;
    }
    y += rows.length * (columnWidth + gutter) - gutter;
    start = end;
  }
  return { placements, headers, height: Math.max(0, y) };
}
