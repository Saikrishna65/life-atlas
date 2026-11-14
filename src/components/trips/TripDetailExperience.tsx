"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUpRight, Compass, Pause, Play, Plus, Minus } from "lucide-react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useLenis } from "lenis/react";
import type { DetailMedia, TripDetailData } from "@/lib/public-trips/detail";
import { mediaForTrip, mediaKind } from "@/lib/r2/public-media";
import { usePublicCatalog } from "@/components/world/usePublicCatalog";
import { Modal } from "@/components/world/primitives";
import WorldMotion from "@/components/world/WorldMotion";
import { KineticHeading, RouteDrawing } from "@/components/world/EditorialElements";
import DetailFilm from "./DetailFilm";
import "@/components/world/world.css";
import "./trip-detail.css";

const RouteMap = dynamic(() => import("./GeographicRouteMap"), { ssr: false, loading: () => <div className="td-map-loading"><Compass size={44} strokeWidth={.7} /><span>Unfolding the route…</span></div> });
const dateLabel = (date: string) => new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(date));

export default function TripDetailExperience({ trip }: { trip: TripDetailData }) {
  const root = useRef<HTMLDivElement>(null);
  const mapStage = useRef<HTMLDivElement>(null);
  const lenis = useLenis();
  const { catalog, error } = usePublicCatalog();
  const [mapReady, setMapReady] = useState(false);
  const [stop, setStop] = useState(trip.stops[0]?.id);
  const [day, setDay] = useState(0);
  const [paused, setPaused] = useState(false);
  const [place, setPlace] = useState("All places");
  const [kind, setKind] = useState("All media");
  const [category, setCategory] = useState("All categories");
  const [limit, setLimit] = useState(18);
  const [selected, setSelected] = useState<string | null>(null);
  const [zoom, setZoom] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const media = useMemo<DetailMedia[]>(() => {
    const published = mediaForTrip(catalog?.items ?? [], trip.slug, trip.title).map(item => ({
      id: `published-${item.id}`, url: item.url, poster: item.thumbnailUrl, kind: mediaKind(item.mimeType),
      caption: item.title || undefined, place: item.tags.find(tag => tag.startsWith("place:"))?.slice(6).trim() || "Unassigned", category: "Published media",
    }));
    return [...new Map([...published, ...trip.media].map(item => [`${item.kind}:${item.place}:${item.url}`, item])).values()];
  }, [catalog, trip]);
  const visible = media.filter(item => (place === "All places" || item.place === place) && (kind === "All media" || (kind === "Films" ? item.kind === "video" : item.kind === "photo")) && (category === "All categories" || item.category === category));
  const currentIndex = visible.findIndex(item => item.id === selected);
  const current = visible[currentIndex];
  const activeStop = trip.stops.find(item => item.id === stop);
  const entry = trip.days[day];
  const coverFilm = media.find(item => !trip.media.some(local => local.id === item.id) && item.kind === "video")?.url || trip.coverFilm;
  const go = (id: string) => {
    const target = root.current?.querySelector<HTMLElement>(`#${CSS.escape(id)}`);
    if (!target) return;
    const top = scrollY + target.getBoundingClientRect().top - 110;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (lenis) lenis.scrollTo(top, { duration: 1.25, immediate: reduce });
    else window.scrollTo({ top, behavior: reduce ? "instant" : "smooth" });
    history.replaceState(null, "", `#${id}`);
  };
  const chooseDay = (index: number) => {
    setDay(index);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const target = root.current?.querySelector<HTMLElement>(".td-day");
      if (!target) return;
      const top = scrollY + target.getBoundingClientRect().top - 120;
      const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (lenis) lenis.scrollTo(top, { duration: .85, immediate: reduce });
      else window.scrollTo({ top, behavior: reduce ? "instant" : "smooth" });
    }));
  };
  const navigateMedia = (delta: number) => { setSelected(visible[(currentIndex + delta + visible.length) % visible.length]?.id ?? null); setZoom(false); setFailed(null); };
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { setMapReady(true); observer.disconnect(); } }, { rootMargin: "500px" });
    if (mapStage.current) observer.observe(mapStage.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    let contrast: IntersectionObserver;
    const connect = () => {
      contrast?.disconnect();
      contrast = new IntersectionObserver(([entry]) => { if (root.current) root.current.dataset.lightNav = String(entry.isIntersecting); }, { rootMargin: `-20px 0px -${Math.max(0, innerHeight - 90)}px 0px` });
      const paper = root.current?.querySelector(".td-itinerary");
      if (paper) contrast.observe(paper);
    };
    connect();
    window.addEventListener("resize", connect);
    return () => { contrast.disconnect(); window.removeEventListener("resize", connect); };
  }, []);
  useEffect(() => {
    if (!selected) return;
    const key = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement).closest("video, input, select, textarea")) return;
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        setSelected(visible[(currentIndex + (event.key === "ArrowRight" ? 1 : -1) + visible.length) % visible.length]?.id ?? null);
        setZoom(false); setFailed(null);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [selected, visible, currentIndex]);
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const responsive = gsap.matchMedia();
    responsive.add("(prefers-reduced-motion: no-preference)", () => {
      const context = gsap.context(() => {
        gsap.fromTo(".td-title-line > span", { yPercent: 105, rotate: 3 }, { yPercent: 0, rotate: 0, stagger: .09, duration: 1.1, ease: "power4.out" });
        gsap.to(".td-cover-media", { yPercent: 18, scale: 1.12, ease: "none", scrollTrigger: { trigger: ".td-cover", start: "top top", end: "bottom top", scrub: 1 } });
        gsap.to(".td-cover-copy", { y: -65, ease: "none", scrollTrigger: { trigger: ".td-cover", start: "top top", end: "bottom top", scrub: 1 } });
        gsap.fromTo(".td-next-image", { clipPath: "inset(18% 12% round 20px)" }, { clipPath: "inset(0% 0% round 0px)", ease: "none", scrollTrigger: { trigger: ".td-ending", start: "top 90%", end: "center 70%", scrub: 1 } });
      }, root);
      return () => context.revert();
    });
    return () => responsive.revert();
  }, []);

  return <div ref={root} className="living-world trip-detail-v3">
    <WorldMotion>
      <header className="td-cover" data-hero aria-label="Trip hero">
        <div className="td-cover-media">{coverFilm ? <DetailFilm src={coverFilm} poster={trip.cover} paused={paused || !!current} label="Trip cover film" /> : trip.cover ? <Image src={trip.cover} alt="" fill sizes="100vw" priority unoptimized={!trip.sample} /> : <div className="td-cover-art"><Compass size={360} strokeWidth={.15} /></div>}</div><div className="td-cover-shade" />
        <div className="td-cover-top"><Link href="/#memories"><ArrowLeft size={14} /> Back to my journeys</Link><div className="td-cover-tools"><span>{trip.sample ? "ILLUSTRATIVE TRAVEL JOURNAL" : trip.date ? dateLabel(trip.date) : "MY TRAVEL JOURNAL"}</span>{coverFilm && <button className="td-film-toggle" onClick={() => setPaused(value => !value)} aria-pressed={paused} aria-label={paused ? "Resume trip films" : "Pause trip films"}>{paused ? <Play size={14} /> : <Pause size={14} />}{paused ? "Resume films" : "Pause films"}</button>}</div></div>
        <div className="td-cover-copy"><span className="td-eyebrow">{trip.region}</span><h1>{trip.title.split(/\s+/).map((word, index) => <span className="td-title-line" key={index}><span>{word} </span></span>)}</h1></div>
        <div className="td-cover-bottom"><div><span>{trip.duration}</span><i /><span>{trip.stops.length} {trip.sample ? "sample stops" : "published stops"}</span><i /><span>{media.length} frames & films</span></div><button onClick={() => go("route")} className="td-circle-link">Follow the journey <span><ArrowDown size={20} /></span></button></div>
      </header>
      <section className="td-prologue"><span className="td-eyebrow">A CHAPTER FROM MY ATLAS</span><p data-world-reveal>{trip.overview}</p>{trip.sample && <small>Sample itinerary, illustrative photography and films. The route is synthetic, not recorded personal travel.</small>}</section>
      <section className="td-route td-section" id="route">
        <header className="td-section-heading" data-world-reveal><div><span className="td-eyebrow">01 / THE WAY THERE</span><KineticHeading lines={["Every bend.", <em key="line">Part of the story.</em>]} /></div><span className="td-section-note">{trip.sample ? "A GEOGRAPHIC ROUTE STUDY" : trip.paths.length ? "FROM THE PUBLISHED GPS RECORDING" : "THE PUBLISHED PLACES"}</span></header>
        <div className="td-map-layout"><div className="td-map-stage" ref={mapStage}>{mapReady && (trip.paths.length || trip.stops.length) ? <RouteMap stops={trip.stops} paths={trip.paths} illustrative={trip.sample} activeId={stop} onSelect={setStop} /> : <div className="td-map-loading"><Compass size={45} strokeWidth={.7} /><p>{trip.paths.length || trip.stops.length ? "The map opens as you approach." : "No GPS track or geographic stops have been published yet."}</p></div>}</div>
          <aside className="td-route-aside"><span className="td-eyebrow">PLACES ALONG THE WAY</span><nav aria-label="Choose a route stop">{trip.stops.map((item, index) => <button key={item.id} onClick={() => setStop(item.id)} aria-pressed={stop === item.id}><small>{String(index + 1).padStart(2, "0")}</small><span>{item.name}</span><ArrowUpRight size={17} /></button>)}</nav>{activeStop && <div className="td-place-note" key={activeStop.id}><span>IN FOCUS</span><h3>{activeStop.name}</h3>{activeStop.description && <p>{activeStop.description}</p>}</div>}{!trip.paths.length && !trip.sample && <p className="td-muted">No recorded route was published. Stops are shown without inventing a travelled path.</p>}</aside>
        </div>
        {!!trip.metrics.length && <dl className="td-metrics">{trip.metrics.map(metric => <div key={metric.label}><dt>{metric.label}</dt><dd>{metric.value}<span>{metric.unit}</span></dd></div>)}</dl>}
      </section>
      <section className="td-itinerary td-section" id="itinerary"><header className="td-section-heading" data-world-reveal><div><span className="td-eyebrow">02 / THE DAYS IN BETWEEN</span><KineticHeading lines={["One day.", <em key="day">A world of its own.</em>]} /></div><span className="td-section-note">{trip.sample ? "DETAILED SAMPLE SCHEDULE" : "FROM THE TRIP ITINERARY"}</span></header>
        {entry ? <div className="td-day-layout"><aside><div className="td-day-index"><strong>{String(trip.days.length).padStart(2, "0")}</strong><span>DAYS IN THIS JOURNAL</span></div><nav aria-label="Itinerary days">{trip.days.map((item,index) => <button key={item.id} aria-pressed={index === day} onClick={() => chooseDay(index)}><small>{String(item.day).padStart(2,"0")}</small><span>{item.title}</span><ArrowUpRight size={15} /></button>)}</nav><label className="td-day-select"><span>Choose a day</span><select value={day} onChange={event => chooseDay(Number(event.target.value))} aria-label="Choose itinerary day">{trip.days.map((item,index) => <option key={item.id} value={index}>Day {item.day} — {item.title}</option>)}</select></label></aside>
          <article className="td-day" key={entry.id}><div className="td-day-top"><span>DAY {String(entry.day).padStart(2,"0")}</span><span>{entry.date ? dateLabel(entry.date) : entry.place}</span></div><h3>{entry.title}</h3><p className="td-day-intro">{entry.description}</p>{entry.overnight && <p className="td-overnight">EXAMPLE OVERNIGHT / {entry.overnight}</p>}<ol className="td-day-beats">{entry.beats.map((beat,index) => <li key={`${beat.time}-${index}`}><time>{beat.time}</time><span className="td-beat-dot" /><div><span>{beat.kind}</span><h4>{beat.title}</h4><p>{beat.description}</p></div></li>)}</ol><div className="td-day-controls"><button onClick={() => chooseDay(day - 1)} disabled={day === 0}><ArrowLeft size={17} /> Previous day</button><span>{day + 1} / {trip.days.length}</span><button onClick={() => chooseDay(day + 1)} disabled={day === trip.days.length - 1}>Next day <ArrowRight size={17} /></button></div></article>
        </div> : <p className="td-empty">The itinerary hasn’t been published yet. The route and journal remain here to explore.</p>}
      </section>
      <section className="td-journal td-section" id="photo-journal"><RouteDrawing variant="memory" /><header className="td-section-heading" data-world-reveal><div><span className="td-eyebrow">03 / FRAMES & FILMS</span><KineticHeading lines={["The things", <em key="frames">I brought home.</em>]} /></div><span className="td-section-note">{visible.length} MOMENTS / {trip.sample ? "ILLUSTRATIVE COLLECTION" : "THE PUBLIC JOURNAL"}</span></header>
        <div className="td-journal-toolbar"><nav aria-label="Filter journal by place">{["All places", ...new Set(media.map(item => item.place))].map(value => <button key={value} aria-pressed={place === value} onClick={() => { setPlace(value); setLimit(18); setSelected(null); }}>{value}</button>)}</nav><div className="td-media-filters"><div aria-label="Journal media type">{["All media", "Photos", "Films"].map(value => <button key={value} aria-pressed={kind === value} onClick={() => { setKind(value); setLimit(18); setSelected(null); }}>{value}</button>)}</div><label><span className="sr-only">Filter journal category</span><select aria-label="Filter journal category" value={category} onChange={event => { setCategory(event.target.value); setLimit(18); setSelected(null); }}>{["All categories", ...new Set(media.map(item => item.category))].map(value => <option key={value}>{value}</option>)}</select></label></div></div>
        {error && <p role="status" className="td-muted">Published media is temporarily unavailable. The existing trip journal remains accessible.</p>}
        <div className="td-photo-wall">{visible.slice(0,limit).map((item,index) => <button key={item.id} className={`td-frame td-frame-${index % 6}`} data-world-tilt onClick={() => { setSelected(item.id); setZoom(false); setFailed(null); }} aria-label={`Open ${item.kind === "video" ? "film" : "photo"} ${index + 1} from ${item.place}`}><div data-tilt-plane>{item.kind === "video" ? <DetailFilm src={item.url} poster={item.poster} paused={paused || !!current} label={`Silent film from ${item.place}`} /> : <Image src={item.poster || item.url} alt={`Trip photograph from ${item.place}`} width={1400} height={1000} loading="lazy" sizes="(max-width: 700px) 90vw, 50vw" unoptimized />}</div></button>)}</div>
        {!visible.length && <div className="td-empty"><p>No media matches this selection.</p>{!!media.length && <button onClick={() => { setPlace("All places"); setKind("All media"); setCategory("All categories"); }}>Reset journal filters <ArrowRight size={16} /></button>}</div>}
        <div className="td-journal-foot"><span aria-live="polite">{Math.min(limit, visible.length)} / {visible.length} MOMENTS</span>{limit < visible.length && <button onClick={() => setLimit(value => value + 18)}>Unfold more <Plus size={16} /></button>}</div>
      </section>
      <section className="td-ending"><span className="td-eyebrow">THE LAST FRAME. ANOTHER BEGINNING.</span><h2>The road<br /><em>goes on.</em></h2>{trip.next ? <Link className="td-next" href={`/trips/${trip.next.slug}`}>{trip.next.image && <div className="td-next-image"><Image src={trip.next.image} alt="" fill sizes="(max-width: 700px) 85vw, 50vw" loading="lazy" unoptimized /></div>}<span>NEXT JOURNAL</span><h3>{trip.next.title}</h3><span className="td-next-arrow"><ArrowUpRight size={28} /></span></Link> : <Link href="/#memories" className="td-all-journeys">Back to my journeys <ArrowUpRight size={20} /></Link>}<div className="td-ending-links"><Link href="/#memories">All journeys <ArrowUpRight size={15} /></Link><button onClick={() => { if (lenis) lenis.scrollTo(0, { immediate: matchMedia("(prefers-reduced-motion: reduce)").matches }); else window.scrollTo({ top: 0, behavior: "smooth" }); }}>Back to the beginning <ArrowUpRight size={15} /></button></div></section>
    </WorldMotion>
    {current && <Modal title={current.place === "Unassigned" ? "From the trip journal" : current.place} className="td-viewer" onClose={() => { setSelected(null); setZoom(false); }}><div className={`td-viewer-media ${zoom ? "is-zoomed" : ""}`}>{current.kind === "video" ? <video key={current.id} src={current.url} poster={current.poster} autoPlay muted playsInline controls onError={() => setFailed(current.id)} /> : <Image key={current.id} src={current.url} alt={current.caption || `Trip photograph from ${current.place}`} width={1600} height={1100} unoptimized />}</div>{failed === current.id && <p role="status">This film could not be loaded. <a href={current.url} target="_blank" rel="noreferrer">Open the original ↗</a></p>}<div className="td-viewer-details"><div><span>{current.category}</span><h3>{current.place}</h3>{current.caption && <p>{current.caption}</p>}{trip.sample && <p>Illustrative sample media, not a personal travel record.</p>}</div><div className="td-viewer-tools">{current.kind === "photo" && <button aria-label={zoom ? "Zoom out" : "Zoom in"} aria-pressed={zoom} onClick={() => setZoom(value => !value)}>{zoom ? <Minus size={18} /> : <Plus size={18} />}</button>}<button onClick={() => navigateMedia(-1)} aria-label="Previous journal moment"><ArrowLeft size={19} /></button><span>{currentIndex + 1} / {visible.length}</span><button onClick={() => navigateMedia(1)} aria-label="Next journal moment"><ArrowRight size={19} /></button></div></div></Modal>}
  </div>;
}
