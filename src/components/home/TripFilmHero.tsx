"use client";
import PublicPageReady, {usePublicLoading} from "@/components/layout/PublicPageReady";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { heroTypography } from "@/lib/public-fonts";
import { HERO_RELEASE_MS } from "./hero-playback";
import TripFilmStage from "./TripFilmStage";
import { ObservatoryInstrument } from "./AtlasObjects";
import HeroGalleryPreview from "./HeroGalleryPreview";
import Image from "next/image";
import {
  ArrowRight,
  ArrowUpRight,
  Pause,
  Play,
} from "lucide-react";
import gsap from "gsap";
import type { HeroTrip, HeroGalleryPhoto } from "@/lib/public-trips/types";
import "./trip-film-hero.css";



export default function TripFilmHero({ trips, galleryPhotos }: { trips: HeroTrip[]; galleryPhotos: HeroGalleryPhoto[] }) {
  const publicLoading=usePublicLoading();
  const [active, setActive] = useState(0);
  const [requested, setRequested] = useState(0);
  const [outgoing, setOutgoing] = useState<number | null>(null);
  const [queued, setQueued] = useState<number | null>(null);
  const queuedRequest = useRef<number | null>(null);
  const [manualPlay, setManualPlay] = useState(false);
  const [tabVisible, setTabVisible] = useState(true);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(true);
  const [visible, setVisible] = useState(true);
  const [failed, setFailed] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [menu, setMenu] = useState(false);

  const root = useRef<HTMLElement>(null);
  const heading = useRef<HTMLDivElement>(null);
  const progress = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const changed = (event: Event) => setMenu(Boolean((event as CustomEvent<boolean>).detail));
    window.addEventListener("atlas-navigation-open", changed);
    return () => window.removeEventListener("atlas-navigation-open", changed);
  }, []);

  const current = trips[active];
  const playing =
    !publicLoading &&
    !paused &&
    (!reduced || manualPlay) &&
    visible &&
    tabVisible &&
    !menu &&
    !blocked;
  const choose = (index: number) => {
    if (!trips[active]?.video || !trips[index]?.video) { setActive(index); setRequested(index); setOutgoing(null); return; }
    if (outgoing !== null) {
      queuedRequest.current = index;
      setQueued(index);
    } else setRequested(index);
    setBlocked(false);
    setFailed(false);
  };
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => setReduced(media.matches);
    const initial = setTimeout(change, 0);
    media.addEventListener("change", change);
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { threshold: 0.15 },
    );
    if(root.current)observer.observe(root.current);
    const visibility = () => setTabVisible(!document.hidden);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      clearTimeout(initial);
      media.removeEventListener("change", change);
      observer.disconnect();
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);
  useEffect(() => {
    if (outgoing === null) return;
    const timer = setTimeout(
      () => {
        setOutgoing(null);
        if (queuedRequest.current !== null) {
          setRequested(queuedRequest.current);
          queuedRequest.current = null;
          setQueued(null);
        }
      },
      reduced ? 0 : HERO_RELEASE_MS,
    );
    return () => clearTimeout(timer);
  }, [outgoing, reduced]);
  useEffect(() => {
    if (reduced || publicLoading) return;
    const context = gsap.context(() => {
      gsap.fromTo(
        heading.current?.children ?? [],
        { y: 36, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.8, stagger: 0.08, ease: "power3.out" },
      );
    }, root);
    return () => context.revert();
  }, [active, reduced, publicLoading]);
  if (!current) return <section ref={root} className={`${heroTypography.variable} trip-film-hero`} data-hero aria-label="Life Atlas"><PublicPageReady /><div className="trip-film-main"><p className="trip-film-eyebrow">Life Atlas</p><h1>My world.<br />In the making.</h1><p>My journeys will appear here when I publish them.</p><Link className="trip-film-cta" href="/trips"><span>Explore my journal</span><ArrowRight size={17}/></Link></div></section>;
  return (
    <section
      ref={root}
      className={`${heroTypography.variable} trip-film-hero`}
      data-hero
      aria-label="Latest trip films"
      onKeyDown={(e) => {
        if ((e.target as HTMLElement).closest("dialog")) return;
        if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
          e.preventDefault();
          setPaused(true);
          choose(
            (active + (e.key === "ArrowRight" ? 1 : -1) + trips.length) %
              trips.length,
          );
        }
      }}
    >
      <PublicPageReady />
      {current.video ? <TripFilmStage
        films={trips.map(trip=>({src:trip.video||"",poster:trip.image,fallback:""}))}
        active={active}
        outgoing={outgoing}
        requested={requested}
        count={trips.length}
        playing={playing}
        reduced={reduced}
        onReveal={(index) => {
          if (index !== active) {
            setOutgoing(active);
            setActive(index);
          }
        }}
        onProgress={(value) => {
          if (progress.current)
            progress.current.style.transform = `scaleX(${value})`;
        }}
        onEnd={() => {
          if (trips.length > 1) choose((active + 1) % trips.length);
        }}
        onStatus={(status) => {
          setFailed(status === "failed");
          setBlocked(status === "blocked");
          if (status === "failed") {
            setRequested(active);
            setPaused(true);
          }
        }}
      /> : <div className="trip-film-stage">{current.image && <Image src={current.image} alt="" fill sizes="100vw" priority unoptimized style={{objectFit:"cover"}}/>}</div>}
      <div className="trip-film-main" ref={heading} key={current.id}>
        <p className="trip-film-eyebrow">
          From my latest journeys / 0
          {active + 1}
        </p>
        <h1>
          <Link prefetch={publicLoading?false:null} href={`/trips/${current.slug}`}>
            {current.title
              .split(" ")
              .slice(0, Math.ceil(current.title.split(" ").length / 2))
              .join(" ")}
            <br />
            {current.title
              .split(" ")
              .slice(Math.ceil(current.title.split(" ").length / 2))
              .join(" ")}
            .
          </Link>
        </h1>
        <Link prefetch={publicLoading?false:null} className="trip-film-cta" href={`/trips/${current.slug}`}>
          <span>Explore this trip</span>
          <ArrowRight size={17} />
        </Link>
      </div>
      <aside className="trip-film-discover" aria-label="More to discover">
        <Link prefetch={publicLoading?false:null} href="/explore" className="trip-film-aside-label">
          Explore <ArrowRight size={20} />
        </Link>
        <Link prefetch={publicLoading?false:null} className="trip-film-journal-tile" href="/photography" aria-label="Photo Gallery">
          <HeroGalleryPreview photos={galleryPhotos} trips={trips} />
          <span className="hero-card-arrow">
            <ArrowUpRight size={17} />
          </span>
        </Link>
        <Link
              prefetch={publicLoading?false:null}
          className="trip-film-photo-tile trip-film-globe-tile"
          href="/#observatory"
        >
          <ObservatoryInstrument />
          <span className="hero-card-arrow">
            <ArrowUpRight size={17} />
          </span>
          <span>Explore the Globe</span>
        </Link>
        <Link prefetch={publicLoading?false:null} className="trip-film-world-link" href={`/trips/${trips[0].slug}`}>
          <span className="trip-film-latest-image">
            {trips[0].image && <Image src={trips[0].image} alt="" fill sizes="120px" unoptimized />}
          </span>
          <span className="trip-film-world-copy">
            <small className="trip-film-card-eyebrow">
              Latest trip
            </small>
            <strong>{trips[0].title}</strong>
            <small>Follow the route. Open the journal.</small>
          </span>
          <ArrowRight size={22} />
        </Link>
      </aside>
      <footer className="trip-film-footer">
        <div
          className="trip-film-selectors"
          role="group"
          aria-label="Select a trip film"
        >
          {trips.map((trip, i) => (
            <button
              key={trip.id}
              aria-pressed={active === i}
              aria-label={`Show trip ${i + 1}: ${trip.title}`}
              aria-busy={(requested === i && active !== i) || queued === i}
              onClick={() => {
                setPaused(false);
                choose(i);
              }}
            >
              {trip.image && <span className="trip-film-thumbnail">
                <Image
                  src={trip.image}
                  alt=""
                  fill
                  sizes="105px"
                  unoptimized
                />
              </span>
              }<span className="trip-film-selector-copy">
                <small>0{i + 1}</small>
                <span>{trip.title}</span>
              </span>
              {i === active && (
                <span className="trip-film-progress">
                  <span key={active} ref={progress} />
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="trip-film-footer-note">
        {current.video && <button
          className="trip-film-round"
          aria-label={
            paused || (reduced && !manualPlay) || blocked
              ? "Play trip films"
              : "Pause trip films"
          }
          aria-pressed={paused || (reduced && !manualPlay) || blocked}
          onClick={() => {
            if (paused || (reduced && !manualPlay) || blocked) {
              setPaused(false);
              setManualPlay(true);
              setBlocked(false);
            } else setPaused(true);
          }}
        >
          {paused || (reduced && !manualPlay) || blocked ? (
            <Play size={15} />
          ) : (
            <Pause size={15} />
          )}
        </button>}

          <span role="status">
            {failed ? "Film unavailable · explore the journey" : current.video ? "Published trip film" : "From my travel journal"}
          </span>
          <a href="#observatory">Scroll to explore ↓</a>
        </div>
      </footer>

    </section>
  );
}
