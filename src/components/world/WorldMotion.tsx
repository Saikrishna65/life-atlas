"use client";
import { useEffect, useRef, type ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
export default function WorldMotion({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const seen = new WeakSet<Element>();
      let frame = 0;
      const ctx = gsap.context(() => {}, root);
      const scan = () => {
        ctx.add(() => {
          root.current
            ?.querySelectorAll<HTMLElement>("[data-world-reveal]")
            .forEach((el) => {
              if (seen.has(el)) return;
              seen.add(el);
              gsap.fromTo(
                el,
                { y: 38, opacity: 0.15 },
                {
                  y: 0,
                  opacity: 1,
                  duration: 1,
                  ease: "power3.out",
                  scrollTrigger: {
                    trigger: el,
                    start: "top 92%",
                    toggleActions: "play none none reverse",
                  },
                },
              );
            });
          root.current
            ?.querySelectorAll<HTMLElement>("[data-world-parallax]")
            .forEach((el) => {
              if (seen.has(el)) return;
              seen.add(el);
              gsap.fromTo(
                el,
                { yPercent: -5 },
                {
                  yPercent: 5,
                  ease: "none",
                  scrollTrigger: {
                    trigger: el.parentElement,
                    start: "top bottom",
                    end: "bottom top",
                    scrub: 1,
                  },
                },
              );
            });
        });
        ScrollTrigger.refresh(true);
      };
      scan();
      const observer = new MutationObserver(() => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(scan);
      });
      if (root.current)
        observer.observe(root.current, { childList: true, subtree: true });
      return () => {
        cancelAnimationFrame(frame);
        observer.disconnect();
        ctx.revert();
      };
    });
    return () => mm.revert();
  }, []);
  return <div ref={root}>{children}</div>;
}
