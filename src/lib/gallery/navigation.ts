"use client";
import { useEffect, useRef } from "react";

type Layer = { id: string; priority: number; back: () => void };
const layers: Layer[] = [];
let ignoredPops = 0;
let serial = 0;
const top = () =>
  [...layers].sort(
    (a, b) => b.priority - a.priority || layers.indexOf(b) - layers.indexOf(a),
  )[0];
function nativeBack(event: Event) {
  const layer = top();
  if (!layer) return;
  event.preventDefault();
  layer.back();
}
function pop() {
  if (ignoredPops) {
    ignoredPops--;
    const current = top();
    if (
      !ignoredPops &&
      current &&
      history.state?.atlasGalleryLayer !== current.id
    )
      history.pushState(
        { ...history.state, atlasGalleryLayer: current.id },
        "",
      );
    return;
  }
  const layer = top();
  layer?.back();
  setTimeout(() => {
    if (
      layer &&
      layers.includes(layer) &&
      history.state?.atlasGalleryLayer !== layer.id
    )
      history.pushState({ ...history.state, atlasGalleryLayer: layer.id }, "");
  }, 0);
}
/** One history entry per local surface. Native and browser Back close the uppermost surface. */
export function useGalleryBack(
  active: boolean,
  back: () => void,
  priority = 20,
) {
  const callback = useRef(back);
  useEffect(() => {
    callback.current = back;
  });
  useEffect(() => {
    if (!active) return;
    const entry: Layer = {
      id: `gallery-${++serial}`,
      priority,
      back: () => callback.current(),
    };
    if (!layers.length) {
      window.addEventListener("atlas:back", nativeBack);
      window.addEventListener("popstate", pop);
    }
    layers.push(entry);
    if (!ignoredPops)
      history.pushState({ ...history.state, atlasGalleryLayer: entry.id }, "");
    return () => {
      layers.splice(layers.indexOf(entry), 1);
      if (history.state?.atlasGalleryLayer === entry.id) {
        ignoredPops++;
        history.back();
      }
      // Keep the pop listener through an asynchronous programmatic history.back.
      if (!layers.length) {
        window.removeEventListener("atlas:back", nativeBack);
        setTimeout(() => {
          if (!layers.length) {
            window.removeEventListener("popstate", pop);
            ignoredPops = 0;
          }
        }, 100);
      }
    };
  }, [active, priority]);
}
