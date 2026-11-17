"use client";
import PublicPageReady from "@/components/layout/PublicPageReady";
import {onPublicPreload} from "@/lib/public-loading/readiness";
import dynamic from "next/dynamic";
import { Suspense, useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import type {PeoplePhoto} from "@/data/demo/people";
import type { TripArchiveEntry } from "@/lib/public-trips/archive";
import type { ScrapbookFrame } from "@/lib/public-trips/scrapbook";
import { useLenis } from "lenis/react";
import { navigateChapter } from "./navigation";
import WorldNavigation, { chapters } from "./WorldNavigation";
import WorldMotion from "./WorldMotion";
import SceneBoundary from "./SceneBoundary";
import "./world.css";
import "./observatory.css";
const pendingChapter = () => <span hidden data-public-ready="pending" />;
const Observatory = dynamic(() => import("./Observatory"), {loading:pendingChapter});
const TravelScrapbook = dynamic(() => import("./TravelScrapbook"), {loading:pendingChapter});
const PeopleMoments = dynamic(() => import("./PeopleMoments"), {loading:pendingChapter});
const TripArchive = dynamic(() => import("./TripArchive"), {loading:pendingChapter});
const PublishedMedia = dynamic(() => import("./PublishedMedia"), {loading:pendingChapter});
const Beyond = dynamic(() => import("./Beyond"), {loading:pendingChapter});
function ChapterLoading({ id, title }: { id: string; title: string }) {
  return (
    <section id={id} className="world-scene world-loading" data-public-ready="pending" aria-label={title}>
      <span className="world-eyebrow">The next chapter</span>
      <h2>{title}</h2>
      <p>Keep wandering. A new world is coming into view.</p>
    </section>
  );
}
function Deferred({
  id,
  title,
  component: Component,
  children,
}: {
  id: string;
  title: string;
  component?: ComponentType;
  children?: ReactNode;
}) {
  const [ready, setReady] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const releasePreload = onPublicPreload(() => setReady(true));
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setReady(true);
          io.disconnect();
        }
      },
      { rootMargin: "900px" },
    );
    io.observe(el);
    const hash = () => {
      if (location.hash === `#${id}`) setReady(true);
    };
    hash();
    window.addEventListener("hashchange", hash);
    const request = (e: Event) => {
      if ((e as CustomEvent<string>).detail === id) setReady(true);
    };
    window.addEventListener("world-chapter-request", request);
    const activate = (e: MouseEvent) => {
      const link = (e.target as HTMLElement).closest<HTMLAnchorElement>(
        "a[href]",
      );
      if (link?.hash === `#${id}`) setReady(true);
    };
    document.addEventListener("click", activate);
    return () => {
      io.disconnect();
      releasePreload();
      window.removeEventListener("hashchange", hash);
      window.removeEventListener("world-chapter-request", request);
      document.removeEventListener("click", activate);
    };
  }, [id]);
  return (
    <div ref={ref} className="world-deferred" data-chapter={id}>
      {ready ? (
        <SceneBoundary id={id} title={title}>
          <Suspense fallback={<ChapterLoading id={id} title={title} />}>
            {children ?? (Component ? <Component /> : null)}
          </Suspense>
        </SceneBoundary>
      ) : (
        <ChapterLoading id={id} title={title} />
      )}
    </div>
  );
}
export default function LivingWorld({ scrapbookMedia = [], trips, peoplePhotos, curatedRibbon=false,curatedArchive=false }: { scrapbookMedia?: ScrapbookFrame[]; trips: TripArchiveEntry[]; peoplePhotos?:PeoplePhoto[];curatedRibbon?:boolean;curatedArchive?:boolean }) {
  const lenis = useLenis();
  useEffect(() => {
    const alignHash = () => {
      const id = ["#expeditions", "#on-the-road"].includes(location.hash) ? "memories" : location.hash.slice(1);
      if (id === "place-browser")
        window.dispatchEvent(new CustomEvent("world-chapter-request", { detail: "observatory" }));
      if (id === "place-browser" || chapters.some(([chapter]) => chapter === id))
        void navigateChapter(id, lenis, true);
    };
    // Let the router finish its initial focus/scroll pass before aligning a deep link.
    const frame = requestAnimationFrame(alignHash);
    const enterChapter = (event: MouseEvent) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as HTMLElement).closest<HTMLAnchorElement>("a[href]");
      if (!link || link.closest("#living-world") || link.target === "_blank" || link.hasAttribute("download")) return;
      const url = new URL(link.href, location.href);
      const id = url.hash.slice(1);
      if (url.origin !== location.origin || url.pathname !== location.pathname || !chapters.some(([chapter]) => chapter === id)) return;
      // Hero links live outside the world container. Use its existing Lenis engine,
      // rather than letting the router reset scroll while the chapter is deferred.
      event.preventDefault();
      void navigateChapter(id, lenis);
    };
    document.addEventListener("click", enterChapter, true);
    window.addEventListener("hashchange", alignHash);
    window.addEventListener("atlas-public-ready", alignHash);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("click", enterChapter, true);
      window.removeEventListener("hashchange", alignHash);
      window.removeEventListener("atlas-public-ready", alignHash);
    };
  }, [lenis]);
  return (
    <div
      id="living-world"
      className="living-world"
      onClick={(e) => {
        const link = (e.target as HTMLElement).closest<HTMLAnchorElement>(
          'a[href^="#"]',
        );
        if (link && link.hash) {
          e.preventDefault();
          void navigateChapter(link.hash.slice(1), lenis);
        }
      }}
    >
      <PublicPageReady />
      <WorldNavigation showPeople={peoplePhotos===undefined||peoplePhotos.length>0} showRibbon={!curatedRibbon||scrapbookMedia.length>0} />
      <WorldMotion>
        <Deferred
          id="observatory"
          title="The Observatory"
          component={Observatory}
        />
        {(!curatedRibbon||scrapbookMedia.length>0)&&<Deferred
          id="collected-moments"
          title="Life, collected"
        ><TravelScrapbook media={scrapbookMedia} curated={curatedRibbon} /></Deferred>}
        {(peoplePhotos===undefined||peoplePhotos.length>0)&&<Deferred id="people" title="The people along the way"><PeopleMoments photos={peoplePhotos} /></Deferred>}
        <Deferred id="memories" title="The Trip Archive"><TripArchive trips={trips} curated={curatedArchive} /></Deferred>
        <Suspense fallback={null}><PublishedMedia /></Suspense>
        <Deferred id="beyond" title="The Beyond" component={Beyond} />
      </WorldMotion>
      <noscript>
        The interactive chapters require JavaScript. Life Atlas is a fictional
        public collection of travel, places, and memories.
      </noscript>
    </div>
  );
}
