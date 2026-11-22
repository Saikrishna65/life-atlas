"use client";
import { useEffect, useLayoutEffect, useState, type RefObject } from "react";
import { containRect, galleryTarget, type MediaRect } from "./viewer-motion";

function source(id: string) {
  const rect = galleryTarget(id);
  const tile = [
    ...document.querySelectorAll<HTMLElement>(
      `[data-media-id="${CSS.escape(id)}"]`,
    ),
  ].find((n) => !n.closest("dialog"));
  const image = tile?.querySelector<HTMLImageElement>("img");
  return rect && image?.complete && image.naturalWidth
    ? {
        rect:
          getComputedStyle(image).objectFit === "contain"
            ? containRect(rect, image.naturalWidth, image.naturalHeight)
            : rect,
        src: image.currentSrc || image.src,
        width: image.naturalWidth,
        height: image.naturalHeight,
      }
    : undefined;
}
/** A temporary shared image, animated with uniform scale and clipping, never distorted. */
class SharedViewerTransition {
  origin: ReturnType<typeof source>;
  stage: HTMLElement | null = null;
  overlay: HTMLElement | null = null;
  animation: Animation | null = null;
  frame = 0;
  cancelled = false;
  constructor(readonly id: string) {
    if (typeof document !== "undefined") this.origin = source(id);
  }
  attach(node: HTMLElement | null) {
    this.stage = node;
    if (this.origin && !this.reduced() && node)
      node.style.visibility = "hidden";
  }
  reduced() {
    return matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
  cancel = () => {
    this.cancelled = true;
    cancelAnimationFrame(this.frame);
    this.animation?.cancel();
    this.animation = null;
    this.overlay?.remove();
    this.overlay = null;
    if (this.stage) {
      this.stage.style.visibility = "";
      const dialog = this.stage.closest("dialog");
      if (dialog) delete dialog.dataset.pvShared;
    }
  };
  morph(
    from: MediaRect,
    to: MediaRect,
    src: string,
    opening: boolean,
    done: () => void,
  ) {
    const node = this.stage,
      dialog = node?.closest("dialog");
    if (!node || !dialog) return false;
    this.cancel();
    this.cancelled = false;
    const full = opening ? to : from,
      thumb = opening ? from : to;
    const scale = Math.max(
      thumb.width / full.width,
      thumb.height / full.height,
    );
    const dx = thumb.left + thumb.width / 2 - full.left - full.width / 2,
      dy = thumb.top + thumb.height / 2 - full.top - full.height / 2;
    const insetX = Math.max(0, (full.width - thumb.width / scale) / 2),
      insetY = Math.max(0, (full.height - thumb.height / scale) / 2);
    const folded = {
      transform: `translate3d(${dx}px,${dy}px,0) scale(${scale})`,
      clipPath: `inset(${insetY}px ${insetX}px round ${3 / scale}px)`,
    };
    const expanded = {
      transform: "translate3d(0,0,0) scale(1)",
      clipPath: "inset(0px 0px round 0px)",
    };
    const layer = document.createElement("div"),
      image = document.createElement("img");
    layer.className = "pv-shared-image";
    layer.setAttribute("aria-hidden", "true");
    Object.assign(layer.style, {
      left: `${full.left}px`,
      top: `${full.top}px`,
      width: `${full.width}px`,
      height: `${full.height}px`,
    });
    image.src = src;
    image.alt = "";
    image.draggable = false;
    layer.append(image);
    dialog.append(layer);
    this.overlay = layer;
    node.style.visibility = "hidden";
    dialog.dataset.pvShared = opening ? "opening" : "closing";
    this.animation = layer.animate(
      opening ? [folded, expanded] : [expanded, folded],
      { duration: 260, easing: "cubic-bezier(.2,.75,.2,1)", fill: "both" },
    );
    void this.animation.finished
      .then(async () => {
        if (opening) {
          const original = node.querySelector<HTMLImageElement>(
            ".pv-slide:not([inert]) > img",
          );
          if (original && !original.complete)
            await Promise.race([
              original.decode().catch(() => {}),
              new Promise((r) => setTimeout(r, 250)),
            ]);
        }
        if (this.cancelled || this.overlay !== layer) return;
        node.style.visibility = "";
        layer.remove();
        this.overlay = null;
        this.animation?.cancel();
        this.animation = null;
        delete dialog.dataset.pvShared;
        done();
      })
      .catch(() => {});
    return true;
  }
  open = () => {
    if (!this.origin || this.reduced()) return;
    this.cancelled = false;
    const run = () => {
      if (this.cancelled) return;
      const node = this.stage,
        dialog = node?.closest("dialog");
      if (!node || !dialog?.open) {
        this.frame = requestAnimationFrame(run);
        return;
      }
      const image = node.querySelector<HTMLImageElement>(
        ".pv-slide:not([inert]) > img",
      );
      const bounds = node.getBoundingClientRect();
      const full = containRect(bounds, this.origin!.width, this.origin!.height);
      this.morph(
        this.origin!.rect,
        full,
        image?.complete && image.naturalWidth
          ? image.currentSrc
          : this.origin!.src,
        true,
        () => {},
      );
    };
    this.frame = requestAnimationFrame(run);
  };
  close = (id: string, done: () => void) => {
    if (this.reduced()) return false;
    const target = source(id),
      node = this.stage;
    if (!target || !node) return false;
    const image = node.querySelector<HTMLImageElement>(
      ".pv-slide:not([inert]) > img",
    );
    const bounds =
      image?.getBoundingClientRect() || node.getBoundingClientRect();
    const full = containRect(
      bounds,
      image?.naturalWidth || target.width,
      image?.naturalHeight || target.height,
    );
    return this.morph(
      full,
      target.rect,
      image?.complete && image.naturalWidth ? image.currentSrc : target.src,
      false,
      done,
    );
  };
}
export function useViewerTransition(
  stage: RefObject<HTMLDivElement | null>,
  selected: string,
) {
  const [motion] = useState(() => new SharedViewerTransition(selected));
  useLayoutEffect(() => {
    motion.attach(stage.current);
  }, [motion, stage]);
  useEffect(() => {
    motion.open();
    return motion.cancel;
  }, [motion]);
  useEffect(() => {
    if (selected !== motion.id) motion.cancel();
  }, [selected, motion]);
  return motion.close;
}
