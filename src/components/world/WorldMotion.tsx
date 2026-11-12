"use client";
import { useEffect, useRef, type ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

/** A single scoped motion director; the original hero and scroll engine are outside it. */
export default function WorldMotion({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      const seenByFeature = new Map<string, WeakSet<Element>>();
      const cleanups = new Map<HTMLElement, (() => void)[]>();
      const contexts = new Map<HTMLElement, gsap.Context[]>();
      const remember = (el: HTMLElement, cleanup: () => void) =>
        cleanups.set(el, [...(cleanups.get(el) ?? []), cleanup]);
      const release = (el: HTMLElement) => {
        cleanups.get(el)?.forEach((fn) => fn());
        contexts.get(el)?.forEach((ctx) => ctx.revert());
        cleanups.delete(el);
        contexts.delete(el);
      };
      let pending = 0;
      let layoutChanged = false;
      const fine = window.matchMedia("(pointer:fine)").matches;
      const scan = () => {
        let changed = layoutChanged;
        layoutChanged = false;
        for (const el of contexts.keys())
          if (!root.current?.contains(el)) {
            release(el);
            changed = true;
          }
        const select = (query: string, setup: (el: HTMLElement) => void) => {
          let seen = seenByFeature.get(query);
          if (!seen) {
            seen = new WeakSet();
            seenByFeature.set(query, seen);
          }
          root.current?.querySelectorAll<HTMLElement>(query).forEach((el) => {
            if (seen!.has(el)) return;
            seen!.add(el);
            changed = true;
            const ctx = gsap.context(() => setup(el), root);
            contexts.set(el, [...(contexts.get(el) ?? []), ctx]);
          });
        };
        select("[data-world-reveal]", (el) => {
          const lines = el.querySelectorAll(".type-line-inner");
          if (lines.length) {
            gsap.fromTo(
              lines,
              { yPercent: 115, rotate: 2.5 },
              {
                yPercent: 0,
                rotate: 0,
                duration: 1.35,
                stagger: 0.11,
                ease: "power4.out",
                scrollTrigger: {
                  trigger: el,
                  start: "top 91%",
                  toggleActions: "play none none none",
                },
              },
            );
            const support = Array.from(el.children).filter(
              (child) =>
                !child.matches(".kinetic-heading") &&
                !child.querySelector(".kinetic-heading"),
            );
            if (support.length)
              gsap.fromTo(
                support,
                { y: 24, opacity: 0 },
                {
                  y: 0,
                  opacity: 1,
                  duration: 0.85,
                  stagger: 0.1,
                  delay: 0.15,
                  ease: "power3.out",
                  scrollTrigger: {
                    trigger: el,
                    start: "top 91%",
                    once: true,
                  },
                },
              );
          } else
            gsap.fromTo(
              el,
              { y: 30, opacity: 0.2 },
              {
                y: 0,
                opacity: 1,
                duration: 1.05,
                ease: "power3.out",
                scrollTrigger: { trigger: el, start: "top 93%", once: true },
              },
            );
        });
        select(".editorial-route", (el) => {
          const path = el.querySelector(".route-draw");
          if (path)
            gsap.fromTo(
              path,
              { strokeDasharray: 1, strokeDashoffset: 1 },
              {
                strokeDashoffset: 0,
                ease: "none",
                scrollTrigger: {
                  trigger: el.closest(".world-scene"),
                  start: "top 80%",
                  end: "bottom 35%",
                  scrub: 1.1,
                },
              },
            );
        });
        select(".journey-route-ink", (el) => {
          gsap.fromTo(
            el,
            { strokeDashoffset: 1 },
            {
              strokeDashoffset: 0,
              ease: "none",
              scrollTrigger: {
                trigger: el.closest(".journey-route-section"),
                start: "top 80%",
                end: "center 45%",
                scrub: 1.2,
              },
            },
          );
        });
        select(".route-traveler", (head) => {
          const svg = head.closest("svg");
          const path = svg?.querySelector<SVGPathElement>(".route-draw");
          if (!path) return;
          const distance = path.getTotalLength();
          const travel = { progress: 0 };
          gsap.to(travel, {
            progress: 1,
            ease: "none",
            scrollTrigger: {
              trigger: svg?.closest(".world-scene"),
              start: "top 80%",
              end: "bottom 35%",
              scrub: 1.1,
            },
            onUpdate: () => {
              const point = path.getPointAtLength(distance * travel.progress);
              head.setAttribute("cx", String(point.x));
              head.setAttribute("cy", String(point.y));
            },
          });
        });
        select("[data-world-parallax]", (el) => {
          const distance = Number(el.dataset.worldParallax) || 7;
          gsap.fromTo(
            el,
            { yPercent: distance },
            {
              yPercent: -distance,
              ease: "none",
              scrollTrigger: {
                trigger:
                  el.closest("figure,button,a,.world-scene") ??
                  el.parentElement,
                start: "top bottom",
                end: "bottom top",
                scrub: 1.2,
              },
            },
          );
        });
        select(".memory-print", (el) => {
          const plane = el.querySelector(".memory-image-wrap");
          const order = Number(el.dataset.printIndex) || 0;
          if (plane)
            gsap.fromTo(
              plane,
              {
                y: 35 + (order % 3) * 15,
                rotate: order % 2 ? 2 : -2,
                clipPath: "inset(12% 0% 0% 0%)",
              },
              {
                y: 0,
                rotate: 0,
                clipPath: "inset(0% 0% 0% 0%)",
                duration: 1.3,
                ease: "power3.out",
                scrollTrigger: { trigger: el, start: "top 94%", once: true },
              },
            );
        });
        select(".sound-art-stack", (el) =>
          gsap.fromTo(
            el,
            { rotationY: -18, rotationZ: -6, y: 55 },
            {
              rotationY: 8,
              rotationZ: 5,
              y: -30,
              ease: "none",
              scrollTrigger: {
                trigger: el.closest(".sound-stage"),
                start: "top bottom",
                end: "bottom top",
                scrub: 1.1,
              },
            },
          ),
        );
        select(".observatory-dial", (el) =>
          gsap.fromTo(
            el,
            { rotate: -18, scale: 0.93, opacity: 0.2 },
            {
              rotate: 18,
              scale: 1.03,
              opacity: 0.7,
              ease: "none",
              scrollTrigger: {
                trigger: el.closest(".observatory-map"),
                start: "top bottom",
                end: "bottom top",
                scrub: 1.3,
              },
            },
          ),
        );
        select(".system-constellation", (el) => {
          const visibility = new IntersectionObserver(([entry]) => {
            el.dataset.moving = String(entry.isIntersecting);
          });
          visibility.observe(el);
          remember(el, () => {
            visibility.disconnect();
            delete el.dataset.moving;
          });
          gsap.fromTo(
            el.querySelectorAll(".system-node"),
            { opacity: 0.15, scale: 0.75 },
            {
              opacity: 1,
              scale: 1,
              duration: 1.25,
              stagger: { each: 0.065, from: "start" },
              ease: "back.out(1.25)",
              scrollTrigger: { trigger: el, start: "top 85%", once: true },
            },
          );
          gsap.fromTo(
            el.querySelector(".system-orbit-rings"),
            { rotate: -24, scale: 0.85, svgOrigin: "300 250" },
            {
              rotate: 12,
              scale: 1.05,
              ease: "none",
              scrollTrigger: {
                trigger: el,
                start: "top bottom",
                end: "bottom top",
                scrub: 1.4,
              },
            },
          );
        });
        select(".beyond-door", (el) => {
          gsap.fromTo(
            el,
            { y: 80, rotationX: 7, scale: 0.75 },
            {
              y: 0,
              rotationX: 0,
              scale: 1.06,
              ease: "none",
              scrollTrigger: {
                trigger: el.closest(".world-beyond"),
                start: "top bottom",
                end: "65% 45%",
                scrub: 1.25,
              },
            },
          );
          gsap.fromTo(
            el.querySelector(".door-leaf"),
            { rotationY: -72 },
            {
              rotationY: 0,
              ease: "none",
              scrollTrigger: {
                trigger: el.closest(".world-beyond"),
                start: "top 75%",
                end: "bottom bottom",
                scrub: 1.4,
              },
            },
          );
        });
        if (fine)
          select("[data-world-tilt]", (el) => {
            const target =
              el.querySelector<HTMLElement>("[data-tilt-plane]") ?? el;
            const x = gsap.quickTo(target, "rotationX", {
                duration: 0.7,
                ease: "power3.out",
              }),
              y = gsap.quickTo(target, "rotationY", {
                duration: 0.7,
                ease: "power3.out",
              });
            const move = (e: PointerEvent) => {
              if (e.pointerType === "touch") return;
              const r = el.getBoundingClientRect();
              x((-(e.clientY - r.top - r.height / 2) / r.height) * 7);
              y(((e.clientX - r.left - r.width / 2) / r.width) * 9);
            };
            const leave = () => {
              x(0);
              y(0);
            };
            el.addEventListener("pointermove", move, { passive: true });
            el.addEventListener("pointerleave", leave);
            remember(el, () => {
              el.removeEventListener("pointermove", move);
              el.removeEventListener("pointerleave", leave);
              x.tween.kill();
              y.tween.kill();
            });
          });
        if (fine)
          select(".world-button,.world-nav-explore", (el) => {
            const x = gsap.quickTo(el, "x", {
                duration: 0.4,
                ease: "power3.out",
              }),
              y = gsap.quickTo(el, "y", {
                duration: 0.4,
                ease: "power3.out",
              });
            const move = (e: PointerEvent) => {
              const r = el.getBoundingClientRect();
              x((e.clientX - r.left - r.width / 2) * 0.08);
              y((e.clientY - r.top - r.height / 2) * 0.13);
            };
            const leave = () => {
              x(0);
              y(0);
            };
            el.addEventListener("pointermove", move, { passive: true });
            el.addEventListener("pointerleave", leave);
            remember(el, () => {
              el.removeEventListener("pointermove", move);
              el.removeEventListener("pointerleave", leave);
              x.tween.kill();
              y.tween.kill();
            });
          });
        // Pin refreshes reparent existing DOM. Only new/removed motion targets
        // or actual size changes warrant another refresh; otherwise observing
        // those moves would create a refresh loop and steal keyboard focus.
        if (changed) ScrollTrigger.refresh(true);
      };
      scan();
      const schedule = () => {
        cancelAnimationFrame(pending);
        pending = requestAnimationFrame(scan);
      };
      const observer = new MutationObserver(schedule);
      let height = root.current?.getBoundingClientRect().height ?? 0;
      const resize = new ResizeObserver(([entry]) => {
        const next =
          entry.borderBoxSize[0]?.blockSize ?? entry.contentRect.height;
        if (Math.abs(next - height) < 1) return;
        height = next;
        layoutChanged = true;
        schedule();
      });
      if (root.current) {
        observer.observe(root.current, { subtree: true, childList: true });
        resize.observe(root.current);
      }
      return () => {
        observer.disconnect();
        resize.disconnect();
        cancelAnimationFrame(pending);
        Array.from(contexts.keys()).forEach(release);
        seenByFeature.clear();
      };
    });
    return () => media.revert();
  }, []);
  return (
    <div className="world-motion-root" ref={root}>
      {children}
    </div>
  );
}
