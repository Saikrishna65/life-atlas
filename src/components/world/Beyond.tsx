"use client";
import { ArrowUpRight, ArrowUp } from "lucide-react";
import { useLenis } from "lenis/react";
import { ChapterLabel } from "./primitives";
import { returnToDoor } from "./navigation";
export default function Beyond() {
  const lenis = useLenis();
  return (
    <section id="beyond" className="world-beyond world-scene">
      <div className="world-section-bar">
        <ChapterLabel number="09">The Beyond</ChapterLabel>
        <span className="world-eyebrow">There is always another door.</span>
      </div>
      <div className="beyond-door" aria-hidden="true">
        <div />
        <span />
      </div>
      <div className="beyond-words" data-world-reveal>
        <p className="world-eyebrow">The world doesn’t end here.</p>
        <h2>
          Neither does
          <br />
          <em>your story.</em>
        </h2>
        <p>
          Keep moving. Keep noticing.
          <br />
          Keep a little of the world with you.
        </p>
        <a className="world-button light" href="#expeditions">
          Find your next beginning <ArrowUpRight size={17} />
        </a>
        <button className="world-link" onClick={() => returnToDoor(lenis)}>
          Return to the door <ArrowUp size={16} />
        </button>
      </div>
      <footer className="world-colophon">
        <div>
          <strong>LIFE ATLAS</strong>
          <span>A world worth remembering.</span>
        </div>
        <p>
          Public demonstration. Imagined stories.
          <br />
          Made for the endlessly curious.
        </p>
        <div>
          <a href="/about">About the atlas ↗</a>
          <a href="/images/world/LICENSES.txt" target="_blank" rel="noreferrer">
            Image credits ↗
          </a>
          <span>© 2026 LIFE ATLAS</span>
        </div>
      </footer>
    </section>
  );
}
