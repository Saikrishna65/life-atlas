"use client";
import { useState } from "react";
import type { Expedition } from "@/data/demo/types";
import { formatMoney } from "@/data/demo/selectors";
export default function JourneyNotebook({
  expedition: e,
}: {
  expedition: Expedition;
}) {
  const [tab, setTab] = useState("Itinerary"),
    [day, setDay] = useState(0),
    [packed, setPacked] = useState<string[]>([]);
  const entry = e.itinerary[day];
  return (
    <section className="journey-notebook notebook-v2">
      <header>
        <p className="world-eyebrow">THE FIELD JOURNAL / A SAMPLE ITINERARY</p>
        <h2>
          Days worth
          <br />
          <em>getting lost in.</em>
        </h2>
        <p>A route is a beginning. Leave room for everything along the way.</p>
      </header>
      <div className="notebook-layout">
        <aside>
          <span className="notebook-spine">LIFE ATLAS / FIELD EDITION</span>
          <nav role="tablist" aria-label="Journey information">
            {["Itinerary", "Field notes", "Packing", "Budget"].map(
              (name, i) => (
                <button
                  key={name}
                  role="tab"
                  aria-selected={tab === name}
                  aria-controls="notebook-panel"
                  id={"notebook-tab-" + i}
                  onClick={() => setTab(name)}
                >
                  <small>0{i + 1}</small>
                  {name}
                  <span>↗</span>
                </button>
              ),
            )}
          </nav>
          <p>
            {e.duration} days
            <br />
            {e.difficulty} pace
            <br />
            {e.category}
          </p>
          <small>
            Imagined itinerary. Costs and conditions are examples, not verified
            trip records.
          </small>
        </aside>
        <div
          id="notebook-panel"
          role="tabpanel"
          aria-labelledby={
            "notebook-tab-" +
            ["Itinerary", "Field notes", "Packing", "Budget"].indexOf(tab)
          }
          className="notebook-paper"
        >
          {tab === "Itinerary" && entry && (
            <>
              <div className="notebook-days" aria-label="Choose itinerary day">
                {e.itinerary.map((d, i) => (
                  <button
                    key={d.day}
                    aria-pressed={day === i}
                    onClick={() => setDay(i)}
                  >
                    DAY {String(d.day).padStart(2, "0")}
                  </button>
                ))}
              </div>
              <span className="notebook-day-number" aria-hidden="true">
                {String(entry.day).padStart(2, "0")}
              </span>
              <article className="notebook-day">
                <p className="world-eyebrow">THE DAY UNFOLDS</p>
                <h3>{entry.title}</h3>
                <p>{entry.description}</p>
                <div className="notebook-day-foot">
                  <button
                    disabled={day === 0}
                    onClick={() => setDay((n) => n - 1)}
                  >
                    ← Previous day
                  </button>
                  <span>
                    {day + 1} / {e.itinerary.length}
                  </span>
                  <button
                    disabled={day === e.itinerary.length - 1}
                    onClick={() => setDay((n) => n + 1)}
                  >
                    Next day →
                  </button>
                </div>
              </article>
            </>
          )}
          {tab === "Field notes" && (
            <div className="notebook-notes">
              <article>
                <span>01 / THE ELEMENTS</span>
                <h3>Read the weather.</h3>
                <p>{e.weather}</p>
              </article>
              <article>
                <span>02 / ON THE MOVE</span>
                <h3>Find your rhythm.</h3>
                <p>{e.transport}</p>
              </article>
              <article>
                <span>03 / MAKE ROOM FOR</span>
                <ul>
                  {e.activities.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              </article>
            </div>
          )}
          {tab === "Packing" && (
            <div className="notebook-packing">
              <p className="world-eyebrow">
                {packed.length} OF {e.packing.length} READY
              </p>
              <h3>
                Take only
                <br />
                <em>what matters.</em>
              </h3>
              {e.packing.map((item) => (
                <label key={item}>
                  <input
                    type="checkbox"
                    checked={packed.includes(item)}
                    onChange={(event) =>
                      setPacked((old) =>
                        event.target.checked
                          ? [...old, item]
                          : old.filter((p) => p !== item),
                      )
                    }
                  />
                  <span>{item}</span>
                </label>
              ))}
            </div>
          )}
          {tab === "Budget" && (
            <div className="notebook-budget">
              <p className="world-eyebrow">EXAMPLE BUDGET / INR</p>
              <h3>
                A little clarity.
                <br />
                <em>A lot of possibility.</em>
              </h3>
              {(
                ["accommodation", "transport", "food", "activities"] as const
              ).map((key) => (
                <div key={key}>
                  <span>{key}</span>
                  <strong>{formatMoney(e.cost[key])}</strong>
                </div>
              ))}
              <footer>
                <span>Example total</span>
                <strong>{formatMoney(e.cost.total)}</strong>
              </footer>
              <p>Confirm current prices independently before travelling.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
