export interface MediaRect {
  left: number;
  top: number;
  width: number;
  height: number;
}
export function containRect(
  box: MediaRect,
  width: number,
  height: number,
): MediaRect {
  if (width <= 0 || height <= 0) return box;
  const scale = Math.min(box.width / width, box.height / height),
    w = width * scale,
    h = height * scale;
  return {
    left: box.left + (box.width - w) / 2,
    top: box.top + (box.height - h) / 2,
    width: w,
    height: h,
  };
}
export function galleryTarget(id: string): MediaRect | undefined {
  for (const node of document.querySelectorAll<HTMLElement>(
    `[data-media-id="${CSS.escape(id)}"]`,
  )) {
    if (node.closest("dialog")) continue;
    const r = node.getBoundingClientRect();
    if (r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight)
      return { left: r.left, top: r.top, width: r.width, height: r.height };
  }
}
