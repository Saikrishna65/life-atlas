"use client";
import { useLayoutEffect, useMemo, useState, type RefObject } from "react";
import { galleryLayout } from "@/lib/gallery/layout";
import type { GalleryAsset } from "@/lib/gallery/types";
export function useGalleryLayout(
  items: GalleryAsset[],
  columns: number,
  root: RefObject<HTMLDivElement | null>,
  groupDates = true,
  contextKey = "device",
) {
  const [width, setWidth] = useState(0),
    [viewport, setViewport] = useState({ top: 0, height: 1000 });
  useLayoutEffect(() => {
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
  }, [root, items.length, contextKey]);
  const layout = useMemo(
    () =>
      width > 0
        ? galleryLayout(items, width, columns, width < 650 ? 3 : 4, groupDates)
        : { placements: [], headers: [], height: 0 },
    [items, width, columns, groupDates],
  );
  const visible =
    items.length <= 160
      ? layout.placements
      : layout.placements.filter(
          (p) =>
            p.y + p.height >= viewport.top - 600 &&
            p.y <= viewport.top + viewport.height + 600,
        );
  return {
    ready: width > 0,
    height: layout.height,
    visible,
    headers: layout.headers.filter(
      (h) =>
        items.length <= 160 ||
        (h.y + 44 >= viewport.top - 600 &&
          h.y <= viewport.top + viewport.height + 600),
    ),
  };
}
