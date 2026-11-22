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

/** Counter-scale the image inside a transforming crop, retaining its proportions. */
export function sharedImageFrames(full: MediaRect, thumb: MediaRect) {
  const sx = thumb.width / full.width,
    sy = thumb.height / full.height;
  const dx = thumb.left + thumb.width / 2 - full.left - full.width / 2;
  const dy = thumb.top + thumb.height / 2 - full.top - full.height / 2;
  const crop: Keyframe[] = [],
    image: Keyframe[] = [];
  for (let i = 0; i <= 30; i++) {
    const t = i / 30,
      x = sx + (1 - sx) * t,
      y = sy + (1 - sy) * t;
    const scale = Math.max(x, y);
    crop.push({
      offset: t,
      transform: `translate3d(${dx * (1 - t)}px,${dy * (1 - t)}px,0) scale(${x},${y})`,
    });
    image.push({ offset: t, transform: `scale(${scale / x},${scale / y})` });
  }
  return { crop, image };
}
