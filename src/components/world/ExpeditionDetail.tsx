"use client";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Download, Check, ArrowUpRight } from "lucide-react";
import { destinations, timelineEvents } from "@/data/demo/expeditions";
import type { Expedition } from "@/data/demo/types";
import { formatMoney, formatDate } from "@/data/demo/selectors";
import { DemoNote } from "./primitives";
export default function ExpeditionDetail({
  expedition: e,
  onNavigate,
}: {
  expedition: Expedition;
  onNavigate?: () => void;
}) {
  const [tab, setTab] = useState("Itinerary");
  const [packed, setPacked] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const download = () => {
    const text = `LIFE ATLAS — SAMPLE ITINERARY\n${e.name}\n${e.route.join(" → ")}\n${e.overview}\n\n${e.itinerary.map((d) => `DAY ${d.day} · ${d.title}\n${d.description}`).join("\n\n")}\n\nEXAMPLE COST: ${formatMoney(e.cost.total)}\nPrices, conditions and transport require independent confirmation.\n\nPACKING\n${e.packing.join("\n")}`;
    const url = URL.createObjectURL(
      new Blob([text], { type: "text/plain;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `life-atlas-${e.slug}-sample.txt`;
    link.click();
    URL.revokeObjectURL(url);
    setSaved(true);
  };
  return (
    <article className="expedition-detail">
      <div
        className="detail-banner"
        style={{
          backgroundImage: `linear-gradient(0deg,rgba(9,18,23,.8),transparent),url(${e.image})`,
        }}
      >
        <span className="world-eyebrow">A journey study / {e.category}</span>
        <h2>{e.name}</h2>
        <p>{e.route.join(" → ")}</p>
      </div>
      <DemoNote>
        Fictional itinerary & estimated costs. Illustrative imagery.
      </DemoNote>
      <p className="detail-overview">{e.overview}</p>
      <div className="detail-stats">
        <div>
          <small>Time to wander</small>
          <strong>{e.duration} days</strong>
        </div>
        <div>
          <small>Pace</small>
          <strong>{e.difficulty}</strong>
        </div>
        <div>
          <small>Example budget</small>
          <strong>{formatMoney(e.cost.total)}</strong>
        </div>
      </div>
      <div
        className="world-tabs"
        role="tablist"
        aria-label="Journey information"
      >
        {["Itinerary", "Field notes", "Packing", "Budget", "Timeline"].map(
          (t) => (
            <button
              role="tab"
              aria-selected={tab === t}
              aria-controls={`journey-panel-${e.id}`}
              id={`tab-${e.id}-${t.replace(" ", "-")}`}
              tabIndex={tab === t ? 0 : -1}
              onClick={() => setTab(t)}
              onKeyDown={(event) => {
                if (
                  ["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
                ) {
                  event.preventDefault();
                  const tabs = Array.from(
                    event.currentTarget.parentElement!.querySelectorAll<HTMLButtonElement>(
                      "button",
                    ),
                  );
                  const i = tabs.indexOf(event.currentTarget);
                  tabs[
                    event.key === "Home"
                      ? 0
                      : event.key === "End"
                        ? tabs.length - 1
                        : (i +
                            (event.key === "ArrowRight" ? 1 : -1) +
                            tabs.length) %
                          tabs.length
                  ].click();
                  tabs[
                    event.key === "Home"
                      ? 0
                      : event.key === "End"
                        ? tabs.length - 1
                        : (i +
                            (event.key === "ArrowRight" ? 1 : -1) +
                            tabs.length) %
                          tabs.length
                  ].focus();
                }
              }}
              key={t}
            >
              {t}
            </button>
          ),
        )}
      </div>
      <div
        className="detail-tab-body"
        id={`journey-panel-${e.id}`}
        role="tabpanel"
        aria-labelledby={`tab-${e.id}-${tab.replace(" ", "-")}`}
      >
        {tab === "Itinerary" && (
          <ol className="detail-itinerary">
            {e.itinerary.map((d) => (
              <li key={d.day}>
                <span>{String(d.day).padStart(2, "0")}</span>
                <div>
                  <small>
                    {destinations.find((p) => p.id === d.destinationId)?.name}
                  </small>
                  <h3>{d.title}</h3>
                  <p>{d.description}</p>
                </div>
              </li>
            ))}
          </ol>
        )}
        {tab === "Field notes" && (
          <>
            <h3>Go prepared. Stay curious.</h3>
            <h4>Weather & conditions</h4>
            <p>{e.weather}</p>
            <h4>Getting around</h4>
            <p>{e.transport}</p>
            <h4>Make room for</h4>
            <ul>
              {e.activities.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
            <div className="detail-gallery">
              {e.destinationIds.map((id) => {
                const d = destinations.find((x) => x.id === id)!;
                return (
                  <figure key={id}>
                    <Image
                      width={1600}
                      height={1000}
                      sizes="(max-width: 700px) 90vw, 50vw"
                      src={d.image.replace(".webp", "-small.webp")}
                      alt={`Illustrative landscape for ${d.name}`}
                      loading="lazy"
                    />
                    <figcaption>{d.name} / Landscape study</figcaption>
                  </figure>
                );
              })}
            </div>
          </>
        )}
        {tab === "Packing" && (
          <>
            <p>
              A local checklist for this visit. {packed.length} of{" "}
              {e.packing.length} ready.
            </p>
            <div className="packing-list">
              {e.packing.map((p) => (
                <label key={p}>
                  <input
                    type="checkbox"
                    checked={packed.includes(p)}
                    onChange={() =>
                      setPacked((prev) =>
                        prev.includes(p)
                          ? prev.filter((x) => x !== p)
                          : [...prev, p],
                      )
                    }
                  />
                  <span>{p}</span>
                </label>
              ))}
            </div>
          </>
        )}
        {tab === "Budget" && (
          <>
            <h3>A little clarity before you go.</h3>
            {(
              ["accommodation", "transport", "food", "activities"] as const
            ).map((k) => (
              <div className="budget-row" key={k}>
                <span>{k}</span>
                <strong>{formatMoney(e.cost[k])}</strong>
              </div>
            ))}
            <div className="budget-row total">
              <span>Example total</span>
              <strong>{formatMoney(e.cost.total)}</strong>
            </div>
            <p>
              Fictional estimates in INR for one traveler. Not live prices;
              confirm costs, permits, insurance, and contingencies
              independently.
            </p>
          </>
        )}
        {tab === "Timeline" && (
          <ol className="detail-itinerary">
            {timelineEvents
              .filter((t) => t.expeditionId === e.id)
              .map((t, i) => (
                <li key={t.id}>
                  <span>0{i + 1}</span>
                  <div>
                    <small>{formatDate(t.date)} / Sample journal</small>
                    <h3>{t.title}</h3>
                    <p>{t.description}</p>
                  </div>
                </li>
              ))}
          </ol>
        )}
      </div>
      <button onClick={download} className="world-button dark">
        {saved ? "Download again" : "Take this sample plan"}
        {saved ? <Check size={17} /> : <Download size={17} />}
      </button>
      <Link href="/#memories" onClick={onNavigate} className="world-link">
        Explore the memory archive <ArrowUpRight size={17} />
      </Link>
    </article>
  );
}
