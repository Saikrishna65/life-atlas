"use client";
import { useLayoutEffect, useState, type RefObject } from "react";
type Pose = { scale: number; x: number; y: number };
/** External gesture state, like a motion value: frame writes do not render React. */
class ViewerMotion {
  pose: Pose = { scale: 1, x: 0, y: 0 };
  y = 0;
  drag = 0;
  frame = 0;
  active = false;
  element: HTMLDivElement | null = null;
  onActive: (active: boolean) => void = () => {};
  draw = () => {
    this.frame = 0;
    const node = this.element;
    if (!node) return;
    node.style.transform = `translate3d(0,${Math.max(0, this.y)}px,0) scale(${1 - Math.min(0.18, Math.max(0, this.y) / 1500)})`;
    node.style.borderRadius = this.y > 8 ? "18px" : "0";
    node.style.setProperty("--pv-drag", `${this.drag}px`);
    node
      .closest("dialog")
      ?.style.setProperty(
        "--pv-shade",
        String(1 - Math.min(0.95, Math.max(0, this.y) / 280)),
      );
    for (const image of node.querySelectorAll<HTMLElement>(
      ".pv-slide:not([inert]) > img,.pv-slide:not([inert]) > .pv-live-poster",
    ))
      image.style.transform = `translate3d(${this.pose.x}px,${this.pose.y}px,0) scale(${this.pose.scale})`;
  };
  schedule = () => {
    if (!this.frame) this.frame = requestAnimationFrame(this.draw);
  };
  setTransform = (value: Pose | ((old: Pose) => Pose)) => {
    Object.assign(
      this.pose,
      typeof value === "function" ? value(this.pose) : value,
    );
    this.schedule();
  };
  setVertical = (value: number) => {
    this.y = value;
    const active = Math.abs(value) > 8;
    if (active !== this.active) {
      this.active = active;
      this.onActive(active);
    }
    this.schedule();
  };
  setDrag = (value: number) => {
    this.drag = value;
    this.schedule();
  };
  attach = (
    element: HTMLDivElement | null,
    onActive: (value: boolean) => void,
  ) => {
    this.element = element;
    this.onActive = onActive;
  };
  stop = () => {
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.element = null;
  };
}
export function useViewerMotion(stage: RefObject<HTMLDivElement | null>) {
  const [active, setActive] = useState(false),
    [motion] = useState(() => new ViewerMotion());
  useLayoutEffect(() => {
    motion.attach(stage.current, setActive);
  }, [motion, stage]);
  useLayoutEffect(() => {
    motion.draw();
  });
  useLayoutEffect(() => () => motion.stop(), [motion]);
  return {
    pose: motion.pose,
    vertical: active ? 9 : 0,
    setTransform: motion.setTransform,
    setVertical: motion.setVertical,
    setDrag: motion.setDrag,
  };
}
