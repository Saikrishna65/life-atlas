"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BatteryCharging,
  Bell,
  CheckCircle2,
  ClipboardCopy,
  Download,
  FlaskConical,
  Mic,
  MicOff,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  SlidersHorizontal,
  Square,
  Trash2,
  Upload,
} from "lucide-react";
import "./control-room.css";
import {
  atlasWakeWordBridge,
  classifyActiveWakeModel,
  EXPERIMENT_SCENARIOS,
  isWakeWordNativeSupported,
  type AssistantRoleStatus,
  type WakeWordDetectionEvent,
  type WakeWordDiagnosticReport,
  type WakeWordListeningStatus,
} from "@/lib/wakeword/atlasWakeWord";

const SCENARIO_STATUS_OPTIONS = [
  { value: "passed", label: "Pass" },
  { value: "partial", label: "Partial" },
  { value: "failed", label: "Fail" },
  { value: "blocked", label: "Blocked" },
] as const;

export default function HeyAtlasExperiment() {
  const [nativeSupported] = useState(() => isWakeWordNativeSupported());
  const [status, setStatus] = useState<WakeWordListeningStatus | null>(null);
  const [report, setReport] = useState<WakeWordDiagnosticReport | null>(null);
  const [assistantRole, setAssistantRole] = useState<AssistantRoleStatus>({
    roleAvailable: false,
    roleHeld: false,
    voiceInteractionServiceBound: false,
  });
  const [useAssistantSession, setUseAssistantSession] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [scenarioNotes, setScenarioNotes] = useState<Record<string, string>>({});
  const [showTrainingGuide, setShowTrainingGuide] = useState(false);

  const refreshAll = useCallback(async () => {
    try {
      const [nextStatus, nextReport, nextRole] = await Promise.all([
        atlasWakeWordBridge.getListeningStatus(),
        atlasWakeWordBridge.getDiagnosticReport(),
        atlasWakeWordBridge.getAssistantRoleStatus(),
      ]);
      setStatus(nextStatus);
      setReport(nextReport);
      setAssistantRole(nextRole);
      setScenarioNotes((prev) => {
        const merged = { ...prev };
        for (const [key, val] of Object.entries(nextReport.scenarioResults || {})) {
          if (merged[key] === undefined && val?.notes) {
            merged[key] = val.notes;
          }
        }
        return merged;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load wake-word diagnostics.");
    }
  }, []);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      if (active) void refreshAll();
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [refreshAll]);

  useEffect(() => {
    if (!nativeSupported) return;
    let disposed = false;
    let wakeHandle: { remove: () => Promise<void> } | null = null;
    let statusHandle: { remove: () => Promise<void> } | null = null;

    void atlasWakeWordBridge
      .addWakeWordDetectedListener((ev: WakeWordDetectionEvent) => {
        if (disposed) return;
        setNotice(
          `Wake detected (${ev.targetPhrase}) score=${ev.score.toFixed(3)} latency=${ev.inferenceLatencyMs.toFixed(1)} ms`
        );
        void refreshAll();
      })
      .then((h) => {
        if (disposed) void h?.remove();
        else wakeHandle = h;
      });

    void atlasWakeWordBridge
      .addStatusChangedListener((nextStatus: WakeWordListeningStatus) => {
        if (disposed) return;
        setStatus(nextStatus);
        void refreshAll();
      })
      .then((h) => {
        if (disposed) void h?.remove();
        else statusHandle = h;
      });

    const interval = window.setInterval(() => {
      void refreshAll();
    }, 3000);

    return () => {
      disposed = true;
      window.clearInterval(interval);
      void wakeHandle?.remove();
      void statusHandle?.remove();
    };
  }, [nativeSupported, refreshAll]);

  const loadedModel = status?.loadedModel ?? report?.loadedModel;
  const modelClass = useMemo(() => classifyActiveWakeModel(loadedModel), [loadedModel]);

  const runAction = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
      await refreshAll();
      setNotice(label);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  };

  const handleCopyReport = async () => {
    if (!report) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(report, null, 2));
      setNotice("Diagnostic JSON copied to clipboard.");
      setError("");
    } catch {
      setError("Clipboard copy failed on this device.");
    }
  };

  const handleDownloadReport = () => {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hey-atlas-diagnostics-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setNotice("Exported diagnostic JSON file.");
  };

  return (
    <div className="control-orbit" data-control-room>
      <aside className="oc-rail">
        <Link href="/secret/control-room" className="oc-home">
          <ArrowLeft size={16} /> Control Room
        </Link>
        <div className="oc-wordmark">
          <FlaskConical size={20} />
          <div>
            Experiments
            <small>HEY ATLAS · POF ANDROID 16</small>
          </div>
        </div>
      </aside>

      <main className="oc-main">
        <header className="oc-header">
          <div>
            <p className="oc-eyebrow">ISOLATED HARDWARE &amp; OS FEASIBILITY EXPERIMENT</p>
            <h1>Hey Atlas Wake-Word</h1>
            <p>
              Offline ONNX Runtime + openWakeWord pipeline isolated from Life Atlas vaults and cloud LLMs. Designed to test
              realistic Android 16 behavior on Motorola Edge 50 Fusion without privileged permissions or accessibility hacks.
            </p>
          </div>
          <button
            type="button"
            className="oc-icon-button"
            onClick={() => void refreshAll()}
            aria-label="Refresh telemetry"
            title="Refresh telemetry"
          >
            <RefreshCw size={16} />
          </button>
        </header>

        {!nativeSupported && (
          <div className="oc-notice oc-error" role="status">
            <ShieldAlert size={16} />
            <span>
              Browser / SSR preview detected. AudioRecord capture and ONNX Runtime wake-word inference only run inside the
              installed Android APK.
            </span>
          </div>
        )}

        {modelClass.warningText && (
          <div className="oc-notice oc-error" role="status">
            <AlertTriangle size={16} />
            <span>{modelClass.warningText}</span>
          </div>
        )}

        {notice && (
          <div className="oc-notice" role="status">
            <CheckCircle2 size={16} />
            <span>{notice}</span>
          </div>
        )}

        {error && (
          <div className="oc-notice oc-error" role="alert">
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
        )}

        <section className="oc-command-card">
          <p className="oc-eyebrow">MICROPHONE FOREGROUND SERVICE</p>
          <h2>
            {status?.running
              ? status.paused
                ? "Listening Paused"
                : status.micSilenced
                  ? "Mic Silenced by Android"
                  : "Listening Offline"
              : "Experiment Stopped"}
          </h2>
          <div className="oc-command-status">
            <span>State: {status?.serviceState ?? "stopped"}</span>
            <span>Active Phrase: {modelClass.spokenPhraseLabel}</span>
            <span>{status?.lastStateReason ?? "Not started"}</span>
          </div>

          <div className="oc-rule" style={{ borderTop: "1px solid var(--oc-line)", marginTop: 18 }}>
            <div>
              <strong>Launch Experimental VoiceInteractionSession on Wake</strong>
              <p>
                Optional: requires holding Android&apos;s Default Assistant role; falls back cleanly to chime + notification if
                unavailable.
              </p>
            </div>
            <input
              type="checkbox"
              checked={useAssistantSession}
              onChange={(e) => setUseAssistantSession(e.target.checked)}
              disabled={busy}
              aria-label="Launch Experimental VoiceInteractionSession on Wake"
            />
          </div>

          <div className="oc-actions">
            {!status?.running ? (
              <button
                type="button"
                className="oc-primary"
                disabled={busy || !nativeSupported}
                onClick={() =>
                  void runAction("Wake-word foreground service started.", () =>
                    atlasWakeWordBridge.startListening({ useAssistantSession })
                  )
                }
              >
                <Mic size={15} /> Enable Wake-Word Experiment
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="oc-danger"
                  disabled={busy}
                  onClick={() =>
                    void runAction("Wake-word foreground service stopped.", () => atlasWakeWordBridge.stopListening())
                  }
                >
                  <Square size={15} /> Stop Experiment
                </button>
                {status.paused ? (
                  <button
                    type="button"
                    className="oc-secondary"
                    disabled={busy}
                    onClick={() =>
                      void runAction("Resumed listening.", () => atlasWakeWordBridge.resumeListening())
                    }
                  >
                    <Play size={15} /> Resume
                  </button>
                ) : (
                  <button
                    type="button"
                    className="oc-secondary"
                    disabled={busy}
                    onClick={() =>
                      void runAction("Paused listening.", () => atlasWakeWordBridge.pauseListening())
                    }
                  >
                    <Pause size={15} /> Pause
                  </button>
                )}
              </>
            )}
          </div>
        </section>

        <section className="oc-meters" aria-label="Wake-word telemetry">
          <div className="oc-meter">
            <Activity size={18} />
            <span>DETECTIONS</span>
            <strong>
              {report?.detectionCount ?? 0}
              <small>hits</small>
            </strong>
            <p>
              FP: {report?.falsePositiveCount ?? 0} · Missed: {report?.missedActivationCount ?? 0}
            </p>
          </div>
          <div className="oc-meter">
            <SlidersHorizontal size={18} />
            <span>LATENCY (LAST / AVG)</span>
            <strong>
              {(report?.lastDetectionLatencyMs ?? 0).toFixed(1)}
              <small>ms</small>
            </strong>
            <p>Avg {(report?.avgDetectionLatencyMs ?? 0).toFixed(1)} ms · Frames {report?.framesProcessed ?? 0}</p>
          </div>
          <div className="oc-meter">
            <BatteryCharging size={18} />
            <span>FOOTPRINT ESTIMATE</span>
            <strong>
              {(report?.memoryMbEstimate ?? 0).toFixed(0)}
              <small>MB</small>
            </strong>
            <p>
              CPU ~{(report?.cpuPercentEstimate ?? 0).toFixed(1)}% · Mic conflicts {report?.micCompetitionCount ?? 0}
            </p>
          </div>
        </section>

        <section className="oc-panel">
          <div className="oc-panel-title">
            <div>
              <p className="oc-eyebrow">ACCURACY MARKERS</p>
              <h2>Manual Trigger Counters</h2>
            </div>
            <span className="oc-tag">
              Peak score {(report?.peakScore ?? 0).toFixed(3)} · Last {(report?.lastScore ?? 0).toFixed(3)}
            </span>
          </div>
          <div className="oc-actions">
            <button
              type="button"
              className="oc-secondary"
              disabled={busy || !nativeSupported}
              onClick={() =>
                void runAction("Logged false positive trigger.", () => atlasWakeWordBridge.markFalsePositive())
              }
            >
              <MicOff size={14} /> Mark False Positive (+1)
            </button>
            <button
              type="button"
              className="oc-secondary"
              disabled={busy || !nativeSupported}
              onClick={() =>
                void runAction("Logged missed activation.", () =>
                  atlasWakeWordBridge.markMissedActivation("Manual user mark during test")
                )
              }
            >
              <AlertTriangle size={14} /> Mark Missed Activation (+1)
            </button>
          </div>
        </section>

        <section className="oc-panel">
          <div className="oc-panel-title">
            <div>
              <p className="oc-eyebrow">LOADED OPENWAKEWORD CLASSIFIER</p>
              <h2>{loadedModel?.displayName ?? "No model loaded"}</h2>
            </div>
            <span className="oc-tag">{modelClass.badgeText}</span>
          </div>

          <div className="oc-info-line">
            <span>Target Spoken Phrase</span>
            <strong>{loadedModel?.targetPhrase ?? "N/A"}</strong>
          </div>
          <div className="oc-info-line">
            <span>True &quot;Hey Atlas&quot; Trained Model</span>
            <strong>{loadedModel?.isCustomHeyAtlasModel ? "Yes (Custom ONNX)" : "No (Test Model Only)"}</strong>
          </div>
          <div className="oc-info-line">
            <span>Threshold / Embedding Window</span>
            <strong>
              {loadedModel?.threshold.toFixed(2) ?? "0.50"} / {loadedModel?.requiredEmbeddingFrames ?? 16} frames
            </strong>
          </div>
          <div className="oc-info-line">
            <span>SHA-256 Prefix</span>
            <strong>{loadedModel?.sha256 ? loadedModel.sha256.slice(0, 16) : "—"}</strong>
          </div>
          <div className="oc-info-line">
            <span>License / Attribution</span>
            <strong>{loadedModel?.licenseNote ?? "—"}</strong>
          </div>

          <div className="oc-actions" style={{ marginTop: 18 }}>
            <button
              type="button"
              className="oc-primary"
              disabled={busy || !nativeSupported}
              onClick={() =>
                void runAction("Imported custom ONNX model.", () => atlasWakeWordBridge.importCustomModel(0.5))
              }
            >
              <Upload size={14} /> Import Custom hey_atlas.onnx
            </button>
            <button
              type="button"
              className="oc-secondary"
              disabled={busy || !nativeSupported}
              onClick={() =>
                void runAction("Reset to bundled Hey Jarvis test model.", () =>
                  atlasWakeWordBridge.resetToTestModel()
                )
              }
            >
              <RotateCcw size={14} /> Reset to Bundled Test Model
            </button>
            <button
              type="button"
              className="oc-text"
              onClick={() => setShowTrainingGuide((prev) => !prev)}
            >
              {showTrainingGuide ? "Hide Custom Training Requirements" : "View Custom Training Requirements"}
            </button>
          </div>

          {showTrainingGuide && (
            <div className="oc-conflict-help" style={{ marginTop: 16 }}>
              <p>
                <strong>Training a custom &quot;Hey Atlas&quot; ONNX classifier (openWakeWord):</strong>
              </p>
              <p>
                1. No pre-trained &quot;Hey Atlas&quot; weight ships with dscripka/openWakeWord. Collect or generate positive
                samples (Piper TTS + diverse voices for &quot;Hey Atlas&quot; / &quot;hey at-las&quot;) and hard negatives (&quot;Hey
                Alice&quot;, &quot;Atlas&quot;, conversation speech, RIR/noise augmentation).
              </p>
              <p>
                2. Run openWakeWord&apos;s automated training notebook (`train.py` / Colab) exporting an ONNX classifier with
                input shape `[batch, 16, 96]` matched to bundled `melspectrogram.onnx` and `embedding_model.onnx`.
              </p>
              <p>
                3. Copy the exported `hey_atlas.onnx` onto your Motorola Edge 50 Fusion and tap <strong>Import Custom
                hey_atlas.onnx</strong> above. See `docs/experiments/hey-atlas-wakeword.md` for full specs.
              </p>
            </div>
          )}
        </section>

        <section className="oc-panel">
          <div className="oc-panel-title">
            <div>
              <p className="oc-eyebrow">ANDROID 16 PERMISSIONS, BATTERY &amp; DEFAULT ASSISTANT</p>
              <h2>Device Constraints &amp; Settings</h2>
            </div>
            <span className="oc-tag">{report?.deviceModel || "Motorola Edge 50 Fusion"}</span>
          </div>

          <div className="oc-permission">
            <div className="oc-permission-icon">
              <Mic size={18} />
            </div>
            <div>
              <h3>Microphone Permission (RECORD_AUDIO)</h3>
              <p>Granted automatically when you tap Enable Wake-Word Experiment, or verify status here.</p>
              <span className="oc-permission-state">
                {status?.microphoneGranted ? "Granted" : "Not Granted"}
              </span>
            </div>
          </div>

          <div className="oc-permission">
            <div className="oc-permission-icon">
              <Bell size={18} />
            </div>
            <div>
              <h3>Notifications (POST_NOTIFICATIONS)</h3>
              <p>Needed on Android 13–16 to show the persistent Listening indicator and wake detection alerts.</p>
              <span className="oc-permission-state">
                {status?.notificationsGranted ? "Granted" : "Not Granted"}
              </span>
            </div>
            <button
              type="button"
              className="oc-secondary"
              disabled={busy || !nativeSupported}
              onClick={() =>
                void runAction("Checked notification permission.", () =>
                  atlasWakeWordBridge.requestNotificationPermission()
                )
              }
            >
              Request
            </button>
          </div>

          <div className="oc-permission">
            <div className="oc-permission-icon">
              <BatteryCharging size={18} />
            </div>
            <div>
              <h3>Motorola Battery Optimization</h3>
              <p>
                Compare Default vs Unrestricted mode for Test D (screen-off Doze). Set App battery usage to Unrestricted to
                test long background microphone survival.
              </p>
              <span className="oc-permission-state">
                {status?.ignoringBatteryOptimizations ? "Unrestricted (Ignoring Battery Opt)" : "Optimized / Restricted"}
              </span>
            </div>
            <button
              type="button"
              className="oc-secondary"
              disabled={busy || !nativeSupported}
              onClick={() =>
                void runAction("Opened Android battery settings.", () =>
                  atlasWakeWordBridge.openBatteryOptimizationSettings()
                )
              }
            >
              Battery Settings
            </button>
          </div>

          <div className="oc-permission">
            <div className="oc-permission-icon">
              <SlidersHorizontal size={18} />
            </div>
            <div>
              <h3>Default Assistant Role Experiment (Separate)</h3>
              <p>
                Optional Android `RoleManager.ROLE_ASSISTANT` &amp; `VoiceInteractionService` feasibility check. Does NOT grant
                Google&apos;s hardware screen-off DSP hotword privileges.
              </p>
              <span className="oc-permission-state">
                Role Held: {assistantRole.roleHeld ? "Yes" : "No"} · VIS Bound:{" "}
                {assistantRole.voiceInteractionServiceBound ? "Yes" : "No"}
              </span>
            </div>
            <div className="oc-actions">
              <button
                type="button"
                className="oc-secondary"
                disabled={busy || !nativeSupported}
                onClick={() =>
                  void runAction("Requested Android Assistant role dialog.", () =>
                    atlasWakeWordBridge.requestAssistantRole()
                  )
                }
              >
                Request Role
              </button>
              <button
                type="button"
                className="oc-secondary"
                disabled={busy || !nativeSupported}
                onClick={() =>
                  void runAction("Opened Digital Assistant settings.", () =>
                    atlasWakeWordBridge.openAssistantSettings()
                  )
                }
              >
                Settings
              </button>
            </div>
          </div>
        </section>

        <section className="oc-panel">
          <div className="oc-panel-title">
            <div>
              <p className="oc-eyebrow">MOTOROLA EDGE 50 FUSION (ANDROID 16) BENCHMARK</p>
              <h2>Field Verification Matrix (Tests A–H)</h2>
            </div>
            <span className="oc-tag">No Fake Claims</span>
          </div>

          {EXPERIMENT_SCENARIOS.map((scenario) => {
            const recorded = report?.scenarioResults?.[scenario.id];
            const currentNote = scenarioNotes[scenario.id] ?? recorded?.notes ?? "";
            return (
              <div
                key={scenario.id}
                style={{
                  borderTop: "1px solid var(--oc-line)",
                  padding: "18px 0",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                  <h3>{scenario.title}</h3>
                  <span className="oc-tag">
                    {recorded?.status ? `${recorded.status.toUpperCase()}` : "UNTESTED"}
                  </span>
                </div>
                <p style={{ fontSize: 12, marginTop: 6 }}>{scenario.expectedHonestOutcome}</p>
                <ul style={{ margin: "8px 0 10px 18px", fontSize: 12, color: "var(--oc-sub)" }}>
                  {scenario.steps.map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ul>
                <input
                  type="text"
                  value={currentNote}
                  onChange={(e) => setScenarioNotes((prev) => ({ ...prev, [scenario.id]: e.target.value }))}
                  placeholder={`Observed result & notes on Motorola Edge 50 Fusion (${scenario.id})...`}
                  style={{
                    width: "100%",
                    padding: "9px 11px",
                    borderRadius: 9,
                    border: "1px solid #dfe2d8",
                    background: "#fafaf7",
                    fontSize: 12,
                    marginBottom: 10,
                  }}
                />
                <div className="oc-actions">
                  {SCENARIO_STATUS_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      className={recorded?.status === opt.value ? "oc-primary" : "oc-secondary"}
                      disabled={busy || !nativeSupported}
                      onClick={() =>
                        void runAction(`Saved ${scenario.id}: ${opt.label}`, () =>
                          atlasWakeWordBridge.recordScenarioResult(scenario.id, opt.value, currentNote)
                        )
                      }
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </section>

        <section className="oc-two-col">
          <div className="oc-panel">
            <div className="oc-panel-title">
              <div>
                <p className="oc-eyebrow">RECENT TRIGGERS</p>
                <h2>Detection Log</h2>
              </div>
              <span className="oc-tag">{report?.detections?.length ?? 0}</span>
            </div>
            {(report?.detections?.length ?? 0) === 0 ? (
              <p style={{ fontSize: 12 }}>No wake-word detections recorded yet.</p>
            ) : (
              report!.detections.slice(0, 12).map((d, idx) => (
                <div key={idx} className="oc-info-line">
                  <span>
                    {d.targetPhrase} ({d.score.toFixed(2)}) ·{" "}
                    {d.environment.keyguardLocked ? "locked" : d.environment.interactive ? "screen-on" : "screen-off"}
                  </span>
                  <strong>{d.inferenceLatencyMs.toFixed(1)} ms</strong>
                </div>
              ))
            )}
          </div>

          <div className="oc-panel">
            <div className="oc-panel-title">
              <div>
                <p className="oc-eyebrow">SERVICE TELEMETRY</p>
                <h2>Lifecycle Events</h2>
              </div>
              <span className="oc-tag">{report?.lifecycleEvents?.length ?? 0}</span>
            </div>
            {(report?.lifecycleEvents?.length ?? 0) === 0 ? (
              <p style={{ fontSize: 12 }}>No lifecycle events recorded yet.</p>
            ) : (
              report!.lifecycleEvents.slice(0, 12).map((ev, idx) => (
                <div key={idx} className="oc-info-line">
                  <span>{ev.kind}</span>
                  <strong>{ev.detail}</strong>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="oc-panel">
          <div className="oc-panel-title">
            <div>
              <p className="oc-eyebrow">DIAGNOSTIC REPORT</p>
              <h2>Export or Reset Experiment Data</h2>
            </div>
          </div>
          <div className="oc-actions">
            <button type="button" className="oc-secondary" onClick={() => void handleCopyReport()} disabled={!report}>
              <ClipboardCopy size={14} /> Copy Diagnostic JSON
            </button>
            <button type="button" className="oc-secondary" onClick={handleDownloadReport} disabled={!report}>
              <Download size={14} /> Export JSON Report
            </button>
            <button
              type="button"
              className="oc-danger"
              disabled={busy || !nativeSupported}
              onClick={() =>
                void runAction("Cleared wake-word diagnostic counters.", () =>
                  atlasWakeWordBridge.clearDiagnostics()
                )
              }
            >
              <Trash2 size={14} /> Clear Diagnostics
            </button>
          </div>
        </section>

        <footer className="oc-footer">
          <span>Life Atlas Private Lab · Zero raw audio saved or uploaded</span>
          <span>Offline ONNX Runtime PoC</span>
        </footer>
      </main>
    </div>
  );
}
