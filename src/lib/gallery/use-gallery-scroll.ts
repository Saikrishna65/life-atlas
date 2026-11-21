"use client";
import { useLayoutEffect, useState } from "react";
/** Scroll belongs to a logical gallery page, not to whichever page last used window. */
export class GalleryScrollPositions {
  private values = new Map<string, number>();
  read(key: string) {
    return this.values.get(key) || 0;
  }
  remember(key: string, value: number) {
    this.values.delete(key);
    this.values.set(key, Math.max(0, value));
    if (this.values.size > 40)
      this.values.delete(this.values.keys().next().value!);
  }
}
class ScrollSession {
  positions = new GalleryScrollPositions();
  key = "";
  pending: number | null = null;
  enter = (key: string) => {
    this.key = key;
    this.pending = this.positions.read(key);
    this.restore();
  };
  restore = () => {
    if (this.pending === null) return;
    window.scrollTo({ top: this.pending, behavior: "instant" });
    if (document.documentElement.scrollHeight - innerHeight >= this.pending - 1)
      this.pending = null;
  };
  scroll = () => {
    if (this.pending === null)
      this.positions.remember(this.key, window.scrollY);
  };
  interact = () => {
    this.pending = null;
  };
}
export function useGalleryScroll(key: string) {
  const [session] = useState(() => new ScrollSession());
  useLayoutEffect(() => {
    const previous = history.scrollRestoration;
    history.scrollRestoration = "manual";
    window.addEventListener("scroll", session.scroll, { passive: true });
    window.addEventListener("wheel", session.interact, { passive: true });
    window.addEventListener("touchstart", session.interact, { passive: true });
    window.addEventListener("keydown", session.interact);
    const observer = new ResizeObserver(() => session.restore());
    observer.observe(document.body);
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", session.scroll);
      window.removeEventListener("wheel", session.interact);
      window.removeEventListener("touchstart", session.interact);
      window.removeEventListener("keydown", session.interact);
      history.scrollRestoration = previous;
    };
  }, [session]);
  useLayoutEffect(() => {
    session.enter(key);
  }, [session, key]);
}
