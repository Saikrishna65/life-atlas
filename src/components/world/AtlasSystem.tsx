"use client";
import { KineticHeading } from "./EditorialElements";
import { useMemo, useState } from "react";
import {
  ArrowUpRight,
  ArrowLeft,
  ArrowRight,
  Check,
  Plus,
  MapPin,
  AudioLines,
  Aperture,
  Wallet,
  Bell,
  CalendarDays,
  Network,
  Sparkles,
} from "lucide-react";
import { reminders } from "@/data/demo/reminders";
import {
  transactions,
  financeSummary,
  openingBalancePaise,
} from "@/data/demo/finance";
import { activities } from "@/data/demo/activity";
import { formatDate, formatMoney } from "@/data/demo/selectors";
import { ChapterLabel, DemoNote, Modal } from "./primitives";
const modules = [
  {
    name: "Travel",
    icon: MapPin,
    sub: "The road ahead",
    description:
      "A destination becomes a route. A route becomes a story. A story becomes part of you.",
    link: "#expeditions",
    count: "36 destinations / 24 journeys",
  },
  {
    name: "Memories",
    icon: Aperture,
    sub: "The things that stay",
    description:
      "Keep a small moment close, then find the journey that gave it meaning.",
    link: "#memories",
    count: "108 moments / 180 image records",
  },
  {
    name: "Music",
    icon: AudioLines,
    sub: "The way it felt",
    description:
      "A place has a color. A memory has a rhythm. Follow the feeling through a visual sound collection.",
    link: "#sound",
    count: "20 collections / 216 tracks",
  },
  {
    name: "Finance",
    icon: Wallet,
    sub: "Room for possibility",
    description:
      "Give the next adventure a little clarity. Explore an isolated sample ledger and its calculated totals.",
    link: "finance",
    count: "120 sample transactions",
  },
  {
    name: "Reminders",
    icon: Bell,
    sub: "A gentle nudge",
    description:
      "The practical things make room for the extraordinary. Try a checklist that belongs only to this demo.",
    link: "planning",
    count: "64 planning examples",
  },
  {
    name: "Planning",
    icon: CalendarDays,
    sub: "A little intention",
    description:
      "Choose what matters, leave a buffer, and let a plan stay human.",
    link: "planning",
    count: "A sample week, with breathing room",
  },
  {
    name: "Organization",
    icon: Network,
    sub: "Everything, connected",
    description:
      "A connected system where notes, moments, plans, and small actions share a meaningful context.",
    link: "activity",
    count: "108 linked activity records",
  },
  {
    name: "Atlas AI",
    icon: Sparkles,
    sub: "Another perspective",
    description:
      "From a half-formed thought to a clearer next step. Explore authored conversations and workflow concepts.",
    link: "#intelligence",
    count: "56 conversations / 28 workflows",
  },
];
export default function AtlasSystem() {
  const [selected, setSelected] = useState(0);
  const [demo, setDemo] = useState<string | null>(null);
  const [month, setMonth] = useState(10);
  const [checked, setChecked] = useState(
    () => new Set(reminders.filter((r) => r.completed).map((r) => r.id)),
  );
  const [planningPage, setPlanningPage] = useState(0);
  const [activityPage, setActivityPage] = useState(0);
  const activeModule = modules[selected];
  const monthRecords = useMemo(
    () => transactions.filter((t) => Number(t.date.slice(5, 7)) === month + 1),
    [month],
  );
  const summary = financeSummary(monthRecords);
  const monthOpening =
    openingBalancePaise +
    transactions
      .filter((t) => Number(t.date.slice(5, 7)) < month + 1)
      .reduce(
        (n, t) => n + (t.direction === "in" ? t.amountPaise : -t.amountPaise),
        0,
      );
  return (
    <section id="system" className="world-system world-scene">
      <div className="world-section-bar">
        <ChapterLabel number="08">The Atlas System</ChapterLabel>
        <span className="world-eyebrow">Many dimensions. One life.</span>
      </div>
      <header className="world-editorial-header" data-world-reveal>
        <KineticHeading
          lines={[
            "Everything you are.",
            <em key="connected">Beautifully connected.</em>,
          ]}
        />
        <p>
          Less scattered. More you.
          <br />
          Explore a system built around a life.
        </p>
      </header>
      <div className="system-layout">
        <div className="system-constellation">
          <svg
            className="system-orbit-grid"
            viewBox="0 0 600 500"
            aria-hidden="true"
          >
            <g className="system-orbit-rings">
              <ellipse cx="300" cy="250" rx="220" ry="185" />
              <ellipse cx="300" cy="250" rx="145" ry="105" />
            </g>
            {modules.map((_, i) => {
              const a = (i * Math.PI) / 4 - Math.PI / 2;
              return (
                <line
                  key={i}
                  x1="300"
                  y1="250"
                  x2={300 + 220 * Math.cos(a)}
                  y2={250 + 185 * Math.sin(a)}
                  className={i === selected ? "active" : ""}
                />
              );
            })}
          </svg>
          <div className="system-center">
            <span>LA</span>
            <small>YOUR WORLD</small>
          </div>
          {modules.map((m, i) => {
            const a = (i * Math.PI) / 4 - Math.PI / 2;
            return (
              <button
                key={m.name}
                className={`system-node ${i === selected ? "is-selected" : ""} node-${i}`}
                style={{
                  left: `${50 + 36.7 * Math.cos(a)}%`,
                  top: `${50 + 37 * Math.sin(a)}%`,
                }}
                onClick={() => setSelected(i)}
                aria-pressed={i === selected}
              >
                <m.icon size={21} />
                <span>{m.name}</span>
              </button>
            );
          })}
        </div>
        <div
          className={`system-module module-${selected}`}
          key={activeModule.name}
        >
          <span className="world-eyebrow">
            0{selected + 1} / A part of your world
          </span>
          <activeModule.icon className="system-module-icon" size={44} />
          <h3>{activeModule.sub}</h3>
          <p>{activeModule.description}</p>
          <span className="module-count">{activeModule.count}</span>
          {activeModule.link.startsWith("#") ? (
            <a className="world-button dark" href={activeModule.link}>
              Explore {activeModule.name.toLowerCase()}{" "}
              <ArrowUpRight size={17} />
            </a>
          ) : (
            <button
              className="world-button dark"
              onClick={() => setDemo(activeModule.link)}
            >
              Open the local demo <ArrowUpRight size={17} />
            </button>
          )}
          <DemoNote>Isolated public examples. No personal data.</DemoNote>
        </div>
      </div>
      {demo && (
        <Modal
          title={`${activeModule.name} demonstration`}
          onClose={() => setDemo(null)}
        >
          <div className="system-demo">
            <span className="world-eyebrow">
              The Atlas System / Local sample
            </span>
            <h2>
              {demo === "finance"
                ? "A little financial clarity."
                : demo === "planning"
                  ? "Make room for what matters."
                  : "The small things add up."}
            </h2>
            <DemoNote>
              Fictional records. Changes stay in this page session.
            </DemoNote>
            {demo === "finance" && (
              <>
                <div className="demo-month">
                  <button
                    className="world-icon"
                    disabled={month === 0}
                    onClick={() => setMonth((m) => m - 1)}
                    aria-label="Previous month"
                  >
                    <ArrowLeft />
                  </button>
                  <strong>
                    {new Intl.DateTimeFormat("en", {
                      month: "long",
                      year: "numeric",
                    }).format(new Date(2025, month, 1))}
                  </strong>
                  <button
                    className="world-icon"
                    disabled={month === 11}
                    onClick={() => setMonth((m) => m + 1)}
                    aria-label="Next month"
                  >
                    <ArrowRight />
                  </button>
                </div>
                <div className="finance-summary">
                  <div>
                    <small>Opening balance</small>
                    <strong>{formatMoney(monthOpening / 100)}</strong>
                  </div>
                  <div>
                    <small>Income</small>
                    <strong>{formatMoney(summary.income / 100)}</strong>
                  </div>
                  <div>
                    <small>Expenses</small>
                    <strong>{formatMoney(summary.expenses / 100)}</strong>
                  </div>
                  <div>
                    <small>Closing balance</small>
                    <strong>
                      {formatMoney(
                        (monthOpening + summary.income - summary.expenses) /
                          100,
                      )}
                    </strong>
                  </div>
                </div>
                <div className="sample-ledger">
                  {monthRecords.map((t) => (
                    <div key={t.id}>
                      <time>{formatDate(t.date)}</time>
                      <span>
                        <strong>{t.description}</strong>
                        <small>{t.category}</small>
                      </span>
                      <b className={t.direction === "in" ? "income" : ""}>
                        {t.direction === "in" ? "+" : "−"}
                        {formatMoney(t.amountPaise / 100)}
                      </b>
                    </div>
                  ))}
                </div>
              </>
            )}
            {demo === "planning" && (
              <>
                <p aria-live="polite">
                  {checked.size} of {reminders.length} sample tasks complete
                </p>
                <div className="sample-planning">
                  {reminders
                    .slice(planningPage * 8, planningPage * 8 + 8)
                    .map((r) => (
                      <label
                        key={r.id}
                        className={checked.has(r.id) ? "is-complete" : ""}
                      >
                        <input
                          type="checkbox"
                          checked={checked.has(r.id)}
                          onChange={() =>
                            setChecked((prev) => {
                              const next = new Set(prev);
                              if (next.has(r.id)) next.delete(r.id);
                              else next.add(r.id);
                              return next;
                            })
                          }
                        />
                        <span className="task-check">
                          {checked.has(r.id) ? (
                            <Check size={15} />
                          ) : (
                            <Plus size={15} />
                          )}
                        </span>
                        <span>
                          <strong>{r.title}</strong>
                          <small>
                            {formatDate(r.date)} · {r.time} IST · {r.category}
                          </small>
                        </span>
                      </label>
                    ))}
                </div>
                <div className="world-pagination">
                  <button
                    disabled={planningPage === 0}
                    className="world-link"
                    onClick={() => setPlanningPage((p) => p - 1)}
                  >
                    <ArrowLeft size={16} /> Previous
                  </button>
                  <span>{planningPage + 1} / 8</span>
                  <button
                    disabled={planningPage === 7}
                    className="world-link"
                    onClick={() => setPlanningPage((p) => p + 1)}
                  >
                    Next <ArrowRight size={16} />
                  </button>
                </div>
              </>
            )}
            {demo === "activity" && (
              <>
                <div className="sample-ledger">
                  {activities
                    .slice(activityPage * 12, activityPage * 12 + 12)
                    .map((a) => (
                      <div key={a.id}>
                        <time>{formatDate(a.date)}</time>
                        <span>
                          <strong>{a.title}</strong>
                          <small>
                            {a.module} · {a.recordId}
                          </small>
                        </span>
                      </div>
                    ))}
                </div>
                <div className="world-pagination">
                  <button
                    className="world-link"
                    disabled={activityPage === 0}
                    onClick={() => setActivityPage((p) => p - 1)}
                  >
                    <ArrowLeft size={15} /> Previous
                  </button>
                  <span>{activityPage + 1} / 9</span>
                  <button
                    className="world-link"
                    disabled={activityPage === 8}
                    onClick={() => setActivityPage((p) => p + 1)}
                  >
                    Next <ArrowRight size={15} />
                  </button>
                </div>
              </>
            )}
          </div>
        </Modal>
      )}
    </section>
  );
}
