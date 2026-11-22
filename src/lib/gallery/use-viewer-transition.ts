"use client";
import { useEffect, useLayoutEffect, useState, type RefObject } from "react";
import { containRect, galleryTarget, sharedImageFrames } from "./viewer-motion";
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
        rect,
        src: image.currentSrc || image.src,
        width: image.naturalWidth,
        height: image.naturalHeight,
      }
    : undefined;
}
/** One compositor timeline; decoded image handoff never removes the only visible bitmap. */
class SharedViewerTransition {
  origin: ReturnType<typeof source>;
  stage: HTMLElement | null = null;
  layers: HTMLElement[] = [];
  animations: Animation[] = [];
  opening: Animation[] | null = null;
  epoch = 0;
  frame = 0;
  constructor(readonly id: string) {
    if (typeof document !== "undefined") this.origin = source(id);
  }
  reduced() {
    return matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
  photo() {
    return this.stage?.querySelector<HTMLImageElement>(
      ".pv-slide:not([inert]) > img",
    );
  }
  attach(node: HTMLElement | null) {
    this.stage = node;
    if (!this.photo()) this.origin = undefined;
    if (!node || this.reduced()) return;
    if (this.origin) {
      node.style.visibility = "hidden";
      node.closest("dialog")!.dataset.pvShared = "opening";
    } else
      this.animations.push(
        node.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 140 }),
      );
  }
  cancel = () => {
    this.epoch++;
    cancelAnimationFrame(this.frame);
    this.animations.forEach((a) => a.cancel());
    this.animations = [];
    this.opening = null;
    this.layers.forEach((n) => n.remove());
    this.layers = [];
    if (this.stage) {
      this.stage.style.visibility = "";
      const d = this.stage.closest("dialog");
      if (d) delete d.dataset.pvShared;
    }
  };
  interact = () => {
    if (this.stage?.closest("dialog")?.dataset.pvShared) return;
    // A new gesture takes priority over the final bitmap dissolve, not the live poster.
    this.layers.forEach((layer) => layer.remove());
    this.layers = [];
  };
  async run(
    opening: boolean,
    target: NonNullable<ReturnType<typeof source>>,
    done: () => void,
  ) {
    const node = this.stage,
      dialog = node?.closest("dialog"),
      live = this.photo();
    if (!node || !dialog || !live) return;
    this.cancel();
    const epoch = this.epoch;
    // Animate the decoded original itself. Using the SDR grid JPEG here and swapping
    // to a differently decoded/HDR original at the end caused a visible blink.
    if (opening && (!live.complete || !live.naturalWidth)) {
      const pending = document.createElement("p");
      pending.className = "pv-decoding-state";
      pending.setAttribute("role", "status");
      pending.textContent = "Opening photo…";
      dialog.append(pending);
      this.layers.push(pending);
      try {
        await live.decode();
      } catch {
        if (epoch === this.epoch) this.cancel();
        return;
      } finally {
        pending.remove();
      }
      if (epoch !== this.epoch || !live.isConnected) return;
    }
    const src = live.currentSrc || live.src;
    const dimensions = live.naturalWidth
      ? { width: live.naturalWidth, height: live.naturalHeight }
      : target;
    const full = containRect(
      opening ? node.getBoundingClientRect() : live.getBoundingClientRect(),
      dimensions.width,
      dimensions.height,
    );
    const frames = sharedImageFrames(full, target.rect);
    const crop = document.createElement("div"),
      image = document.createElement("img"),
      shade = document.createElement("div");
    crop.className = "pv-shared-image";
    shade.className = "pv-shared-shade";
    crop.setAttribute("aria-hidden", "true");
    shade.setAttribute("aria-hidden", "true");
    Object.assign(crop.style, {
      left: `${full.left}px`,
      top: `${full.top}px`,
      width: `${full.width}px`,
      height: `${full.height}px`,
      transform: String(frames.crop[opening ? 0 : 30].transform),
    });
    Object.assign(image.style, {
      transform: String(frames.image[opening ? 0 : 30].transform),
    });
    image.alt = "";
    image.draggable = false;
    image.src = src;
    crop.append(image);
    // Keep the real viewer visible while preparing a close; opening still shows the grid.
    dialog.dataset.pvShared = opening ? "opening" : "preparing-close";
    if (opening) node.style.visibility = "hidden";
    try {
      await image.decode();
    } catch {
      if (epoch === this.epoch) {
        this.cancel();
        if (!opening) done();
      }
      return;
    }
    if (epoch !== this.epoch) return;
    const baseAlpha = opening
      ? 0
      : Math.max(
          0,
          Math.min(
            1,
            Number(
              getComputedStyle(dialog).getPropertyValue("--pv-shade") || 1,
            ),
          ),
        );
    // The live viewer has a background plus a backdrop; preserve their combined shade.
    const alpha = 1 - (1 - baseAlpha) * (1 - baseAlpha);
    if (!opening && alpha > 0) {
      const channel = (16 * baseAlpha) / alpha;
      shade.style.backgroundColor = `rgb(${channel},${channel},${channel})`;
    }
    shade.style.opacity = String(alpha);
    dialog.append(shade, crop);
    this.layers = [shade, crop];
    node.style.visibility = "hidden";
    dialog.dataset.pvShared = opening ? "opening" : "closing";
    this.frame = requestAnimationFrame(() => {
      if (epoch !== this.epoch) return;
      const options = {
        duration: 240,
        easing: "cubic-bezier(.2,.75,.25,1)",
        fill: "both" as FillMode,
      };
      const a = crop.animate(
        opening
          ? frames.crop
          : [...frames.crop]
              .reverse()
              .map((f) => ({ ...f, offset: 1 - Number(f.offset) })),
        options,
      );
      const b = image.animate(
        opening
          ? frames.image
          : [...frames.image]
              .reverse()
              .map((f) => ({ ...f, offset: 1 - Number(f.offset) })),
        options,
      );
      const c = shade.animate(
        [{ opacity: alpha }, { opacity: opening ? 1 : 0 }],
        options,
      );
      this.animations.push(a, b, c);
      if (opening) this.opening = [a, b, c];
      void a.finished
        .then(() => {
          if (epoch !== this.epoch) return;
          if (!opening) {
            done();
            return;
          }
          this.opening = null;
          // Both layers now use the same decoded source and geometry. Exchange them
          // atomically; no second opacity timeline or preview/original replacement.
          node.style.visibility = "";
          delete dialog.dataset.pvShared;
          shade.remove();
          crop.remove();
          a.cancel();
          b.cancel();
          c.cancel();
          this.layers = [];
          this.animations = this.animations.filter(
            (item) => ![a, b, c].includes(item),
          );
        })
        .catch(() => {});
    });
  }
  open = () => {
    if (!this.origin || this.reduced()) return;
    const epoch = this.epoch;
    const ready = () => {
      if (epoch !== this.epoch) return;
      if (!this.stage?.closest("dialog")?.open) {
        this.frame = requestAnimationFrame(ready);
        return;
      }
      void this.run(true, this.origin!, () => {});
    };
    this.frame = requestAnimationFrame(ready);
  };
  close = (id: string, done: () => void) => {
    if (this.reduced() || !this.photo()) return false;
    const dialog = this.stage?.closest("dialog");
    if (dialog?.dataset.pvShared === "opening") {
      if (
        this.opening &&
        typeof this.opening[0].currentTime === "number" &&
        this.opening[0].currentTime > 0
      ) {
        const epoch = ++this.epoch,
          animations = this.opening;
        dialog.dataset.pvShared = "closing";
        animations.forEach((a) => a.reverse());
        void animations[0].finished
          .then(() => {
            if (epoch === this.epoch) done();
          })
          .catch(() => {});
      } else {
        this.cancel();
        queueMicrotask(done);
      }
      return true;
    }
    const target = source(id);
    if (!target) return false;
    void this.run(false, target, done);
    return true;
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
  return { close: motion.close, interact: motion.interact };
}
