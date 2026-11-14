"use client";
import { KineticHeading } from "./EditorialElements";
import { ArrowUpRight, ArrowUp } from "lucide-react";
import { useLenis } from "lenis/react";
import { ChapterLabel } from "./primitives";
import { returnToDoor } from "./navigation";
export default function Beyond() {
  const lenis = useLenis();
  return (
    <section id="beyond" className="world-beyond world-scene">
      <div className="world-section-bar">
        <ChapterLabel number="06">Home, again</ChapterLabel>
        <span className="world-eyebrow">The last mile brings you home.</span>
      </div>
      <div className="beyond-door" aria-hidden="true">
        <div className="door-leaf" />
        <span />
      </div>
      <div className="beyond-words" data-world-reveal>
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

    </section>
  );
}
