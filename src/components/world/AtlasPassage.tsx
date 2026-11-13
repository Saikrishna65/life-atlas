"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ArrowUpRight, Play } from "lucide-react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useLenis } from "lenis/react";
import { Modal } from "./primitives";

const scenes = [
  {
    name: "The beginning",
    title: "Leave the familiar.",
    image: "valley",
    description:
      "An early start. A road you don’t know yet. That feeling that anything could happen.",
    link: "/trips",
    action: "Find a journey",
  },
  {
    name: "The detour",
    title: "Follow your wonder.",
    image: "ridge",
    description:
      "Take the turn that wasn’t on the plan. The best part of a journey rarely comes with directions.",
    link: "/places",
    action: "Explore the places",
  },
  {
    name: "The feeling",
    title: "Keep more than a photo.",
    image: "ocean",
    description:
      "The wind, the laughter, the pause before the view. Some moments need to move.",
    link: "/photography",
    action: "Open the journal",
  },
];
export default function AtlasPassage() {
  const root = useRef<HTMLElement>(null);
  const [film, setFilm] = useState(false);
  const lenis = useLenis();
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const media = gsap.matchMedia();
    media.add(
      "(prefers-reduced-motion: no-preference) and (min-width: 701px)",
      () => {
        const el = root.current!;
        el.dataset.motion = "true";
        const panels = el.querySelectorAll<HTMLElement>(".passage-scene");
        const tabs = el.querySelectorAll<HTMLButtonElement>(
          ".passage-chapters button",
        );
        const progress = el.querySelector(".passage-progress span");
        let active = -1;
        const render = (value: number) => {
          const index = Math.min(2, Math.floor(value * 3));
          if (active !== index) {
            active = index;
            panels.forEach((panel, i) => {
              panel.dataset.active = String(i === index);
              panel.inert = i !== index;
              panel.setAttribute("aria-hidden", String(i !== index));
            });
            tabs.forEach((tab, i) =>
              tab.setAttribute("aria-pressed", String(i === index)),
            );
          }
          gsap.set(progress, { scaleX: value });
        };
        const trigger = ScrollTrigger.create({
          trigger: el,
          start: "top top",
          end: "bottom bottom",
          onUpdate: (self) => render(self.progress),
        });
        render(trigger.progress);
        return () => {
          trigger.kill();
          delete el.dataset.motion;
          panels.forEach((p) => {
            delete p.dataset.active;
            p.inert = false;
            p.removeAttribute("aria-hidden");
          });
          tabs.forEach((tab) => tab.removeAttribute("aria-pressed"));
          gsap.set(progress, { clearProps: "transform" });
        };
      },
    );
    return () => media.revert();
  }, []);
  const navigate = (index: number) => {
    const el = root.current!;
    const target = el.dataset.motion
      ? el.getBoundingClientRect().top +
        window.scrollY +
        (el.offsetHeight - window.innerHeight) * ((index + 0.1) / 3)
      : el
          .querySelectorAll<HTMLElement>(".passage-scene")
          [index].getBoundingClientRect().top +
        window.scrollY -
        80;
    if (lenis)
      lenis.scrollTo(target, {
        duration: 1.2,
        immediate: matchMedia("(prefers-reduced-motion: reduce)").matches,
      });
    else
      window.scrollTo({
        top: target,
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      });
  };
  return (
    <section
      className="atlas-passage"
      id="on-the-road"
      ref={root}
      aria-label="The art of going"
    >
      <div className="passage-sticky">
        <div className="passage-scene-stack">
          {scenes.map((scene, i) => (
            <article className="passage-scene" key={scene.name}>
              <Image
                src={`/images/world/${scene.image}.webp`}
                alt=""
                fill
                sizes="100vw"
                loading="lazy"
              />
              <div className="passage-shade" />
              <div className="passage-copy">
                <span className="world-eyebrow">
                  THE ART OF GOING / 0{i + 1}
                </span>
                <h2>{scene.title}</h2>
                <p>{scene.description}</p>
                <a className="passage-link" href={scene.link}>
                  {scene.action}
                  <ArrowUpRight size={18} />
                </a>
                {i === 2 && (
                  <button
                    className="passage-film"
                    onClick={() => setFilm(true)}
                  >
                    <Play size={15} /> Watch a motion study <span>00:06</span>
                  </button>
                )}
              </div>
              <span className="passage-study">
                ILLUSTRATIVE LANDSCAPE STUDY
              </span>
            </article>
          ))}
        </div>
        <nav
          className="passage-chapters"
          aria-label="Journey storytelling chapters"
        >
          {scenes.map((scene, i) => (
            <button key={scene.name} onClick={() => navigate(i)}>
              <small>0{i + 1}</small>
              {scene.name}
              <ArrowUpRight size={15} />
            </button>
          ))}
        </nav>
        <div className="passage-progress" aria-hidden="true">
          <span />
        </div>
      </div>
      {film && (
        <Modal
          title="Coastal motion study"
          className="atlas-film-dialog"
          onClose={() => setFilm(false)}
        >
          <video
            controls
            playsInline
            preload="metadata"
            poster="/images/world/ocean-small.webp"
            src="/films/coastal-study.mp4"
          />
          <p>
            Six-second silent landscape animation. An illustrative motion study,
            not recorded travel footage.
          </p>
        </Modal>
      )}
    </section>
  );
}
