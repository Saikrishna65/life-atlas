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
/** Natural-ratio masonry. Wide landscapes may span two columns; dates remain chronological. */
export function galleryLayout(
  items: GalleryAsset[],
  width: number,
  columns: number,
  gap: number,
  groupDates = false,
) {
  const usable = Math.max(1, width),
    count = Math.max(2, Math.min(6, columns)),
    gutter = Math.max(0, Math.min(gap, usable / (count * 2))),
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
    const bottoms = Array<number>(count).fill(y);
    for (let i = start; i < end; i++) {
      const d = items[i].device;
      const natural = d?.width && d.height ? d.width / d.height : 1;
      const ratio =
        Number.isFinite(natural) && natural > 0
          ? Math.max(0.125, Math.min(8, natural))
          : 1;
      let span = count >= 3 && ratio >= (count >= 4 ? 1.75 : 1.7) ? 2 : 1;
      let column = 0,
        top = Infinity;
      const choose = () => {
        for (let c = 0; c <= count - span; c++) {
          const heights = bottoms.slice(c, c + span),
            candidate = Math.max(...heights);
          if (
            span > 1 &&
            candidate - Math.min(...heights) > Math.min(32, columnWidth * 0.18)
          )
            continue;
          if (candidate < top) {
            top = candidate;
            column = c;
          }
        }
      };
      choose();
      if (!Number.isFinite(top)) {
        span = 1;
        choose();
      }
      const tileWidth = columnWidth * span + gutter * (span - 1),
        height = tileWidth / ratio;
      placements.push({
        index: i,
        x: column * (columnWidth + gutter),
        y: top,
        width: tileWidth,
        height,
      });
      for (let c = column; c < column + span; c++)
        bottoms[c] = top + height + gutter;
    }
    y = Math.max(...bottoms) - gutter;
    start = end;
  }
  return { placements, headers, height: Math.max(0, y) };
}
