"use client";
import dynamic from "next/dynamic";
import { Suspense, useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import type { ScrapbookFrame } from "@/lib/public-trips/scrapbook";
import { useLenis } from "lenis/react";
import { navigateChapter } from "./navigation";
import WorldNavigation, { chapters } from "./WorldNavigation";
import WorldMotion from "./WorldMotion";
import SceneBoundary from "./SceneBoundary";
import "./world.css";
import "./observatory.css";
const AtlasPassage = dynamic(() => import("./AtlasPassage"));
const Observatory = dynamic(() => import("./Observatory"));
const TravelScrapbook = dynamic(() => import("./TravelScrapbook"));
const Expeditions = dynamic(() => import("./Expeditions"));
const MemoryArchive = dynamic(() => import("./MemoryArchive"));
const PublishedMedia = dynamic(() => import("./PublishedMedia"));
const Beyond = dynamic(() => import("./Beyond"));
function ChapterLoading({ id, title }: { id: string; title: string }) {
  return (
    <section id={id} className="world-scene world-loading" aria-label={title}>
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
export default function LivingWorld({ scrapbookMedia = [] }: { scrapbookMedia?: ScrapbookFrame[] }) {
  const lenis = useLenis();
  useEffect(() => {
    const alignHash = () => {
      const id = location.hash.slice(1);
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
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("click", enterChapter, true);
      window.removeEventListener("hashchange", alignHash);
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
      <WorldNavigation />
      <WorldMotion>
        <Deferred
          id="observatory"
          title="The Observatory"
          component={Observatory}
        />
        <Deferred
          id="collected-moments"
          title="Life, collected"
        ><TravelScrapbook media={scrapbookMedia} /></Deferred>
        <Deferred
          id="on-the-road"
          title="The art of going"
          component={AtlasPassage}
        />
        <Deferred
          id="expeditions"
          title="The Expeditions"
          component={Expeditions}
        />
        <Deferred
          id="memories"
          title="The Memory Archive"
          component={MemoryArchive}
        />
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
