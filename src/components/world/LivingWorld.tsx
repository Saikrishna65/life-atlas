"use client";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState, type ComponentType } from "react";
import { useLenis } from "lenis/react";
import { navigateChapter } from "./navigation";
import WorldNavigation from "./WorldNavigation";
import WorldMotion from "./WorldMotion";
import SceneBoundary from "./SceneBoundary";
import "./world.css";
const Observatory = dynamic(() => import("./Observatory"));
const Expeditions = dynamic(() => import("./Expeditions"));
const MemoryArchive = dynamic(() => import("./MemoryArchive"));
const PublishedMedia = dynamic(() => import("./PublishedMedia"));
const Beyond = dynamic(() => import("./Beyond"));
function Deferred({
  id,
  title,
  component: Component,
}: {
  id: string;
  title: string;
  component: ComponentType;
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
          <Component />
        </SceneBoundary>
      ) : (
        <section
          id={id}
          className="world-scene world-loading"
          aria-label={title}
        >
          <span className="world-eyebrow">The next chapter</span>
          <h2>{title}</h2>
          <p>Keep wandering. A new world is coming into view.</p>
        </section>
      )}
    </div>
  );
}
export default function LivingWorld() {
  const lenis = useLenis();
  useEffect(() => {
    if (lenis && location.hash)
      void navigateChapter(location.hash.slice(1), lenis, true);
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
          id="expeditions"
          title="The Expeditions"
          component={Expeditions}
        />
        <Deferred
          id="memories"
          title="The Memory Archive"
          component={MemoryArchive}
        />
        <PublishedMedia />
        <Deferred id="beyond" title="The Beyond" component={Beyond} />
      </WorldMotion>
      <noscript>
        The interactive chapters require JavaScript. Life Atlas is a fictional
        public collection of travel, places, and memories.
      </noscript>
    </div>
  );
}
