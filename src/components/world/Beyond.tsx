"use client";
import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { KineticHeading } from "./EditorialElements";
import { ArrowUpRight, ArrowUp } from "lucide-react";
import { useLenis } from "lenis/react";
import { returnToDoor } from "./navigation";
import "./beyond.css";
export default function Beyond() {
  const lenis = useLenis();
  const root = useRef<HTMLElement>(null);
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const media = gsap.matchMedia();
    media.add('(prefers-reduced-motion:no-preference)', () => {
      const section = root.current!;
      const leaf = section.querySelector<HTMLElement>('.door-leaf')!;
      const frame = section.querySelector<HTMLElement>('.beyond-door')!;
      const state = {closed:0};
      const draw = () => {
        const angle = 72 * (1-state.closed);
        // Projected doorway aperture: continuous and tied to the leaf's angle.
        const light = (1-Math.cos(angle*Math.PI/180))/(1-Math.cos(72*Math.PI/180));
        section.style.setProperty('--beyond-light',String(light));
        section.style.setProperty('--beyond-darkness',String(1-light));
        section.dataset.closure = state.closed.toFixed(4);
        const night = light < .45 ? 'true' : 'false';
        if(section.dataset.night !== night) section.dataset.night = night;
        leaf.style.transform = `rotateY(${-angle}deg)`;
        frame.style.transform = `translateX(-50%) translateY(${(1-state.closed)*35}px) scale(${.92+.08*state.closed})`;
      };
      const animation = gsap.to(state,{closed:1,ease:'none',onUpdate:draw,scrollTrigger:{trigger:section,start:'top 50%',end:'bottom bottom',scrub:.9,invalidateOnRefresh:true}});
      draw();
      return () => {
        animation.scrollTrigger?.kill(); animation.kill();
        section.style.removeProperty('--beyond-light');section.style.removeProperty('--beyond-darkness');delete section.dataset.closure;delete section.dataset.night;
        leaf.style.removeProperty('transform');frame.style.removeProperty('transform');
      };
    });
    return () => media.revert();
  }, []);
  return (
    <section id="beyond" ref={root} className="world-beyond world-scene beyond-physical">
      <div className="beyond-stage">
      <div className="beyond-room-depth" aria-hidden="true" />
      <div className="beyond-contact-shadow" aria-hidden="true" />
      <div className="beyond-room-shadow" aria-hidden="true" />
      <div className="beyond-door" aria-hidden="true">
        <div className="door-leaf" />
        <span />
      </div>
      <div className="beyond-words">
        <p className="world-eyebrow">The journey settles. The memories stay.</p>
        <KineticHeading
          lines={["Back where you belong.", <em key="story">With a world inside you.</em>]}
        />
        <p>
          The bags are down. The door closes.
          <br />
          And a little of the road comes home with you.
        </p>
        <a className="world-button light" href="#memories">
          Find your next beginning <ArrowUpRight size={17} />
        </a>
        <button className="world-link" onClick={() => returnToDoor(lenis)}>
          Start another journey <ArrowUp size={16} />
        </button>
      </div>
      </div>
    </section>
  );
}
