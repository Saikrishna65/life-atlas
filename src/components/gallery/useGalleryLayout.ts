"use client";
import { useLayoutEffect, useMemo, useState, type RefObject } from "react";
import { GalleryViewportIndex } from "@/lib/gallery/viewport-index";
import { localPerformance, performanceNow } from "@/lib/performance/metrics";
import { galleryLayout } from "@/lib/gallery/layout";
import type { GalleryAsset } from "@/lib/gallery/types";
export function useGalleryLayout(
  items: GalleryAsset[],
  columns: number,
  root: RefObject<HTMLDivElement | null>,
  groupDates = true,
  contextKey = "device",
  paused = false,
) {
  const [width, setWidth] = useState(0),
    [viewport, setViewport] = useState({ top: 0, height: 1000 });
  useLayoutEffect(() => {
    const node = root.current;
    if (!node || paused) return;
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
  }, [root, items.length, contextKey, paused]);
  const layout = useMemo(() => {
    const started = performanceNow();
    const value =
      width > 0
        ? galleryLayout(items, width, columns, width < 650 ? 3 : 4, groupDates)
        : { placements: [], headers: [], height: 0 };
    localPerformance.record("gallery-layout", performanceNow() - started);
    return value;
  }, [items, width, columns, groupDates]);
  const index = useMemo(
    () =>
      layout.placements.length > 160
        ? new GalleryViewportIndex(layout.placements)
        : undefined,
    [layout.placements],
  );
  const headingIndex = useMemo(
    () =>
      layout.placements.length > 160
        ? new GalleryViewportIndex(
            layout.headers.map((header) => ({ ...header, height: 44 })),
          )
        : undefined,
    [layout.headers, layout.placements.length],
  );
  const windowed = useMemo(() => {
    const started = performanceNow();
    const visible = index
      ? index.query(viewport.top, viewport.height).items
      : layout.placements;
    const headers = headingIndex
      ? headingIndex.query(viewport.top, viewport.height).items
      : layout.headers;
    localPerformance.record("gallery-window", performanceNow() - started);
    localPerformance.gauge("gallery-loaded", items.length);
    localPerformance.gauge("gallery-mounted", visible.length);
    return { visible, headers };
  }, [index, headingIndex, layout, items.length, viewport]);
  return { ready: width > 0, height: layout.height, ...windowed };
}
