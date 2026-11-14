"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ArrowLeft, ArrowRight, ArrowUpRight, Play } from "lucide-react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Modal } from "./primitives";
import { usePublicCatalog } from "./usePublicCatalog";
import "./travel-scrapbook.css";

type Frame = { id: string; src: string; preview: string; title: string; kind: "photo" | "film"; sample: boolean };
const samples: Frame[] = [
  { id: "ridge", src: "/images/world/ridge.webp", preview: "/images/world/ridge.webp", title: "The long way up", kind: "photo", sample: true },
  { id: "mist", src: "/images/world/mist.webp", preview: "/images/world/mist.webp", title: "Before the world wakes", kind: "photo", sample: true },
  { id: "highlands", src: "/films/hero/highlands.mp4", preview: "/images/world/mountains.webp", title: "A little mountain daydream", kind: "film", sample: true },
  { id: "valley", src: "/images/world/valley.webp", preview: "/images/world/valley.webp", title: "Somewhere worth stopping", kind: "photo", sample: true },
  { id: "mountains", src: "/images/world/mountains.webp", preview: "/images/world/mountains.webp", title: "Nothing but the view", kind: "photo", sample: true },
  { id: "coast", src: "/films/hero/coast.mp4", preview: "/images/world/ocean.webp", title: "Let the day drift", kind: "film", sample: true },
  { id: "ocean", src: "/images/world/ocean.webp", preview: "/images/world/ocean.webp", title: "At the edge of everything", kind: "photo", sample: true },
  { id: "garden", src: "/films/hero/gardens.mp4", preview: "/images/world/valley.webp", title: "A slower kind of afternoon", kind: "film", sample: true },
];

export default function TravelScrapbook() {
  const root = useRef<HTMLElement>(null);
  const { catalog } = usePublicCatalog();
  const [selected, setSelected] = useState<number | null>(null);
  // Only explicitly published media enters this public chapter. Unpublished originals
  // are never read. Videos without a thumbnail remain in the full public library.
  const published: Frame[] = (catalog?.items ?? [])
    .filter(item => item.mimeType.startsWith("image/") || (item.mimeType.startsWith("video/") && item.thumbnailUrl))
    .slice(0, 8)
    .map(item => ({ id: item.id, src: item.url, preview: item.thumbnailUrl || item.url, title: item.title, kind: item.mimeType.startsWith("video/") ? "film" : "photo", sample: false }));
  const frames = [...published, ...samples].slice(0, 8);
  const current = selected === null ? null : frames[selected];
  const next = (direction: number) => setSelected(index => index === null ? null : (index + direction + frames.length) % frames.length);

  useEffect(() => {
    if (selected === null) return;
    const key = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
        event.preventDefault();
        setSelected(index => index === null ? null : (index + (event.key === "ArrowRight" ? 1 : -1) + 8) % 8);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [selected]);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      const el = root.current!;
      const mobile = matchMedia("(max-width: 700px)").matches;
      const context = gsap.context(() => {
        gsap.fromTo(".scrapbook-title span", { yPercent: 110, rotate: 3 }, {
          yPercent: 0, rotate: 0, duration: 1.15, stagger: .12, ease: "power4.out",
          scrollTrigger: { trigger: ".scrapbook-heading", start: "top 86%", once: true },
        });
        gsap.utils.toArray<HTMLElement>(".scrapbook-drift").forEach((frame, index) => {
          gsap.fromTo(frame, { y: mobile ? 25 : 90 + (index % 3) * 55 }, {
            y: mobile ? -25 : -80 - (index % 3) * 65, ease: "none",
            scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: 1 },
          });
        });
        const path = el.querySelector<SVGPathElement>(".scrapbook-route path")!;
        const length = path.getTotalLength();
        gsap.fromTo(path, { strokeDasharray: length, strokeDashoffset: length }, {
          strokeDashoffset: 0, ease: "none",
          scrollTrigger: { trigger: el, start: "top 65%", end: "bottom 75%", scrub: 1.3 },
        });
      }, el);
      return () => context.revert();
    });
    return () => media.revert();
  }, []);

  return (
    <section className="travel-scrapbook" id="collected-moments" ref={root} aria-labelledby="scrapbook-heading">
      <div className="scrapbook-topline"><span>LIFE, COLLECTED.</span><span>PHOTOGRAPHS & SHORT FILMS</span></div>
      <div className="scrapbook-stage">
        <svg className="scrapbook-route" viewBox="0 0 1400 1500" fill="none" preserveAspectRatio="none" aria-hidden="true"><path d="M-80 100C160 20 340 140 310 340S50 720 340 800 1160 350 1270 650 700 1020 910 1220 1390 1220 1480 1470" /></svg>
        <header className="scrapbook-heading">
          <span className="scrapbook-overline">THE SOUVENIRS THAT MATTER</span>
          <h2 id="scrapbook-heading" className="scrapbook-title"><span className="scrapbook-line"><span>WE GO PLACES.</span></span><span className="scrapbook-line"><span>THEY STAY <em>WITH US.</em></span></span></h2>
          <a className="scrapbook-link" href="/photography">Open the visual journal <span><ArrowUpRight size={18} /></span></a>
          <p>A road. A face. A few seconds you wish lasted longer. Little pieces of the world, brought home.</p>
        </header>
        <div className="scrapbook-frames">
          {frames.map((frame, index) => <div className={`scrapbook-drift scrapbook-position-${index + 1}`} key={index}>
            <button className={`scrapbook-print ${frame.kind === "film" ? "scrapbook-film" : ""}`} onClick={() => setSelected(index)} aria-label={`Open ${frame.kind}: ${frame.title}`}>
              <div className="scrapbook-image"><Image src={frame.preview} alt={frame.title} fill sizes="(max-width: 700px) 45vw, 28vw" unoptimized={!frame.sample} loading="lazy" />{frame.kind === "film" && <span className="scrapbook-play"><Play size={19} fill="currentColor" /></span>}</div>
              <span className="scrapbook-print-index" aria-hidden="true">L/A — {String(index + 1).padStart(2, "0")} <span>{frame.kind === "film" ? "IN MOTION" : "A STILL MOMENT"}</span></span>
            </button>
          </div>)}
        </div>
        <div className="scrapbook-endnote"><span className="scrapbook-asterisk" aria-hidden="true">✳</span><p>Not everything fits<br />in a suitcase.</p><span>Keep the feeling.</span></div>
      </div>
      <footer className="scrapbook-bottomline"><span>{frames.some(frame => frame.sample) ? "ILLUSTRATIVE COLLECTION · SAMPLE PHOTOS & FILMS" : "FROM THE PUBLIC JOURNAL"}</span><span>MORE ROADS. MORE STORIES. ↓</span></footer>
      {current && <Modal title={current.title} className="scrapbook-viewer" onClose={() => setSelected(null)}>
        <div className="scrapbook-viewer-media">{current.kind === "film" ? <video key={current.id} src={current.src} poster={current.preview} controls playsInline preload="metadata" /> : <Image key={current.id} src={current.src} alt={current.title} width={1600} height={1200} unoptimized />}</div>
        <div className="scrapbook-viewer-bar"><div><h3>{current.title}</h3><p>{current.sample ? "Illustrative sample · Not a personal travel record" : "From the published collection"}</p></div><div className="scrapbook-viewer-nav"><button onClick={() => next(-1)} aria-label="Previous moment"><ArrowLeft size={20} /></button><span>{String(selected! + 1).padStart(2, "0")} / 08</span><button onClick={() => next(1)} aria-label="Next moment"><ArrowRight size={20} /></button></div></div>
      </Modal>}
    </section>
  );
}
