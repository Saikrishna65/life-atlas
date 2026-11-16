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
  const stripPhase = useRef(0);
  const stripHeld = useRef(false);
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
  const current = selected === null ? null : moments[selected];
  const next = (direction: number) => setSelected(index => index === null ? null : (index + direction + moments.length) % moments.length);

  useEffect(() => {
    const strip = root.current!.querySelector<HTMLElement>(".scrapbook-strip")!;
    const cards = Array.from(strip.querySelectorAll<HTMLElement>(".scrapbook-strip-item"));
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    let visible = false, width = strip.clientWidth, raf = 0, previous = 0;
    const draw = () => {
      const mobile = width < 700;
      const stride = width / (mobile ? 3.8 : 7.3);
      cards.forEach((card, index) => {
        const position = ((index - stripPhase.current + cards.length / 2) % cards.length + cards.length) % cards.length - cards.length / 2;
        const normal = position * stride / (width / 2);
        const bend = Math.min(1.3, Math.abs(normal));
        const x = position * stride * (1 + .15 * normal * normal);
        card.style.transform = `translate(-50%, -50%) translateX(${x}px) perspective(900px) rotateY(${-normal * 32}deg) scale(${.88 + .64 * bend * bend})`;
        card.style.visibility = Math.abs(x) > width * .72 ? "hidden" : "visible";
      });
    };
    const tick = (now: number) => {
      raf = 0;
      if (!visible || motion.matches || document.hidden || paused || selected !== null || stripHeld.current) { previous = 0; return; }
      if (previous) stripPhase.current = (stripPhase.current + Math.min(50, now - previous) / 4200) % cards.length;
      previous = now;
      draw();
      raf = requestAnimationFrame(tick);
    };
    const update = () => {
      strip.dataset.curved = String(!motion.matches);
      if (motion.matches) cards.forEach(card => { card.style.removeProperty("transform"); card.style.removeProperty("visibility"); });
      else draw();
      if (!raf) raf = requestAnimationFrame(tick);
    };
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; update(); });
    observer.observe(strip);
    const resize = new ResizeObserver(() => { width = strip.clientWidth; update(); });
    resize.observe(strip);
    strip.addEventListener("pointerenter", update);
    strip.addEventListener("pointerleave", update);
    strip.addEventListener("focusin", update);
    strip.addEventListener("focusout", update);
    motion.addEventListener("change", update);
    document.addEventListener("visibilitychange", update);
    update();
    return () => { cancelAnimationFrame(raf); observer.disconnect(); resize.disconnect(); motion.removeEventListener("change", update); document.removeEventListener("visibilitychange", update); ["pointerenter", "pointerleave", "focusin", "focusout"].forEach(event => strip.removeEventListener(event, update)); };
  }, [moments, paused, selected]);

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
      const context = gsap.context(() => {
        gsap.fromTo(".scrapbook-line > span", { yPercent: 110, rotate: 3 }, {
          yPercent: 0, rotate: 0, duration: 1.15, stagger: .12, ease: "power4.out",
          scrollTrigger: { trigger: ".scrapbook-heading", start: "top 86%", once: true },
        });

      }, el);
      return () => context.revert();
    });
    return () => media.revert();
  }, []);

  return (
    <section className="travel-scrapbook" id="collected-moments" ref={root} aria-labelledby="scrapbook-heading" data-paused={paused || selected !== null}>
      <div className="scrapbook-topline"><span>MY LIFE, COLLECTED.</span><button className="scrapbook-motion-toggle" onClick={() => setPaused(value => !value)} aria-pressed={paused}>{paused ? <Play size={12} /> : <Pause size={12} />}{paused ? "Resume films & strip" : "Pause films & strip"}</button></div>
        <header className="scrapbook-heading">
          <span className="scrapbook-overline">THE SOUVENIRS THAT MATTER</span>
          <h2 id="scrapbook-heading" className="scrapbook-title"><span className="scrapbook-line"><span>I GO PLACES.</span></span><span className="scrapbook-line"><span>THEY STAY <em>WITH ME.</em></span></span></h2>
          <a className="scrapbook-link" href="/photography">Open the visual journal <span><ArrowUpRight size={18} /></span></a>
          <p>A road. A face. A few seconds I wish lasted longer. Little pieces of my world, brought home.</p>
        </header>
      <div className="scrapbook-strips" aria-label="A moving collection from my trips">
        <div className="scrapbook-strip" onPointerEnter={() => { stripHeld.current = true; }} onPointerLeave={() => { stripHeld.current = false; }} onFocus={() => { stripHeld.current = true; }} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) stripHeld.current = false; }}>
          <div className="scrapbook-strip-track"><div className="scrapbook-strip-group">
            {Array.from({ length: Math.max(9, moments.length) }, (_, slot) => {
              const index = slot % moments.length;
              const frame = moments[index];
              if (!frame) return null;
              return <button className="scrapbook-strip-item" key={`${slot}-${frame.id}`} onClick={() => setSelected(index)} tabIndex={slot >= moments.length ? -1 : undefined} aria-hidden={slot >= moments.length ? true : undefined} inert={slot >= moments.length ? true : undefined} aria-label={`Open ${frame.kind}: ${frame.title} · ${frame.tripTitle}`}>
                {frame.kind === "film" ? <AutoFilm frame={frame} paused={paused || selected !== null} /> : <Image src={frame.preview} alt={frame.title} fill sizes="(max-width:700px) 160px, 260px" unoptimized={!frame.sample} loading="lazy" />}
              </button>;
            })}
          </div></div>
        </div>
      </div>
      <div className="scrapbook-endnote"><span aria-hidden="true">✳</span><p>Not everything fits in a suitcase.</p><span>Keep the feeling.</span></div>
      <footer className="scrapbook-bottomline"><span>{moments.some(frame => frame.sample) ? "ILLUSTRATIVE COLLECTION · SAMPLE PHOTOS & FILMS" : "FROM THE PUBLIC JOURNAL"}</span><span>MORE ROADS. MORE STORIES. ↓</span></footer>
      {current && <Modal title={current.title} className="scrapbook-viewer" onClose={() => setSelected(null)}>
        <div className="scrapbook-viewer-media">{current.kind === "film" ? <video key={current.id} src={current.src} poster={current.preview} controls autoPlay muted playsInline preload="metadata" /> : <Image key={current.id} src={current.src} alt={current.title} width={1600} height={1200} unoptimized />}</div>
        <div className="scrapbook-viewer-bar"><div><h3>{current.title}</h3><p>{current.sample ? "Illustrative sample · Not a personal travel record" : "From my published collection"}</p></div><div className="scrapbook-viewer-nav"><button onClick={() => next(-1)} aria-label="Previous moment"><ArrowLeft size={20} /></button><span>{String(selected! + 1).padStart(2, "0")} / {String(moments.length).padStart(2, "0")}</span><button onClick={() => next(1)} aria-label="Next moment"><ArrowRight size={20} /></button></div></div>
      </Modal>}
    </section>
  );
}
