"use client";
import { useEffect, useMemo, useState, type RefObject } from "react";
import { galleryLayout } from "@/lib/gallery/layout";
import type { GalleryAsset } from "@/lib/gallery/types";
export function useGalleryLayout(
  items: GalleryAsset[],
  columns: number,
  root: RefObject<HTMLDivElement | null>,
) {
  const [width, setWidth] = useState(900),
    [viewport, setViewport] = useState({ top: 0, height: 1000 });
  useEffect(() => {
    const node = root.current;
    if (!node) return;
    let frame = 0;
    const measure = () => {
      const top = -node.getBoundingClientRect().top,
        height = window.innerHeight;
      setViewport((old) =>
        Math.abs(old.top - top) > 80 || old.height !== height
          ? { top, height }
          : old,
      );
    };
    const resize = new ResizeObserver((entries) => {
      setWidth(entries[0].contentRect.width);
      measure();
    });
    resize.observe(node);
    const scroll = () => {
      if (!frame)
        frame = requestAnimationFrame(() => {
          frame = 0;
          measure();
        });
    };
    window.addEventListener("scroll", scroll, { passive: true });
    window.addEventListener("resize", scroll);
    return () => {
      resize.disconnect();
      window.removeEventListener("scroll", scroll);
      window.removeEventListener("resize", scroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [root, items.length]);
  const layout = useMemo(
    () => galleryLayout(items, width, columns, width < 650 ? 6 : 10),
    [items, width, columns],
  );
  const visible =
    items.length <= 160
      ? layout.placements
      : layout.placements.filter(
          (p) =>
            p.y + p.height >= viewport.top - 600 &&
            p.y <= viewport.top + viewport.height + 600,
        );
  return { height: layout.height, visible };
}
