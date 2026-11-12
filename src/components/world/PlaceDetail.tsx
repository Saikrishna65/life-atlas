"use client";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { Destination } from "@/data/demo/types";
import { expeditions } from "@/data/demo/expeditions";
import { formatMoney } from "@/data/demo/selectors";
import { DemoNote } from "./primitives";
export default function PlaceDetail({ place: p }: { place: Destination }) {
  return (
    <article className="public-place-detail">
      <div className="public-place-landscape">
        <Image
          width={1600}
          height={1000}
          sizes="(max-width: 700px) 90vw, 50vw"
          src={p.image}
          alt={p.imageNote}
        />
        <span>LANDSCAPE STUDY / ILLUSTRATIVE</span>
      </div>
      <div className="place-editorial">
        <div>
          <span className="world-eyebrow">
            {p.region} / {p.country}
          </span>
          <h2>
            A little closer
            <br />
            to <em>{p.name}.</em>
          </h2>
          <p>{p.description}</p>
          <DemoNote>{p.imageNote}</DemoNote>
        </div>
        <div className="place-fieldnotes">
          <h3>The field notes</h3>
          <dl>
            <div>
              <dt>Season</dt>
              <dd>{p.season}</dd>
            </div>
            <div>
              <dt>Make time</dt>
              <dd>{p.duration} days</dd>
            </div>
            <div>
              <dt>Pace</dt>
              <dd>{p.difficulty}</dd>
            </div>
            <div>
              <dt>Example budget</dt>
              <dd>{formatMoney(p.budget.amount)}</dd>
            </div>
            <div>
              <dt>Approximate center</dt>
              <dd>
                {p.latitude.toFixed(1)}°, {p.longitude.toFixed(1)}°
              </dd>
            </div>
          </dl>
          <p>
            {p.coordinateNote} Verify local conditions, prices and any permits
            independently.
          </p>
        </div>
      </div>
      <div className="place-highlights">
        {p.highlights.map((h, i) => (
          <div key={h}>
            <span className="world-eyebrow">0{i + 1} / Make room for</span>
            <h3>{h}</h3>
          </div>
        ))}
      </div>
      <div className="place-journeys">
        <span className="world-eyebrow">Journeys that find their way here</span>
        {p.expeditionIds.map((id) => {
          const e = expeditions.find((e) => e.id === id)!;
          return (
            <Link href={`/trips/${e.slug}`} key={id}>
              <h3>{e.name}</h3>
              <span>{e.duration} days</span>
              <ArrowUpRight size={23} />
            </Link>
          );
        })}
      </div>
    </article>
  );
}
