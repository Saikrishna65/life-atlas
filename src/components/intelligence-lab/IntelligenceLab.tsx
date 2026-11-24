"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BrainCircuit,
  Download,
  FlaskConical,
  Library,
  MessageCircle,
  Mic,
  Pause,
  Play,
  Settings2,
  Square,
  Trash2,
  Upload,
  Volume2,
} from "lucide-react";
import { AtlasNative, type RuntimeStatus } from "@/lib/atlas-ai/native";
import {
  ModelStore,
  generateChat,
  supportsLab,
  type ModelLibrary,
} from "@/lib/atlas-ai/lab/client";
import {
  MODEL_CANDIDATES,
  MODEL_CATALOGUE,
} from "@/lib/atlas-ai/lab/catalogue";
import {
  DEFAULT_INFERENCE,
  validateInference,
  type ChatMessage,
  type GenerationResult,
  type InferenceConfig,
} from "@/lib/atlas-ai/lab/config";
import {
  QUALITY_CASES,
  QUICK_CASES,
  type QualityCase,
} from "@/lib/atlas-ai/lab/cases";
import {
  csv,
  DEFAULT_WEIGHTS,
  runBenchmark,
  summarize,
  weightedScore,
  type BenchmarkRun,
  type ComparisonScores,
} from "@/lib/atlas-ai/lab/benchmark";
import {
  buildPersonalitySystemInstructions,
  loadPersonalityConfig,
} from "@/lib/atlas-ai/personality";
import "./intelligence-lab.css";
const bytes = (v?:number)=>v===undefined?'—':v>=1e9?`${(v/1e9).toFixed(2)} GB`:v>=1e6?`${(v/1e6).toFixed(1)} MB`:v>=1e3?`${(v/1e3).toFixed(0)} KB`:`${Math.round(v)} B`;
const number = (v?: number | null, suffix = "") =>
  v === undefined || v === null ? "—" : `${v.toFixed(1)}${suffix}`;
const tabs = [
  ["models", "Models", Library],
  ["chat", "Playground", MessageCircle],
  ["bench", "Compare", FlaskConical],
  ["settings", "Settings", Settings2],
] as const;
function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export default function IntelligenceLab() {
  const native = supportsLab();
  const [tab, setTab] = useState("models");
  const [library, setLibrary] = useState<ModelLibrary>({
    models: MODEL_CATALOGUE.map((m) => ({
      ...m,
      installed: false,
      state: "not_installed",
      partialBytes: 0,
    })),
    selected: "",
    availableBytes: 0,
  });
  const [runtime, setRuntime] = useState<RuntimeStatus>();
  const [config, setConfig] = useState<InferenceConfig>({
    ...DEFAULT_INFERENCE,
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [installedOnly, setInstalledOnly] = useState(false);
  const [policy, setPolicy] = useState({
    idleSeconds: 120,
    keepResident: false,
    streaming: true,
  });
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [stream, setStream] = useState("");
  const [system, setSystem] = useState(
    "Keep responses natural, concise and useful. Never invent personal data or claim actions have run.",
  );
  const [result, setResult] = useState<GenerationResult>();
  const [chosen, setChosen] = useState<string[]>([]);
  const [run, setRun] = useState<BenchmarkRun>();
  const [history, setHistory] = useState<BenchmarkRun[]>([]);
  const [custom, setCustom] = useState("");
  const [weights, setWeights] = useState({ ...DEFAULT_WEIGHTS });
  const [reps, setReps] = useState(2);
  const controller = useRef<AbortController | null>(null);
  const historyRef = useRef<HTMLDivElement>(null);
  const stop = useCallback(() => {
    if (controller.current) {
      controller.current.abort();
      if (supportsLab())
        void AtlasNative.cancel({ requestId: "" }).catch(() => {});
    }
  }, []);
  useEffect(() => {
    const hide = () => {
      if (document.visibilityState === "hidden") stop();
    };
    document.addEventListener("visibilitychange", hide);
    return () => document.removeEventListener("visibilitychange", hide);
  }, [stop]);
  const refresh = useCallback(async () => {
    if (!native) return;
    const [list, state] = await Promise.all([
      ModelStore.list(),
      AtlasNative.runtimeStatus(),
    ]);
    setLibrary(list);
    setRuntime(state);
  }, [native]);
  useEffect(() => {
    let alive = true;
    if (native)
      void Promise.all([ModelStore.list(), AtlasNative.runtimeStatus()])
        .then(([list, state]) => {
          if (alive) {
            setLibrary(list);
            setRuntime(state);
            setConfig((c) => ({ ...c, ...state.options }));
            if (state.policy) setPolicy(state.policy);
          }
        })
        .catch((e) => {
          if (alive) setError(String(e));
        });
    return () => {
      alive = false;
      stop();
    };
  }, [native,stop]);
  useEffect(() => {
    let alive = true;
    if (native && tab === "bench")
      void ModelStore.listBenchmarks()
        .then((saved) => {
          if (alive) setHistory(saved.reports);
        })
        .catch(() => {});
    return () => {
      alive = false;
    };
  }, [native, tab]);
  useEffect(() => {
    if (!native) return;
    const poll = setInterval(() => {
      if (document.visibilityState === "visible")
        void refresh().catch(() => {});
    }, 2000);
    return () => clearInterval(poll);
  }, [native, refresh]);
  useEffect(() => {
    historyRef.current?.scrollTo({
      top: historyRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [stream, messages]);
  async function operation(work: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await work();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  async function chat(again = false) {
    if (busy) return;
    const prior = again ? messages.slice(0, -1) : messages;
    const text = again ? prior.at(-1)?.content : input.trim();
    if (!text) return;
    const conversation = again
      ? prior
      : [...prior, { role: "user" as const, content: text }];
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    setError("");
    setStream("");
    setMessages(conversation);
    setInput("");
    try {
      const response = await generateChat(
        [
          {
            role: "system",
            content:
              buildPersonalitySystemInstructions(
                loadPersonalityConfig(),
                text,
              ) +
              "\n" +
              system,
          },
          ...conversation.slice(-8),
        ],
        abort.signal,
        (t) => setStream((s) => s + t),
        validateInference(config),
      );
      setResult(response);
      setMessages([
        ...conversation,
        { role: "assistant", content: response.text },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setStream("");
      setBusy(false);
      controller.current = null;
      void refresh();
    }
  }
  async function benchmark(cases: readonly QualityCase[]) {
    if (!chosen.length) {
      setError("Select at least one installed model below.");
      return;
    }
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    setError("");
    setRun(undefined);
    try {
      const value = await runBenchmark({
        ids: chosen,
        cases,
        repetitions: reps,
        config: validateInference(config),
        signal: abort.signal,
        onUpdate: setRun,
      });
      setRun(value);
      if (!cases.some((c) => c.category === "custom"))
        await ModelStore.saveBenchmark({ report: value });
      setHistory((h) => [value, ...h].slice(0, 5));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      controller.current = null;
      void refresh();
    }
  }
  async function voice() {
    await operation(async () => {
      const id = crypto.randomUUID();
      const handle = await AtlasNative.addListener("voice", (e) => {
        if (e.requestId !== id) return;
        if (e.text) {
          setInput(e.text);
          void handle.remove();
        }
        if (e.error) {
          setError(e.error);
          void handle.remove();
        }
      });
      const timer = setTimeout(() => void handle.remove(), 30000);
      try {
        await AtlasNative.listen({ requestId: id });
      } catch (e) {
        clearTimeout(timer);
        await handle.remove();
        throw e;
      }
    });
  }
  const visible = library.models.filter(
    (m) =>
      (!installedOnly || m.installed) &&
      `${m.name} ${m.architecture} ${m.quantization}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <div className="il">
      <header className="il-header">
        <Link href="/secret/control-room" aria-label="Back to Control Room">
          <ArrowLeft size={22} />
        </Link>
        <div>
          <p>ATLAS / ON YOUR DEVICE</p>
          <h1>
            Intelligence Lab<span>Experimental</span>
          </h1>
        </div>
        <BrainCircuit size={28} />
      </header>
      <nav className="il-tabs" aria-label="Intelligence Lab">
        {tabs.map(([id, title, Icon]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            aria-current={tab === id ? "page" : undefined}
          >
            <Icon size={18} />
            {title}
          </button>
        ))}
      </nav>
      <main>
        <div className="il-status">
          <span
            className={
              runtime?.state === "ready" ? "il-light ready" : "il-light"
            }
          />
          <strong>
            {native
              ? (runtime?.state ?? "Checking runtime")
              : "Android native runtime required"}
          </strong>
          <span>
            {library.models.find((m) => m.id === library.selected)?.name ??
              "No model selected"}
          </span>
          <span>{bytes(runtime?.processPssBytes)} process PSS</span>
        </div>
        {!native && (
          <p className="il-notice">
            You can review the Lab here. Downloads, import, inference and
            measurements run inside the Android app. No cloud response is
            substituted.
          </p>
        )}
        {error && (
          <p className="il-error" role="alert">
            {error}
          </p>
        )}
        {tab === "models" && (
          <>
            <div className="il-intro">
              <p>YOUR MODELS. YOUR DEVICE.</p>
              <h2>
                A little intelligence.
                <br />
                Entirely yours.
              </h2>
              <p>
                Install one model at a time. Nothing downloads until you choose
                it. The runtime loads a selected model when you need it.
              </p>
            </div>
            <div className="il-toolbar">
              <input
                aria-label="Search models"
                placeholder="Find a model, architecture or quantization"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <label>
                <input
                  type="checkbox"
                  checked={installedOnly}
                  onChange={(e) => setInstalledOnly(e.target.checked)}
                />
                Installed
              </label>
              <button
                disabled={!native || busy}
                onClick={() =>
                  void operation(async () => {
                    if (
                      confirm(
                        "Import a GGUF from a source you trust? Its license and architecture must be compatible. Atlas calculates a checksum but cannot verify an unknown publisher.",
                      )
                    )
                      await ModelStore.importModel({ consent: true });
                  })
                }
              >
                <Upload size={16} />
                Import GGUF
              </button>
            </div>
            <div className="il-models">
              {visible.map((m) => (
                <article key={m.id}>
                  <div className="il-model-icon">
                    <BrainCircuit size={28} />
                  </div>
                  <div className="il-model-info">
                    <div>
                      <h3>{m.name}</h3>
                      <span className="il-badge">
                        {m.id === library.selected ? "Selected · " : ""}
                        {m.state.replaceAll("_", " ")}
                      </span>
                    </div>
                    <p>
                      {bytes(m.bytes)} · {m.quantization} · {m.architecture}
                    </p>
                    <small>
                      {m.license}{" "}
                      {m.licenseUrl && (
                        <a href={m.licenseUrl} target="_blank" rel="noreferrer">
                          Read license ↗
                        </a>
                      )}
                    </small>
                    <small>
                      SHA-256 <code>{m.sha256.slice(0, 16)}…</code>
                    </small>
                    {m.transfer && (
                      <>
                        <progress
                          value={m.transfer.received}
                          max={m.transfer.total || m.bytes}
                        />
                        <small>
                          {bytes(m.transfer.received)} / {bytes(m.bytes)} ·{" "}
                          {bytes(m.transfer.bytesPerSecond)}/s{" "}
                          {m.transfer.error}
                        </small>
                      </>
                    )}
                  </div>
                  <div className="il-actions">
                    {m.installed ? (
                      <>
                        <button
                          disabled={
                            !native || busy || m.id === library.selected
                          }
                          onClick={() =>
                            void operation(() =>
                              ModelStore.select({ id: m.id }),
                            )
                          }
                        >
                          <Play size={15} />
                          Use model
                        </button>
                        <button
                          aria-label={`Remove ${m.name}`}
                          disabled={busy}
                          onClick={() =>
                            void operation(async () => {
                              if (confirm(`Remove ${m.name} from this device?`))
                                await ModelStore.remove({
                                  id: m.id,
                                  confirm: true,
                                });
                            })
                          }
                        >
                          <Trash2 size={16} />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          disabled={
                            !native || busy || ["downloading","queued"].includes(m.state)
                          }
                          onClick={() =>
                            void operation(async () => {
                              if (
                                confirm(
                                  `Download ${m.name} (${bytes(m.bytes)}) over Wi-Fi? Read and accept ${m.license} before continuing. Architecture support is present; phone performance is not yet verified.`,
                                )
                              )
                                await ModelStore.install({
                                  id: m.id,
                                  consent: true,
                                  wifiOnly: true,
                                });
                            })
                          }
                        >
                          <Download size={16} />
                          {m.partialBytes ? "Resume" : "Download"}
                        </button>
                        {["downloading", "queued"].includes(m.state) && (
                          <button
                            onClick={() => void ModelStore.pause({ id: m.id })}
                            aria-label="Pause download"
                          >
                            <Pause size={16} />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </article>
              ))}
            </div>
            {native && (
              <p className="il-muted">
                {bytes(library.availableBytes)} free on device. Models stay in
                native storage and are excluded from ordinary backups. An
                imported GGUF can still be unsupported.
              </p>
            )}
            <details className="il-panel">
              <summary>12 requested model candidates · review status</summary>
              <p>
                Only entries with verified artifact identity are enabled for
                download. None has measured phone performance yet.
              </p>
              {MODEL_CANDIDATES.map((m) => (
                <div className="il-candidate" key={m.name}>
                  <strong>{m.name}</strong>
                  <span>{m.status}</span>
                </div>
              ))}
            </details>
          </>
        )}
        {tab === "chat" && (
          <>
            <div className="il-title">
              <div>
                <p>PRIVATE PLAYGROUND</p>
                <h2>Meet your model.</h2>
              </div>
              <button
                disabled={busy}
                onClick={() => {
                  setMessages([]);
                  setResult(undefined);
                  if (native) void AtlasNative.resetContext();
                }}
              >
                Clear
              </button>
            </div>
            <label className="il-field">
              System instructions
              <textarea
                value={system}
                onChange={(e) => setSystem(e.target.value)}
                maxLength={3000}
              />
            </label>
            <div
              className="il-chat"
              ref={historyRef}
              role="log"
              aria-label="Conversation"
            >
              {!messages.length && (
                <p className="il-empty">
                  Try a question, a little banter, or a follow-up.
                  <br />
                  This conversation stays in memory until you clear it or leave.
                </p>
              )}
              {messages.map((m, i) => (
                <div key={i} className={`il-message ${m.role}`}>
                  <small>{m.role === "user" ? "YOU" : "ATLAS · LOCAL"}</small>
                  <p>{m.content}</p>
                  {m.role === "assistant" && (
                    <div>
                      <button
                        onClick={() =>
                          void navigator.clipboard.writeText(m.content)
                        }
                      >
                        Copy
                      </button>
                      <button
                        onClick={() =>
                          void AtlasNative.speak({
                            text: m.content.slice(0, 4000),
                          })
                        }
                        aria-label="Read response"
                      >
                        <Volume2 size={16} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {stream && (
                <div className="il-message assistant">
                  <small>ATLAS · GENERATING</small>
                  <p>{stream}</p>
                </div>
              )}
            </div>
            <form
              className="il-composer"
              onSubmit={(e) => {
                e.preventDefault();
                void chat();
              }}
            >
              <input
                aria-label="Message"
                value={input}
                maxLength={6000}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Say something…"
              />
              <button
                type="button"
                disabled={!native || busy}
                onClick={() => void voice()}
                aria-label="Offline voice input"
              >
                <Mic size={19} />
              </button>
              {busy ? (
                <button type="button" onClick={stop}>
                  <Square size={16} />
                  Stop
                </button>
              ) : (
                <button
                  disabled={!native || !library.selected || !input.trim()}
                >
                  Send
                </button>
              )}
            </form>
            <button
              className="il-link"
              disabled={
                !native || busy || messages.at(-1)?.role !== "assistant"
              }
              onClick={() => void chat(true)}
            >
              Regenerate last response
            </button>
            {result && (
              <div className="il-metrics">
                <span>
                  {number(result.metrics.firstTokenMs, " ms")} first token
                </span>
                <span>{number(result.metrics.tokensPerSecond, " tok/s")}</span>
                <span>{result.metrics.generatedTokens} tokens</span>
                <span>{number(result.metrics.totalMs, " ms")} total</span>
                <span>{number(result.metrics.loadMs, " ms")} model load</span>
              </div>
            )}
          </>
        )}
        {tab === "bench" && (
          <>
            <div className="il-intro">
              <p>MEASURE. DON’T GUESS.</p>
              <h2>
                Find your kind
                <br />
                of intelligence.
              </h2>
              <p>
                Sequential tests, synthetic prompts and no live vault actions.
                Subjective quality needs your rating. Unmeasured values remain
                blank.
              </p>
            </div>
            <section className="il-panel">
              <h3>Choose installed models</h3>
              {library.models
                .filter((m) => m.installed)
                .map((m) => (
                  <label className="il-check" key={m.id}>
                    <input
                      type="checkbox"
                      disabled={busy}
                      checked={chosen.includes(m.id)}
                      onChange={(e) =>
                        setChosen((ids) =>
                          e.target.checked
                            ? [...ids, m.id]
                            : ids.filter((id) => id !== m.id),
                        )
                      }
                    />
                    {m.name}
                  </label>
                ))}
              {!library.models.some((m) => m.installed) && (
                <p>Install and select a model first.</p>
              )}
              <label className="il-field">
                Repetitions per prompt
                <select
                  value={reps}
                  disabled={busy}
                  onChange={(e) => setReps(Number(e.target.value))}
                >
                  {[1, 2, 3, 5].map((n) => (
                    <option key={n}>{n}</option>
                  ))}
                </select>
              </label>
              <div className="il-actions">
                <button
                  disabled={!native || busy}
                  onClick={() => void benchmark(QUICK_CASES)}
                >
                  Quick · 10 cases
                </button>
                <button
                  disabled={!native || busy}
                  onClick={() => void benchmark(QUALITY_CASES)}
                >
                  Full · 100 cases
                </button>
                {busy && <button onClick={stop}>Stop benchmark</button>}
              </div>
              <label className="il-field">
                Custom test prompt
                <textarea
                  value={custom}
                  maxLength={6000}
                  onChange={(e) => setCustom(e.target.value)}
                  placeholder="Compare the same prompt across selected models"
                />
              </label>
              <button
                disabled={!native || busy || !custom.trim()}
                onClick={() =>
                  void benchmark([
                    {
                      id: "custom",
                      category: "custom",
                      prompt: custom,
                      rubric: "Rate this response manually.",
                    },
                  ])
                }
              >
                Test custom prompt
              </button>
              <p className="il-muted">
                Conversation tests include synthetic history. Tool cases
                validate proposals against the real schema without executing
                them. Benchmarks record cold initialization, then a warm-up.
                Keep Atlas visible while testing.
              </p>
            </section>
            {run && (
              <>
                <div className="il-title">
                  <h3>
                    {run.completed
                      ? "Run complete"
                      : "Run in progress / incomplete"}{" "}
                    · {run.rows.length} results
                  </h3>
                  <div className="il-actions">
                    <button
                      onClick={() =>
                        save(
                          new Blob([JSON.stringify(run, null, 2)], {
                            type: "application/json",
                          }),
                          "atlas-benchmark.json",
                        )
                      }
                    >
                      Export JSON
                    </button>
                    <button
                      onClick={() =>
                        save(
                          new Blob([csv(run)], { type: "text/csv" }),
                          "atlas-benchmark.csv",
                        )
                      }
                    >
                      Export CSV
                    </button>
                    <button
                      disabled={
                        busy || run.rows.some((r) => r.category === "custom")
                      }
                      onClick={() =>
                        void operation(() =>
                          ModelStore.saveBenchmark({ report: run }),
                        )
                      }
                    >
                      Save ratings
                    </button>
                  </div>
                </div>
                <div className="il-comparison">
                  {[...new Set(run.rows.map((r) => r.modelId))].map((id) => {
                    const rows = run.rows.filter((r) => r.modelId === id);
                    const metric = (
                      key: "firstTokenMs" | "tokensPerSecond" | "totalMs",
                    ) => summarize(rows.map((r) => r.result?.metrics[key]));
                    const quality = (category: string) => {
                      const rated = rows.filter(
                        (r) =>
                          r.category === category &&
                          r.manualRating !== undefined,
                      );
                      return rated.length ===
                        rows.filter((r) => r.category === category).length &&
                        rated.length
                        ? (rated.reduce((n, r) => n + r.manualRating!, 0) /
                            rated.length) *
                            20
                        : null;
                    };
                    const tools = rows.filter((r) => r.category === "tool");
                    const latency = metric("firstTokenMs")?.median;
                    const speed = metric("tokensPerSecond")?.median;
                    const scores: ComparisonScores = {
                      latency: latency ? Math.min(100, 100000 / latency) : null,
                      speed: speed ? Math.min(100, (speed / 15) * 100) : null,
                      conversation: quality("conversation"),
                      personality: quality("personality"),
                      tools: tools.length
                        ? (tools.filter((r) => r.automatic === true).length /
                            tools.length) *
                          100
                        : null,
                      context: quality("context"),
                      memory: null,
                      efficiency: null,
                    };
                    const score = weightedScore(scores, weights);
                    return (
                      <article className="il-panel" key={id}>
                        <h3>
                          {library.models.find((m) => m.id === id)?.name ?? id}
                        </h3>
                        <p>
                          {number(score.score, " / 100")} ·{" "}
                          {score.provisional ? "Provisional" : "Complete"}
                        </p>
                        <dl>
                          <dt>Model load · cold</dt>
                          <dd>
                            {number(run.initialization?.[id]?.loadMs, " ms")}
                          </dd>
                          <dt>Warm first token · median</dt>
                          <dd>{number(latency, " ms")}</dd>
                          <dt>Generation · median</dt>
                          <dd>{number(speed, " tok/s")}</dd>
                          <dt>Response · median</dt>
                          <dd>{number(metric("totalMs")?.median, " ms")}</dd>
                          <dt>First-token spread</dt>
                          <dd>
                            {number(metric("firstTokenMs")?.spread, " ms")}
                          </dd>
                          <dt>Failed cases</dt>
                          <dd>{rows.filter((r) => r.error).length}</dd>
                        </dl>
                      </article>
                    );
                  })}
                </div>
                <details className="il-panel">
                  <summary>Scoring weights & methodology</summary>
                  <p>
                    Latency: 100 at ≤1 second, decreases in inverse proportion.
                    Speed: 100 at ≥15 tok/s. Manual ratings: 1–5 scaled to
                    20–100. Tools: fraction passing. RAM and battery efficiency
                    are unranked pending meaningful device evidence. Missing
                    weights stay in the denominator; rankings are provisional.
                  </p>
                  <div className="il-config">
                    {Object.entries(weights).map(([key, value]) => (
                      <label key={key}>
                        {key}
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={value}
                          onChange={(e) =>
                            setWeights((w) => ({
                              ...w,
                              [key]: Math.max(
                                0,
                                Math.min(100, Number(e.target.value)),
                              ),
                            }))
                          }
                        />
                      </label>
                    ))}
                  </div>
                </details>
                <div className="il-results">
                  {run.rows.map((row, i) => (
                    <details key={`${row.modelId}-${row.caseId}-${i}`}>
                      <summary>
                        {row.caseId} · {row.modelId} ·{" "}
                        {row.error
                          ? "Failed"
                          : row.automatic === true
                            ? "Check passed"
                            : row.automatic === false
                              ? "Check failed"
                              : "Needs your rating"}
                      </summary>
                      <p>
                        {QUALITY_CASES.find((c) => c.id === row.caseId)?.rubric}
                      </p>
                      <pre>{row.error ?? row.response}</pre>
                      <label>
                        Quality rating
                        <select
                          value={row.manualRating ?? ""}
                          onChange={(e) =>
                            setRun((r) =>
                              r
                                ? {
                                    ...r,
                                    rows: r.rows.map((v, n) =>
                                      n === i
                                        ? {
                                            ...v,
                                            manualRating: e.target.value
                                              ? Number(e.target.value)
                                              : undefined,
                                          }
                                        : v,
                                    ),
                                  }
                                : r,
                            )
                          }
                        >
                          <option value="">Not rated</option>
                          {[1, 2, 3, 4, 5].map((n) => (
                            <option key={n}>{n}</option>
                          ))}
                        </select>
                      </label>
                    </details>
                  ))}
                </div>
              </>
            )}
            <details className="il-panel">
              <summary>Evaluation cases · 100</summary>
              {QUALITY_CASES.map((c) => (
                <p key={c.id}>
                  <strong>{c.id}</strong> — {c.prompt}
                </p>
              ))}
            </details>
            {history.length > 0 && (
              <section className="il-panel">
                <h3>Recent benchmark runs</h3>
                <button
                  disabled={busy}
                  onClick={() =>
                    void operation(async () => {
                      if (confirm("Clear locally saved benchmark history?")) {
                        await ModelStore.clearBenchmarks({ confirm: true });
                        setHistory([]);
                      }
                    })
                  }
                >
                  Clear history
                </button>
                {history.map((h) => (
                  <button key={h.id} onClick={() => setRun(h)}>
                    {new Date(h.at).toLocaleTimeString()} · {h.rows.length}{" "}
                    results
                  </button>
                ))}
                <p>
                  Export results to retain them. Custom prompts are never saved
                  automatically.
                </p>
              </section>
            )}
          </>
        )}
        {tab === "settings" && (
          <>
            <div className="il-title">
              <div>
                <p>CPU FIRST</p>
                <h2>Make it yours.</h2>
              </div>
            </div>
            <section className="il-panel">
              <div className="il-config">
                {(
                  [
                    "threads",
                    "context",
                    "maxTokens",
                    "batch",
                    "temperature",
                    "topP",
                    "topK",
                    "repetition",
                    "seed",
                  ] as const
                ).map((key) => (
                  <label key={key}>
                    {key}
                    <input
                      type="number"
                      step={
                        ["temperature", "topP", "repetition"].includes(key)
                          ? ".05"
                          : "1"
                      }
                      value={config[key]}
                      onChange={(e) =>
                        setConfig((c) => ({
                          ...c,
                          [key]: Number(e.target.value),
                        }))
                      }
                    />
                  </label>
                ))}
              </div>
              <label className="il-field">
                Chat template
                <select
                  value={config.chatTemplate}
                  onChange={(e) =>
                    setConfig((c) => ({
                      ...c,
                      chatTemplate: e.target
                        .value as InferenceConfig["chatTemplate"],
                    }))
                  }
                >
                  {[
                    "model",
                    "chatml",
                    "llama3",
                    "gemma",
                    "qwen3",
                    "lfm2",
                    "lfm3",
                  ].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
              <label className="il-check">
                <input
                  type="checkbox"
                  checked={config.thinking}
                  onChange={(e) =>
                    setConfig((c) => ({ ...c, thinking: e.target.checked }))
                  }
                />
                Thinking mode · requires a compatible template
              </label>
              <p>
                Use the model template unless the publisher explicitly requires
                an override. GPU offload is unavailable. Context and thread
                limits are validated natively.
              </p>
              <div className="il-actions">
                <button
                  disabled={!native || busy}
                  onClick={() =>
                    void operation(() =>
                      AtlasNative.configure({
                        options: validateInference(config),
                      }),
                    )
                  }
                >
                  Save settings
                </button>
                <button onClick={() => setConfig({ ...DEFAULT_INFERENCE })}>
                  Reset defaults
                </button>
                <button
                  disabled={!native || busy}
                  onClick={() => void operation(() => AtlasNative.unload())}
                >
                  Unload model
                </button>
              </div>
              <p className="il-muted">
                By default, models unload after 2 minutes idle and on memory
                pressure. Thermal protection blocks loading when severely
                overheated. No model is loaded at app launch. CPU only; battery
                and sustained thermal performance still need phone testing.
              </p>
            </section>
            <section className="il-panel">
              <h3>Model residency</h3>
              <label className="il-check">
                <input
                  type="checkbox"
                  checked={policy.keepResident}
                  onChange={(e) =>
                    setPolicy((p) => ({ ...p, keepResident: e.target.checked }))
                  }
                />
                Keep model in memory · higher RAM use
              </label>
              <label className="il-field">
                Unload after idle seconds
                <input
                  type="number"
                  min={30}
                  max={1800}
                  value={policy.idleSeconds}
                  onChange={(e) =>
                    setPolicy((p) => ({
                      ...p,
                      idleSeconds: Number(e.target.value),
                    }))
                  }
                />
              </label>
              <label className="il-check">
                <input
                  type="checkbox"
                  checked={policy.streaming}
                  onChange={(e) =>
                    setPolicy((p) => ({ ...p, streaming: e.target.checked }))
                  }
                />
                Stream text into the playground
              </label>
              <button
                disabled={!native || busy}
                onClick={() =>
                  void operation(() => AtlasNative.setPolicy({ policy }))
                }
              >
                Save runtime policy
              </button>
              <p>
                Memory-pressure cleanup still applies when residency is enabled.
                Voice uses sentence streaming independently.
              </p>
            </section>
            <section className="il-panel">
              <h3>Device snapshot</h3>
              <dl>
                <dt>Runtime</dt>
                <dd>{runtime?.engine ?? "Unavailable"}</dd>
                <dt>Available RAM</dt>
                <dd>{bytes(runtime?.availableMemoryBytes)}</dd>
                <dt>Process PSS</dt>
                <dd>{bytes(runtime?.processPssBytes)}</dd>
                <dt>Thermal status · Android scale</dt>
                <dd>{runtime?.thermalStatus ?? "Unavailable"}</dd>
              </dl>
              <p>{runtime?.reason}</p>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
