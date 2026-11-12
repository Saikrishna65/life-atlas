"use client";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Copy, Check, Sparkles } from "lucide-react";
import { conversations, workflows } from "@/data/demo/conversations";
import type { DemoTopic } from "@/data/demo/types";
import { ChapterLabel, DemoNote } from "./primitives";
const AtlasOrb = dynamic(() => import("./AtlasOrb"), {
  ssr: false,
  loading: () => (
    <div className="atlas-orb">
      <div className="orb-css-fallback" />
    </div>
  ),
});
export default function Intelligence() {
  const [topic, setTopic] = useState<DemoTopic>("Travel");
  const [selected, setSelected] = useState(conversations[0].id);
  const [mode, setMode] = useState("Conversations");
  const [copied, setCopied] = useState(false);
  const [state, setState] = useState<"idle" | "thinking" | "response">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const current = conversations.find((c) => c.id === selected)!;
  const examples = conversations.filter((c) => c.topic === topic);
  const workflow = workflows.find((w) => w.conversationId === current.id);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const choose = (id: string) => {
    setSelected(id);
    setCopied(false);
    setState("thinking");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("response"), 450);
  };
  return (
    <section id="intelligence" className="world-intelligence world-scene">
      <div className="world-section-bar">
        <ChapterLabel number="07">The Intelligence</ChapterLabel>
        <span className="world-eyebrow">
          A little perspective changes everything.
        </span>
      </div>
      <div className="intelligence-layout">
        <div className="intelligence-presence">
          <p className="world-eyebrow">Meet Atlas. Your curious counterpart.</p>
          <h2>
            A mind for the details.
            <br />
            <em>A soul for the journey.</em>
          </h2>
          <AtlasOrb state={state} />
          <div className="orb-status">
            <span />
            <span>
              {state === "thinking"
                ? "Changing perspective"
                : state === "response"
                  ? "A new example to explore"
                  : "Curiosity, at rest"}
            </span>
          </div>
        </div>
        <div className="intelligence-conversations">
          <header>
            <span className="world-eyebrow">
              <Sparkles size={15} /> A conversation worth having
            </span>
            <p>
              Thoughtful. Occasionally sarcastic.
              <br />
              Always on your side.
            </p>
          </header>
          <label className="ai-topic">
            <span>Explore a possibility</span>
            <select
              value={topic}
              onChange={(e) => {
                const t = e.target.value as DemoTopic;
                setTopic(t);
                choose(conversations.find((c) => c.topic === t)!.id);
              }}
            >
              {(
                [
                  "Travel",
                  "Music",
                  "Reminders",
                  "Finance",
                  "Conversation",
                  "Planning",
                  "Organization",
                  "Technology",
                ] as DemoTopic[]
              ).map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <div className="world-filter-pills">
            {["Conversations", "Workflow"].map((t) => (
              <button
                aria-pressed={mode === t}
                key={t}
                onClick={() => setMode(t)}
              >
                {t}
              </button>
            ))}
          </div>
          {mode === "Conversations" ? (
            <div className="conversation-paper">
              <p className="conversation-user">{current.messages[0].text}</p>
              <span className="world-eyebrow">
                ATLAS / ILLUSTRATIVE RESPONSE
              </span>
              <p className="conversation-answer">{current.messages[1].text}</p>
              <button
                className="world-link"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(
                      current.messages
                        .map((m) => `${m.role}: ${m.text}`)
                        .join("\n\n"),
                    );
                    setCopied(true);
                  } catch {
                    setCopied(false);
                  }
                }}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}{" "}
                {copied ? "Example copied" : "Copy this example"}
              </button>
            </div>
          ) : (
            <div className="conversation-paper workflow-paper">
              <span className="world-eyebrow">
                How this could work / Local demonstration
              </span>
              <ol>
                {(
                  workflow?.steps ?? [
                    `Understand the ${topic.toLowerCase()} request`,
                    "Review the sample context",
                    "Present a suggestion for your review",
                  ]
                ).map((step, i) => (
                  <li key={step}>
                    <span>0{i + 1}</span>
                    <p>{step}</p>
                  </li>
                ))}
              </ol>
              <p>{workflow?.result ?? current.messages[1].text}</p>
            </div>
          )}
          <div className="conversation-prompts">
            <span className="world-eyebrow">Or try another thought</span>
            {examples
              .filter((c) => c.id !== selected)
              .slice(0, 3)
              .map((c) => (
                <button key={c.id} onClick={() => choose(c.id)}>
                  {c.title}
                  <ArrowRight size={15} />
                </button>
              ))}
            <button
              className="world-link"
              onClick={() =>
                choose(
                  examples[
                    (examples.findIndex((c) => c.id === selected) + 1) %
                      examples.length
                  ].id,
                )
              }
            >
              Next example <ArrowRight size={15} />
            </button>
          </div>
          <DemoNote>
            56 authored examples · 28 workflows. No live AI or private data
            access.
          </DemoNote>
        </div>
      </div>
    </section>
  );
}
