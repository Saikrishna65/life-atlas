"use client";
import { useState } from "react";
import { ArrowDownRight, Plus, X } from "lucide-react";
import { ChapterLabel } from "./primitives";
const points = [
  {
    name: "A world to discover",
    text: "Thirty-six destinations. Twenty-four imagined journeys. A little room to get wonderfully lost.",
    x: 76,
    y: 37,
  },
  {
    name: "A moment to keep",
    text: "A memory is more than a photograph. It is the light, the people, and everything just outside the frame.",
    x: 16,
    y: 38,
  },
  {
    name: "A different frequency",
    text: "Every place has a rhythm. Find yours in a visual collection of sound, color, and feeling.",
    x: 85,
    y: 75,
  },
];
export default function Arrival() {
  const [point, setPoint] = useState<number | null>(null);
  return (
    <section id="arrival" className="world-arrival world-scene">
      <div className="arrival-landscape" aria-hidden="true" />
      <div className="arrival-shade" />
      <div className="world-section-bar">
        <ChapterLabel number="02">The Arrival</ChapterLabel>
        <span className="world-eyebrow">Reality meets imagination</span>
      </div>
      <div className="arrival-heading" data-world-reveal>
        <p className="world-eyebrow">You’re on the other side.</p>
        <h2>
          Every life is a world
          <br />
          waiting to be <em>explored.</em>
        </h2>
        <p>
          Not every journey takes you somewhere new.
          <br />
          Some bring you a little closer to yourself.
        </p>
        <a className="world-link" href="#observatory">
          Follow your curiosity <ArrowDownRight size={18} />
        </a>
      </div>
      <div className="arrival-points">
        {points.map((p, i) => (
          <div
            className={`arrival-hotspot ${point === i ? "is-open" : ""}`}
            key={p.name}
            style={{ left: `${p.x}%`, top: `${p.y}%` }}
          >
            <button
              onClick={() => setPoint(point === i ? null : i)}
              aria-label={`${point === i ? "Close" : "Discover"} ${p.name}`}
              aria-expanded={point === i}
            >
              {point === i ? <X size={16} /> : <Plus size={16} />}
            </button>
            {point === i && (
              <div className="arrival-fieldnote">
                <span className="world-eyebrow">Field note / 0{i + 1}</span>
                <h3>{p.name}</h3>
                <p>{p.text}</p>
              </div>
            )}
          </div>
        ))}
      </div>
      <footer className="arrival-bottom">
        <span className="world-eyebrow">
          An atlas of places, moments & possibilities
        </span>
        <span className="world-eyebrow">Scroll to wander ↓</span>
      </footer>
    </section>
  );
}
