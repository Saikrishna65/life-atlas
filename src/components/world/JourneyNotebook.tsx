"use client";
import { useState } from "react";
import Image from "next/image";
import {ArrowUpRight} from "lucide-react";
import type { Expedition } from "@/data/demo/types";
import { detailedDays } from "@/data/demo/journey-details";
export default function JourneyNotebook({
  expedition: e,
}: {
  expedition: Expedition;
}) {
  const [day, setDay] = useState(0);
  const days = detailedDays(e),
    entry = days[day];
  if (!entry) return null;
  return (
    <section className="journey-notebook itinerary-edition" id="itinerary">
      <header>
        <p className="world-eyebrow">THE ITINERARY / AN IMAGINED JOURNEY</p>
        <h2>
          Not just where.
          <br />
          <em>How the day feels.</em>
        </h2>
        <p>
          A detailed sample schedule. Times, stays and activities are
          illustrative; confirm local arrangements before travelling.
        </p>
      </header>
      <div className="itinerary-layout">
        <aside>
          <span className="world-eyebrow">
            {days.length} DAYS / {e.route.join(" → ")}
          </span>
          <nav aria-label="Choose itinerary day">
            {days.map((d, i) => (
              <button
                key={d.day}
                aria-pressed={day === i}
                onClick={() => setDay(i)}
              >
                <small>{String(d.day).padStart(2, "0")}</small>
                <span>
                  {d.place}
                  <em>{d.headline}</em>
                </span>
                <ArrowUpRight size={14} aria-hidden="true"/>
              </button>
            ))}
          </nav>
          <p>
            Take it slowly.
            <br />
            Leave space for the unexpected.
          </p>
        </aside>
        <article className="itinerary-day" key={entry.day}>
          <div className="itinerary-day-cover">
            <Image
              src={e.image}
              width={1200}
              height={700}
              alt="Illustrative landscape for the sample itinerary"
              loading="lazy"
            />
            <div>
              <span>
                DAY {String(entry.day).padStart(2, "0")} / {entry.place}
              </span>
              <h3>{entry.headline}</h3>
            </div>
          </div>
          <div className="itinerary-day-intro">
            <p>{entry.description}</p>
            <span>Example overnight plan: {entry.overnight}</span>
          </div>
          <ol className="itinerary-beats">
            {entry.beats.map((beat) => (
              <li key={beat.time}>
                <time>{beat.time}</time>
                <span className="itinerary-beat-dot" />
                <div>
                  <small>{beat.kind}</small>
                  <h4>{beat.title}</h4>
                  <p>{beat.description}</p>
                </div>
              </li>
            ))}
          </ol>
          <footer className="notebook-day-foot">
            <button disabled={day === 0} onClick={() => setDay((n) => n - 1)}>
              ← Previous day
            </button>
            <span>
              {day + 1} / {days.length}
            </span>
            <button
              disabled={day === days.length - 1}
              onClick={() => setDay((n) => n + 1)}
            >
              Next day →
            </button>
          </footer>
        </article>
      </div>
    </section>
  );
}
