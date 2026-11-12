"use client";
import { useLayoutEffect, useRef, useCallback } from "react";
import { useLenis } from "lenis/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

/** One bounded, desktop-only passage. Touch and reduced motion use a native rail. */
export function useExpeditionSequence(revision: string) {
  const passage = useRef<HTMLDivElement>(null);
  const animation = useRef<gsap.core.Timeline | null>(null);
  const lenis = useLenis();
  const rewindRequested = useRef(false);
  useLayoutEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const element = passage.current;
    if (!element) return;
    const rail = element.querySelector<HTMLElement>(".expedition-cinema");
    const viewport = element.querySelector<HTMLElement>(".expedition-viewport");
    if (!rail || !viewport) return;
    viewport.scrollLeft = 0;
    const media = gsap.matchMedia();
    media.add(
      "(min-width:1100px) and (pointer:fine) and (prefers-reduced-motion:no-preference)",
      () => {
        if (rail.children.length < 2) return;
        const distance = () =>
          Math.max(0, rail.scrollWidth - viewport.clientWidth);
        element.dataset.cinematic = "true";
        const timeline = gsap.timeline({
          scrollTrigger: {
            trigger: element,
            start: "top 96px",
            end: () => `+=${Math.max(650, distance() * 0.85)}`,
            pin: true,
            scrub: 1,
            invalidateOnRefresh: true,
            anticipatePin: 1,
            onUpdate: (self) =>
              element.style.setProperty(
                "--passage-progress",
                String(self.progress),
              ),
          },
        });
        animation.current = timeline;
        timeline.to(rail, { x: () => -distance(), ease: "none" }, 0);
        const frames = rail.querySelectorAll(".expedition-image-plane");
        timeline.fromTo(
          frames,
          { scale: 1.1, rotateY: -6 },
          { scale: 1, rotateY: 3, ease: "none" },
          0,
        );
        const setupFrame = requestAnimationFrame(() => {
          lenis?.resize();
          // Rewind only after the replacement rail has its final pin geometry.
          ScrollTrigger.refresh();
          if (rewindRequested.current) {
            rewindRequested.current = false;
            const start = timeline.scrollTrigger?.start;
            if (start !== undefined)
              lenis?.scrollTo(start, { duration: 0.7, force: true });
          }
        });
        return () => {
          cancelAnimationFrame(setupFrame);
          animation.current = null;
          timeline.scrollTrigger?.kill();
          timeline.kill();
          gsap.set([rail, ...frames], { clearProps: "transform" });
          delete element.dataset.cinematic;
          element.style.removeProperty("--passage-progress");
        };
      },
    );
    return () => media.revert();
  }, [revision, lenis]);
  const focusFrame = useCallback(
    (index: number) => {
      const st = animation.current?.scrollTrigger;
      const button =
        passage.current?.querySelectorAll<HTMLElement>(".expedition-panel")[
          index
        ];
      if (!st || !button) return;
      const box = button.getBoundingClientRect();
      if (box.left < 0 || box.right > innerWidth) {
        lenis?.scrollTo(
          st.start +
            ((st.end - st.start) * index) /
              Math.max(
                1,
                (passage.current?.querySelectorAll(".expedition-panel")
                  .length ?? 1) - 1,
              ),
          { force: true, immediate: true },
        );
      }
    },
    [lenis],
  );
  const rewind = useCallback(() => {
    if (animation.current) rewindRequested.current = true;
  }, []);
  return { passage, focusFrame, rewind };
}
