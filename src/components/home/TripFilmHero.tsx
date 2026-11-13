"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Cormorant_Garamond } from "next/font/google";
import Image from "next/image";
import {
  ArrowRight,
  ArrowUpRight,
  Compass,
  Menu,
  Pause,
  Play,
} from "lucide-react";
import gsap from "gsap";
import { heroFilms, type HeroTrip } from "@/data/demo/hero-films";
import { Modal } from "@/components/world/primitives";
import "./trip-film-hero.css";

const heroSerif = Cormorant_Garamond({
  subsets: ["latin"],
  weight: "300",
  variable: "--font-trip-serif",
  display: "swap",
});

export default function TripFilmHero({ trips }: { trips: HeroTrip[] }) {
  const [active, setActive] = useState(0);
  const [previous, setPrevious] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(true);
  const [visible, setVisible] = useState(true);
  const [fallback, setFallback] = useState(false);
  const [failed, setFailed] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [menu, setMenu] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const root = useRef<HTMLElement>(null);
  const heading = useRef<HTMLDivElement>(null);
  const progress = useRef<HTMLSpanElement>(null);
  const advancing = useRef(false);
  const current = trips[active];
  const film = heroFilms[active % heroFilms.length];
  const choose = (index: number) => {
    if (index === active) return;
    advancing.current = false;
    setPrevious(active);
    setActive(index);
    setFallback(false);
    setFailed(false);
    setBlocked(false);
  };
  useEffect(() => {
    const timer = setTimeout(
      () => setReduced(matchMedia("(prefers-reduced-motion: reduce)").matches),
      0,
    );
    return () => clearTimeout(timer);
  }, []);
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => setReduced(media.matches);
    media.addEventListener("change", change);
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { threshold: 0.15 },
    );
    observer.observe(root.current!);
    const visibility = () => {
      if (document.hidden) video.current?.pause();
      else if (!paused && !media.matches && visible && !menu)
        void video.current?.play().catch(() => setBlocked(true));
    };
    document.addEventListener("visibilitychange", visibility);
    return () => {
      media.removeEventListener("change", change);
      observer.disconnect();
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [paused, visible, menu]);
  useEffect(() => {
    const element = video.current;
    if (!element) return;
    if (paused || reduced || !visible || menu || document.hidden)
      element.pause();
    else void element.play().catch(() => setBlocked(true));
  }, [active, paused, reduced, visible, fallback, menu]);
  useEffect(() => {
    if (reduced) return;
    const context = gsap.context(() => {
      gsap.fromTo(
        heading.current?.children ?? [],
        { y: 36, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.8, stagger: 0.08, ease: "power3.out" },
      );
    }, root);
    return () => context.revert();
  }, [active, reduced]);
  if (!current) return null;
  return (
    <section
      ref={root}
      className={`${heroSerif.variable} trip-film-hero`}
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
      <div className="trip-film-stage" aria-hidden="true">
        {previous !== null && (
          <Image
            key={`previous-${previous}`}
            className="trip-film-outgoing"
            src={heroFilms[previous % 3].poster}
            alt=""
            fill
            sizes="100vw"
            unoptimized
          />
        )}
        <video
          ref={video}
          key={`${active}-${fallback}`}
          src={fallback ? film.fallback : film.src}
          poster={film.poster}
          muted
          playsInline
          preload={reduced ? "none" : "metadata"}
          disablePictureInPicture
          tabIndex={-1}
          onError={() => {
            if (!fallback) setFallback(true);
            else {
              setFailed(true);
              setPaused(true);
            }
          }}
          onPlaying={() => setBlocked(false)}
          onTimeUpdate={(e) => {
            const v = e.currentTarget;
            const duration = Math.min(v.duration || 10, 10);
            if (progress.current)
              progress.current.style.transform = `scaleX(${Math.min(1, v.currentTime / duration)})`;
            if (
              v.currentTime >= duration &&
              !paused &&
              !reduced &&
              trips.length > 1 &&
              !advancing.current
            ) {
              advancing.current = true;
              choose((active + 1) % trips.length);
            }
          }}
          onEnded={() => {
            if (!paused && !reduced && trips.length > 1)
              choose((active + 1) % trips.length);
          }}
        />
        <div className="trip-film-shade" />
      </div>
      <header className="trip-film-header">
        <button
          className="trip-film-round"
          aria-label={
            paused || reduced || blocked
              ? "Play trip films"
              : "Pause trip films"
          }
          aria-pressed={paused || reduced || blocked}
          onClick={() => {
            if (paused || reduced || blocked) {
              setPaused(false);
              setReduced(false);
              void video.current
                ?.play()
                .then(() => setBlocked(false))
                .catch(() => setBlocked(true));
            } else setPaused(true);
          }}
        >
          {paused || reduced || blocked ? (
            <Play size={15} />
          ) : (
            <Pause size={15} />
          )}
        </button>
        <nav className="trip-film-navigation" aria-label="Hero navigation">
          <div>
            <Link href="/trips">The journeys</Link>
            <Link href="/places">The places</Link>
            <Link href="/photography">Frames & films</Link>
          </div>
          <Link
            className="trip-film-brand"
            href="/"
            aria-label="Life Atlas home"
          >
            <Compass size={27} strokeWidth={1} />
            <span>
              LIFE
              <br />
              ATLAS
            </span>
          </Link>
          <div>
            <Link href="/map">The world</Link>
            <Link href="/timeline">Our timeline</Link>
            <Link href="/about">The story</Link>
          </div>
        </nav>
        <button
          className="trip-film-round"
          aria-label="Open atlas menu"
          aria-expanded={menu}
          onClick={() => setMenu(true)}
        >
          <Menu size={17} />
        </button>
      </header>
      <div className="trip-film-main" ref={heading} key={current.id}>
        <p className="trip-film-eyebrow">
          {current.sample ? "A sample journey" : "From the latest journeys"} / 0
          {active + 1}
        </p>
        <h1>
          <Link href={`/trips/${current.slug}`}>{current.title}.</Link>
        </h1>
        <Link className="trip-film-cta" href={`/trips/${current.slug}`}>
          <span>Discover the journey</span>
          <ArrowRight size={17} />
        </Link>
      </div>
      <aside className="trip-film-discover" aria-label="More to discover">
        <div className="trip-film-aside-label">
          A little further <ArrowRight size={18} />
        </div>
        <div className="trip-film-discover-pair">
          <Link href="/trips">
            <Image
              src="/images/world/ridge-small.webp"
              alt=""
              fill
              sizes="170px"
            />
            <span>
              All journeys <ArrowUpRight size={15} />
            </span>
          </Link>
          <Link href="/photography">
            <Image
              src="/images/world/valley-small.webp"
              alt=""
              fill
              sizes="170px"
            />
            <span>
              The visual journal <ArrowUpRight size={15} />
            </span>
          </Link>
        </div>
        <Link className="trip-film-world-link" href="/#observatory">
          <span className="trip-film-orbit">
            <Compass size={44} strokeWidth={0.6} />
          </span>
          <span>
            <strong>A world of stories.</strong>
            <small>Find a place. Follow a feeling.</small>
          </span>
          <ArrowUpRight size={18} />
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
              onClick={() => {
                setPaused(false);
                choose(i);
              }}
            >
              <span className="trip-film-thumbnail">
                <Image
                  src={heroFilms[i % 3].poster}
                  alt=""
                  fill
                  sizes="105px"
                  unoptimized
                />
              </span>
              <span className="trip-film-selector-copy">
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
          <span role="status">
            {failed
              ? "Video unavailable · explore the journey"
              : fallback
                ? "Local motion study · stock video unavailable"
                : "Stock films / illustrative footage"}
          </span>
          <a href="/films/hero-credits.txt" target="_blank" rel="noreferrer">
            Credits ↗
          </a>
          <a href="#observatory">Scroll to explore ↓</a>
        </div>
      </footer>
      {menu && (
        <Modal
          title="Explore Life Atlas"
          className="world-chapter-dialog"
          onClose={() => setMenu(false)}
        >
          <nav className="public-menu">
            {[
              ["/trips", "The journeys"],
              ["/places", "The places"],
              ["/photography", "Frames & films"],
              ["/map", "The world"],
              ["/about", "The story"],
            ].map(([href, label]) => (
              <Link href={href} key={href} onClick={() => setMenu(false)}>
                {label}
                <ArrowUpRight size={24} />
              </Link>
            ))}
          </nav>
        </Modal>
      )}
    </section>
  );
}
