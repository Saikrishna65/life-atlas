"use client";
import { useEffect, useRef, type ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
export default function HeroEditorial({
  lines,
  stage = 0,
  primary = false,
}: {
  lines: ReactNode[];
  stage?: number;
  primary?: boolean;
}) {
  const root = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion:no-preference)", () => {
      const context = gsap.context(() => {
        gsap.fromTo(
          root.current?.querySelectorAll(".hero-letterline") ?? [],
          { yPercent: 115, rotate: 2 },
          {
            yPercent: 0,
            rotate: 0,
            duration: 1.3,
            stagger: 0.13,
            ease: "power4.out",
            scrollTrigger: {
              trigger: root.current?.closest("[data-hero]"),
              start:
                stage === 0 ? "top 5%" : stage === 1 ? "top -38%" : "top -125%",
              once: true,
            },
          },
        );
      }, root);
      return () => context.revert();
    });
    return () => media.revert();
  }, [stage]);
  const Tag = primary ? "h1" : "h2";
  return (
    <Tag className="hero-editorial-heading" ref={root}>
      {lines.map((line, index) => (
        <span className="hero-linemask" key={index}>
          <span className="hero-letterline">{line}</span>
        </span>
      ))}
    </Tag>
  );
}
