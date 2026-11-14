"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ArrowUpRight, Compass, Pause, Play } from "lucide-react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useLenis } from "lenis/react";
import type { FeaturedJourney as Journey, JourneyChapter } from "@/lib/public-trips/featured-journey";
import { usePublicCatalog } from "./usePublicCatalog";
import { Modal } from "./primitives";
import "./featured-journey.css";

const RouteMap = dynamic(() => import("./FeaturedJourneyMap"), { ssr: false, loading: () => <div className="featured-map-empty"><Compass size={40} strokeWidth={.6} /><p>Unfolding the map…</p></div> });

function JourneyFilm({ src, poster, paused }: { src: string; poster: string; paused: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = ref.current!;
    let visible = false;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      if (visible && !paused && !document.hidden && !motion.matches) {
        if (!video.hasAttribute("src")) video.src = src;
        void video.play().catch(() => { /* The poster is the playback fallback. */ });
      } else video.pause();
    };
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; update(); }, { threshold: .15 });
    observer.observe(video);
    motion.addEventListener("change", update);
    document.addEventListener("visibilitychange", update);
    return () => { observer.disconnect(); video.pause(); motion.removeEventListener("change", update); document.removeEventListener("visibilitychange", update); };
  }, [src, paused]);
  return <video ref={ref} poster={poster} muted autoPlay loop playsInline preload="none" aria-hidden="true" />;
}

export default function FeaturedJourney({ journey }: { journey: Journey }) {
  const root = useRef<HTMLElement>(null);
  const lenis = useLenis();
  const { catalog } = usePublicCatalog();
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [opened, setOpened] = useState<JourneyChapter | null>(null);
  const films = useMemo(() => (catalog?.items ?? []).filter(item => item.category === "expedition" && item.mimeType.startsWith("video/") && [journey.slug.toLowerCase(), journey.title.toLowerCase()].includes(item.collection.trim().toLowerCase())), [catalog, journey]);
  const coverFilm = films[0]?.url || journey.chapters.find(chapter => chapter.film)?.film;
  const chapters = useMemo(() => journey.chapters.map(chapter => ({ ...chapter, film: films.find(film => film.tags.some(tag => tag.toLowerCase() === chapter.place.toLowerCase()))?.url || chapter.film })), [journey, films]);
  const go = (index: number) => {
    const target = root.current?.querySelector<HTMLElement>(`[data-journey-stop="${index}"]`);
    if (!target) return;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (lenis) lenis.scrollTo(target.getBoundingClientRect().top + scrollY - 150, { duration: 1.3, immediate: reduce });
    else window.scrollTo({ top: target.getBoundingClientRect().top + scrollY - 150, behavior: reduce ? "instant" : "smooth" });
    setActive(index);
  };
  useEffect(() => {
    const nodes = Array.from(root.current!.querySelectorAll<HTMLElement>("[data-journey-stop]"));
    let observer: IntersectionObserver;
    const connect = () => {
      observer?.disconnect();
      const height = window.innerHeight;
      observer = new IntersectionObserver(() => {
        const line = window.innerHeight * .4;
        const current = nodes.find(node => { const rect = node.getBoundingClientRect(); return rect.top <= line && rect.bottom > line; });
        if (current) setActive(Number(current.dataset.journeyStop));
      }, { rootMargin: `-${Math.round(height * .25)}px 0px -${Math.round(height * .45)}px 0px` });
      nodes.forEach(el => observer.observe(el));
    };
    connect();
    window.addEventListener("resize", connect);
    return () => { observer.disconnect(); window.removeEventListener("resize", connect); };
  }, []);
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      const context = gsap.context(() => {
        gsap.fromTo(".featured-cover-window", { clipPath: "inset(8% 9% 8% 9% round 28px)" }, { clipPath: "inset(0% 0% 0% 0% round 0px)", ease: "none", scrollTrigger: { trigger: ".featured-cover", start: "top 95%", end: "top top", scrub: 1 } });
        gsap.fromTo(".featured-cover-media", { scale: 1.15 }, { scale: 1, ease: "none", scrollTrigger: { trigger: ".featured-cover", start: "top bottom", end: "bottom top", scrub: 1.2 } });
        gsap.to(".featured-cover-heading", { yPercent: -16, ease: "none", scrollTrigger: { trigger: ".featured-cover", start: "top top", end: "bottom top", scrub: 1 } });
        gsap.fromTo(root.current, { "--journey-route-progress": .02 }, { "--journey-route-progress": 1, ease: "none", scrollTrigger: { trigger: ".featured-story", start: "top 65%", end: "bottom 80%", scrub: .8 } });
        gsap.utils.toArray<HTMLElement>(".featured-stop-photo img, .featured-stop-photo video").forEach(image => gsap.fromTo(image, { yPercent: -6, scale: 1.12 }, { yPercent: 6, scale: 1.12, ease: "none", scrollTrigger: { trigger: image.parentElement, start: "top bottom", end: "bottom top", scrub: 1 } }));
      }, root);
      return () => context.revert();
    });
    return () => media.revert();
  }, []);

  return <section ref={root} id="on-the-road" className="featured-journey" aria-labelledby="featured-journey-title">
    <header className="featured-cover">
      <div className="featured-cover-window"><div className="featured-cover-media">{coverFilm ? <JourneyFilm src={coverFilm} poster={journey.image} paused={paused || !!opened} /> : <Image src={journey.image} alt="" fill sizes="100vw" unoptimized={!journey.sample} loading="lazy" />}</div><div className="featured-cover-shade" /></div>
      <div className="featured-cover-top"><span>03 / THE JOURNEY BEHIND THE MOMENTS</span>{coverFilm && <button onClick={() => setPaused(value => !value)} aria-pressed={paused}>{paused ? <Play size={12} /> : <Pause size={12} />}{paused ? "Resume film" : "Pause film"}</button>}</div>
      <div className="featured-cover-heading"><span className="featured-eyebrow">ONE JOURNEY. A THOUSAND REASONS TO REMEMBER.</span><h2 id="featured-journey-title">BEYOND<br /><em>THE FRAME.</em></h2></div>
      <div className="featured-cover-bottom"><div><span className="featured-eyebrow">{journey.sample ? "AN ILLUSTRATIVE JOURNEY" : "FROM MY TRAVEL JOURNAL"}</span><h3>{journey.title}</h3><p>{journey.region}</p></div><button className="featured-follow" onClick={() => go(0)}>Follow the journey <span><ArrowDown size={19} /></span></button></div>
    </header>
    <div className="featured-introduction"><p className="featured-eyebrow">THE PLACES BETWEEN THE PICTURES</p><h3>Some roads stay<br /><em>with me.</em></h3><div><p>{journey.intro}</p><div className="featured-trip-facts"><span>{journey.duration}</span><span>{chapters.length} stops</span>{journey.distance !== null && <span>{journey.distance.toLocaleString(undefined, { maximumFractionDigits: 1 })} km</span>}{journey.altitude !== null && <span>{journey.altitude.toLocaleString()} m highest</span>}</div></div></div>
    <div className="featured-story">
      <aside className="featured-map-column" aria-label="Journey route and chapter navigation"><div className="featured-map-sticky">
        <div className="featured-map-top"><span>THE WAY THERE</span><span>{String(active + 1).padStart(2, "0")} / {String(chapters.length).padStart(2, "0")}</span></div>
        <div className="featured-map-surface"><RouteMap journey={journey} active={active} onSelect={go} /><span className="featured-map-north" aria-hidden="true"><Compass size={34} strokeWidth={.8} />N</span></div>
        <div className="featured-map-caption"><span>{journey.sample ? "SYNTHETIC SAMPLE ROUTE · NOT RECORDED TRAVEL" : journey.paths.length ? "PUBLISHED GPS TRACK · RECORDING GAPS PRESERVED" : "PUBLISHED PLACES · NO GPS TRACK AVAILABLE"}</span><p>{chapters[active]?.place}</p></div>
        <nav className="featured-stop-nav" aria-label="Journey stops">{chapters.map((chapter, index) => <button key={chapter.id} onClick={() => go(index)} aria-current={active === index ? "step" : undefined}><span>{String(index + 1).padStart(2, "0")}</span>{chapter.place}</button>)}</nav>
      </div></aside>
      <div className="featured-stop-sequence">{chapters.map((chapter, index) => <article className="featured-stop" key={chapter.id} data-journey-stop={index} data-active={active === index}>
        <div className="featured-stop-top"><span>{chapter.day}</span><span>{chapter.place}</span></div>
        <button className="featured-stop-photo" onClick={() => setOpened(chapter)} aria-label={`Open ${chapter.film ? "film" : "photo"} from ${chapter.place}`}>{chapter.film ? <JourneyFilm src={chapter.film} poster={chapter.image} paused={paused || !!opened} /> : <Image src={chapter.image} alt={chapter.illustrativeMedia ? `Illustrative landscape for ${chapter.place}` : chapter.place} fill sizes="(max-width: 800px) 90vw, 43vw" unoptimized={!chapter.illustrativeMedia} loading="lazy" />}<span className="featured-photo-open"><ArrowUpRight size={20} /></span></button>
        <div className="featured-stop-copy"><span className="featured-stop-number">{String(index + 1).padStart(2, "0")}</span><div><h3>{chapter.title}</h3><p>{chapter.description}</p>{chapter.illustrativeMedia && <small>Illustrative landscape {chapter.film ? "& film study" : "study"}</small>}</div></div>
      </article>)}</div>
    </div>
    <footer className="featured-outro"><span className="featured-eyebrow">THAT WAS ONLY A GLIMPSE.</span><h3>There’s a whole<br /><em>journey inside.</em></h3><Link href={`/trips/${journey.slug}`} className="featured-journey-link">Explore this journey <ArrowUpRight size={22} /></Link><p>{journey.sample ? "Sample itinerary, illustrative media and synthetic route. Not a record of personal travel." : "The full itinerary, photographs and published route from this trip."}</p></footer>
    {opened && <Modal title={opened.place} className="featured-journey-viewer" onClose={() => setOpened(null)}>{opened.film ? <video src={opened.film} poster={opened.image} autoPlay muted playsInline controls /> : <Image src={opened.image} alt={opened.place} width={1600} height={1100} unoptimized />}<h3>{opened.place}</h3><p>{opened.illustrativeMedia ? "Illustrative sample media" : journey.title}</p></Modal>}
  </section>;
}
