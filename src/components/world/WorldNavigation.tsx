"use client";
import Image from "next/image";
import { useEffect, useState } from "react";
import { ArrowUpRight, Compass, Menu } from "lucide-react";
import { useLenis } from "lenis/react";
import { Modal } from "./primitives";
import { navigateChapter, returnToDoor } from "./navigation";
export const chapters = [
  ["observatory", "The Observatory"],
  ["on-the-road", "The art of going"],
  ["expeditions", "The Expeditions"],
  ["memories", "The Memory Archive"],
  ["beyond", "The Beyond"],
];
export default function WorldNavigation() {
  const [active, setActive] = useState("observatory");
  const [visible, setVisible] = useState(false);
  const [open, setOpen] = useState(false);
  const lenis = useLenis();
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
        { threshold: 0, rootMargin: `0px 0px -${height - 1}px 0px` },
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
        className={`world-nav ${visible ? "is-visible" : ""}`}
        inert={!visible}
      >
        <button
          className="world-wordmark atlas-logo-brand"
          aria-label="Life Atlas home"
          onClick={() => navigate("top")}
        >
          <Image
            src="/brand/life-atlas-black.png"
            width={84}
            height={56}
            sizes="84px"
            alt=""
          />
        </button>
        <div className="world-nav-links">
          {[
            ["observatory", "Discover"],
            ["expeditions", "Journeys"],
            ["memories", "Frames & films"],
          ].map(([id, name]) => (
            <button
              key={id}
              onClick={() => navigate(id)}
              aria-current={active === id ? "location" : undefined}
            >
              {name}
            </button>
          ))}
        </div>
        <button
          className="world-nav-explore"
          onClick={() => setOpen(true)}
          aria-expanded={open}
          aria-controls="world-chapter-menu"
        >
          The atlas <Compass size={16} />
        </button>
        <button
          className="world-nav-mobile world-icon"
          onClick={() => setOpen(true)}
          aria-label="Open chapter menu"
          aria-expanded={open}
        >
          <Menu size={22} />
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
