"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { ArrowLeft, ArrowRight, ArrowUpRight, Pause, Play } from "lucide-react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Modal } from "./primitives";
import { usePublicCatalog } from "./usePublicCatalog";
import "./travel-scrapbook.css";

import { catalogScrapbookFrames, scrapbookSamples, selectScrapbookFrames, type ScrapbookFrame } from "@/lib/public-trips/scrapbook";

/** Decode only visible films; originals stay outside React/JS memory. */
function AutoFilm({ frame, paused }: { frame: ScrapbookFrame; paused: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = ref.current!;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    let visible = false;
    const update = () => {
      if (visible && !paused && !motion.matches && !document.hidden) {
        if (!video.hasAttribute("src")) video.src = frame.src;
        void video.play().catch(() => { /* Poster remains if autoplay is blocked. */ });
      } else video.pause();
    };
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; update(); }, { threshold: .1 });
    observer.observe(video);
    document.addEventListener("visibilitychange", update);
    motion.addEventListener("change", update);
    return () => { observer.disconnect(); video.pause(); document.removeEventListener("visibilitychange", update); motion.removeEventListener("change", update); };
  }, [frame.src, paused]);
  return <video ref={ref} className="scrapbook-auto-film" poster={frame.preview || undefined} autoPlay muted loop playsInline preload="none" aria-label={frame.title} />;
}

export default function TravelScrapbook({ media = [] }: { media?: ScrapbookFrame[] }) {
  const root = useRef<HTMLElement>(null);
  const { catalog } = usePublicCatalog();
  const [selected, setSelected] = useState<number | null>(null);
  const [seed, setSeed] = useState(17);
  const [paused, setPaused] = useState(false);
  const [stripRepeats, setStripRepeats] = useState(1);
  useEffect(() => {
    // A visit gets a fresh mix after hydration, without random render-time output.
    let alive = true;
    queueMicrotask(() => { if (alive) setSeed(crypto.getRandomValues(new Uint32Array(1))[0]); });
    return () => { alive = false; };
  }, []);
  const moments = useMemo(() => selectScrapbookFrames([
    ...catalogScrapbookFrames(catalog?.items ?? [], media),
    ...(media.length ? media : scrapbookSamples),
  ], seed), [catalog, media, seed]);
  const frames = moments.slice(0, 8);
  const current = selected === null ? null : moments[selected];
  const next = (direction: number) => setSelected(index => index === null ? null : (index + direction + moments.length) % moments.length);

  useEffect(() => {
    const strip = root.current!.querySelector<HTMLElement>(".scrapbook-strip")!;
    // Repeat short collections to fill the viewport without distributing empty space.
    const resize = new ResizeObserver(() => {
      const card = strip.querySelector<HTMLElement>(".scrapbook-strip-item");
      if (!card) return;
      const stride = card.offsetWidth + 8;
      setStripRepeats(Math.max(1, Math.ceil((strip.clientWidth + stride) / (stride * Math.max(1, moments.length)))));
    });
    resize.observe(strip);
    return () => resize.disconnect();
  }, [moments.length]);

  useEffect(() => {
    const strips = root.current!.querySelectorAll<HTMLElement>(".scrapbook-strip");
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => (entry.target as HTMLElement).style.setProperty("--strip-visibility", entry.isIntersecting ? "running" : "paused"));
    });
    strips.forEach(strip => observer.observe(strip));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (selected === null) return;
    const key = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
        event.preventDefault();
        setSelected(index => index === null ? null : (index + (event.key === "ArrowRight" ? 1 : -1) + moments.length) % moments.length);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [selected, moments.length]);

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
    <section className="travel-scrapbook" id="collected-moments" ref={root} aria-labelledby="scrapbook-heading" data-paused={paused || selected !== null}>
      <div className="scrapbook-topline"><span>MY LIFE, COLLECTED.</span><button className="scrapbook-motion-toggle" onClick={() => setPaused(value => !value)} aria-pressed={paused}>{paused ? <Play size={12} /> : <Pause size={12} />}{paused ? "Resume films & strip" : "Pause films & strip"}</button></div>
      <div className="scrapbook-strips" aria-label="A moving collection from my trips">
        <div className="scrapbook-strip">
          <div className="scrapbook-strip-track">
            {[0, 1].map(copy => <div className="scrapbook-strip-group" key={copy} aria-hidden={copy === 1 ? true : undefined} inert={copy === 1 ? true : undefined}>
              {Array.from({ length: stripRepeats }, (_, repeat) => moments.map((frame, index) => <button className="scrapbook-strip-item" key={`${repeat}-${frame.id}`} onClick={() => setSelected(index)} tabIndex={copy || repeat ? -1 : undefined} aria-hidden={repeat ? true : undefined} inert={repeat ? true : undefined} aria-label={`Open ${frame.kind}: ${frame.title} · ${frame.tripTitle}`}>
                {frame.kind === "film" ? <AutoFilm frame={frame} paused={paused || selected !== null} /> : <Image src={frame.preview} alt={frame.title} fill sizes="(max-width: 700px) 160px, 260px" unoptimized={!frame.sample} loading="lazy" />}
              </button>))}
            </div>)}
          </div>
        </div>
      </div>
      <div className="scrapbook-stage">
        <svg className="scrapbook-route" viewBox="0 0 1400 1500" fill="none" preserveAspectRatio="none" aria-hidden="true"><path d="M-80 100C160 20 340 140 310 340S50 720 340 800 1160 350 1270 650 700 1020 910 1220 1390 1220 1480 1470" /></svg>
        <header className="scrapbook-heading">
          <span className="scrapbook-overline">THE SOUVENIRS THAT MATTER</span>
          <h2 id="scrapbook-heading" className="scrapbook-title"><span className="scrapbook-line"><span>I GO PLACES.</span></span><span className="scrapbook-line"><span>THEY STAY <em>WITH ME.</em></span></span></h2>
          <a className="scrapbook-link" href="/photography">Open the visual journal <span><ArrowUpRight size={18} /></span></a>
          <p>A road. A face. A few seconds I wish lasted longer. Little pieces of my world, brought home.</p>
        </header>
        <div className="scrapbook-frames">
          {frames.map((frame, index) => <div className={`scrapbook-drift scrapbook-position-${index + 1}`} key={index} data-trip={frame.tripId} data-media-id={frame.id}>
            <button className={`scrapbook-print ${frame.kind === "film" ? "scrapbook-film" : ""}`} onClick={() => setSelected(index)} aria-label={`Open ${frame.kind}: ${frame.title}`}>
              <div className="scrapbook-image">{frame.kind === "film" ? <AutoFilm frame={frame} paused={paused || selected !== null} /> : <Image src={frame.preview} alt={frame.title} fill sizes="(max-width: 700px) 45vw, 28vw" unoptimized={!frame.sample} loading="lazy" />}</div>
            </button>
          </div>)}
        </div>
        <div className="scrapbook-endnote"><span className="scrapbook-asterisk" aria-hidden="true">✳</span><p>Not everything fits<br />in a suitcase.</p><span>Keep the feeling.</span></div>
      </div>
      <footer className="scrapbook-bottomline"><span>{frames.some(frame => frame.sample) ? "ILLUSTRATIVE COLLECTION · SAMPLE PHOTOS & FILMS" : "FROM THE PUBLIC JOURNAL"}</span><span>MORE ROADS. MORE STORIES. ↓</span></footer>
      {current && <Modal title={current.title} className="scrapbook-viewer" onClose={() => setSelected(null)}>
        <div className="scrapbook-viewer-media">{current.kind === "film" ? <video key={current.id} src={current.src} poster={current.preview} controls autoPlay muted playsInline preload="metadata" /> : <Image key={current.id} src={current.src} alt={current.title} width={1600} height={1200} unoptimized />}</div>
        <div className="scrapbook-viewer-bar"><div><h3>{current.title}</h3><p>{current.sample ? "Illustrative sample · Not a personal travel record" : "From my published collection"}</p></div><div className="scrapbook-viewer-nav"><button onClick={() => next(-1)} aria-label="Previous moment"><ArrowLeft size={20} /></button><span>{String(selected! + 1).padStart(2, "0")} / {String(moments.length).padStart(2, "0")}</span><button onClick={() => next(1)} aria-label="Next moment"><ArrowRight size={20} /></button></div></div>
      </Modal>}
    </section>
  );
}
