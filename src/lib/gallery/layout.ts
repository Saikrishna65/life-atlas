import type { GalleryAsset } from "./types";
export interface GalleryPlacement {
  index: number;
  x: number;
  y: number;
  width: number;
  height: number;
}
/** Deterministic masonry coordinates: keeps DOM/window size independent of library size. */
export function galleryLayout(
  items: GalleryAsset[],
  width: number,
  columns: number,
  gap: number,
) {
  const count = Math.max(2, Math.min(6, columns)),
    columnWidth = Math.max(1, (width - gap * (count - 1)) / count),
    heights = Array<number>(count).fill(0);
  const placements = items.map((asset, index) => {
    let column = 0;
    for (let i = 1; i < count; i++)
      if (heights[i] < heights[column]) column = i;
    const ratio =
      asset.device?.width && asset.device.height
        ? Math.max(
            0.62,
            Math.min(1.65, asset.device.width / asset.device.height),
          )
        : index % 5 === 0
          ? 0.8
          : 1.1;
    const height = columnWidth / ratio,
      placement = {
        index,
        x: column * (columnWidth + gap),
        y: heights[column],
        width: columnWidth,
        height,
      };
    heights[column] += height + gap;
    return placement;
  });
  return {
    placements,
    height: Math.max(0, ...heights) - (items.length ? gap : 0),
  };
}
