"use client";
import HeroLogo from "@/components/home/HeroLogo";
import Link from "next/link";
import { Plus_Jakarta_Sans } from "next/font/google";
import { useEffect, useState } from "react";
import { ArrowUpRight, Search, Menu } from "lucide-react";
import { useLenis } from "lenis/react";
import { Modal } from "./primitives";
import { navigateChapter, returnToDoor } from "./navigation";
const typography = Plus_Jakarta_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-world-navigation", display: "swap" });
export const chapters = [
  ["observatory", "The Observatory"],
  ["collected-moments", "Life, collected"],
  ["on-the-road", "Beyond the frame"],
  ["memories", "The Trip Archive"],
  ["beyond", "The Beyond"],
];
export default function WorldNavigation() {
  const [active, setActive] = useState("observatory");
  const [visible, setVisible] = useState(false);
  const [open, setOpen] = useState(false);
  const lenis = useLenis();
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("atlas-navigation-open", { detail: open }));
    return () => { window.dispatchEvent(new CustomEvent("atlas-navigation-open", { detail: false })); };
  }, [open]);
  useEffect(() => {
    const root = document.getElementById("living-world");
    if (!root) return;
    // IntersectionObserver percentage margins resolve against width. Use actual
    // viewport heights so chapter visibility also works on ultrawide displays.
    let visibility: IntersectionObserver;
    let observer: IntersectionObserver;
    const connect = () => {
      visibility?.disconnect();
      observer?.disconnect();
      const height = window.innerHeight;
      visibility = new IntersectionObserver(
        ([entry]) => setVisible(entry.isIntersecting),
        { threshold: 0, rootMargin: `0px 0px ${100 - height}px 0px` },
      );
      visibility.observe(root);
      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries)
            if (entry.isIntersecting) setActive(entry.target.id);
        },
        { rootMargin: `-${height * 0.15}px 0px -${height * 0.55}px 0px` },
      );
      observeChapters();
    };
    const observeChapters = () =>
      chapters.forEach(([id]) => {
        const e = document.getElementById(id);
        if (e) observer.observe(e);
      });
    connect();
    window.addEventListener("resize", connect);
    const mutation = new MutationObserver(observeChapters);
    mutation.observe(root, { childList: true, subtree: true });
    return () => {
      window.removeEventListener("resize", connect);
      visibility.disconnect();
      observer.disconnect();
      mutation.disconnect();
    };
  }, []);
  const navigate = (id: string) => {
    setOpen(false);
    if (id !== "top") {
      void navigateChapter(id, lenis);
      return;
    }
    returnToDoor(lenis, 1.4);
  };
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  return (
    <>
      <a className="world-skip" href="#observatory">
        Skip to the journeys
      </a>
      <nav
        aria-label="World chapters"
        data-scene={visible ? active : "hero"}
        className={`${typography.variable} world-nav reference-world-nav is-visible`}
      >
        <button className="reference-nav-round" aria-label="Search the atlas" onClick={() => window.dispatchEvent(new Event("open-search"))}>
          <Search size={17} />
        </button>
        <div className="reference-nav-center">
          <div className="reference-nav-pill">
            <Link href="/trips">The journeys</Link>
            <Link href="/places">The places</Link>
            <Link href="/photography">Frames &amp; films</Link>
          </div>
          <button className="reference-nav-brand" aria-label="Life Atlas home" onClick={() => navigate("top")}>
            <HeroLogo />
          </button>
          <div className="reference-nav-pill">
            <button onClick={() => navigate("observatory")}>The world</button>
            <Link href="/timeline">Our timeline</Link>
            <Link href="/about">The story</Link>
          </div>
        </div>
        <button className="reference-nav-round" aria-label="The atlas" onClick={() => setOpen(true)} aria-expanded={open} aria-controls="world-chapter-menu">
          <Menu size={17} />
        </button>
      </nav>
      {open && (
        <Modal
          title="Where shall we go?"
          className="world-chapter-dialog"
          onClose={() => setOpen(false)}
        >
          <div className="world-chapter-menu" id="world-chapter-menu">
            {chapters.map(([id, label], i) => (
              <button key={id} onClick={() => navigate(id)}>
                <small>0{i + 2}</small>
                <span>{label}</span>
                <ArrowUpRight size={20} />
              </button>
            ))}
            <p>Take the long way. There’s no wrong turn.</p>
          </div>
        </Modal>
      )}
      <aside
        className={`world-progress ${visible ? "is-visible" : ""}`}
        aria-label="Current chapter"
        data-scene={active}
      >
        <span>
          {String(chapters.findIndex(([id]) => id === active) + 2).padStart(
            2,
            "0",
          )}
        </span>
        <div>
          {chapters.map(([id, label]) => (
            <button
              key={id}
              aria-label={`Go to ${label}`}
              aria-current={active === id ? "location" : undefined}
              onClick={() => navigate(id)}
            />
          ))}
        </div>
        <span>{String(chapters.length + 1).padStart(2, "0")}</span>
      </aside>
    </>
  );
}
