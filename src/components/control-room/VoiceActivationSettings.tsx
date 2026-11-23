"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  activationError,
  activationLabel,
  voiceActivation,
  type ActivationMode,
  type ActivationStatus,
} from "@/lib/wakeword/activation";
export default function VoiceActivationSettings({
  showExperimentLink = true,
}: {
  showExperimentLink?: boolean;
}) {
  const [status, setStatus] = useState<ActivationStatus>(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [consent, setConsent] = useState(false),
    [confirmed, setConfirmed] = useState(false);
  const alive = useRef(true),
    locked = useRef(false),
    observed = useRef("");
  const apply = (value: ActivationStatus) => {
    if (!alive.current) return;
    const identity = value.observedPackage + "\n" + value.observedClass;
    if (observed.current !== identity) {
      observed.current = identity;
      setConfirmed(false);
    }
    setStatus(value);
    if (value.disclosureAccepted) setConsent(true);
  };
  useEffect(() => {
    alive.current = true;
    let disposed = false;
    const refresh = () => {
      if (!document.hidden)
        void voiceActivation
          .status()
          .then((value) => {
            if (!disposed) apply(value);
          })
          .catch((e) => {
            if (!disposed) setError(activationError(e));
          });
    };
    refresh();
    let remove: (() => Promise<void>) | undefined;
    void voiceActivation
      .onStatus(refresh)
      .then((handle) => {
        if (!handle) return;
        if (disposed) void handle.remove();
        else remove = () => handle.remove();
      })
      .catch(() => {});
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      disposed = true;
      alive.current = false;
      void remove?.();
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  const run = async (action: () => Promise<unknown>) => {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (e) {
      if (alive.current) setError(activationError(e));
    } finally {
      try {
        apply(await voiceActivation.status());
      } catch {
        /* Keep previous status and the action's safe error. */
      }
      locked.current = false;
      if (alive.current) setBusy(false);
    }
  };
  const change = (mode: ActivationMode) =>
    void run(async () => {
      apply(await voiceActivation.setMode(mode, consent));
    });
  return (
    <section className="oc-panel" aria-label="Voice activation">
      <div className="oc-panel-title">
        <div>
          <p className="oc-eyebrow">VOICE ACTIVATION</p>
          <h2>How Atlas wakes up.</h2>
        </div>
      </div>
      <p>
        Choose one method for testing. Switching stops the previous audio
        session first. The Google bridge is experimental and does not prove
        lower battery use or reliable locked-screen activation.
      </p>
      <p role="status">
        {status
          ? activationLabel(status)
          : error
            ? "Activation status unavailable. Reopen this screen to retry."
            : "Reading activation settings…"}
      </p>
      {error && <p role="alert">{error}</p>}
      <fieldset
        disabled={busy || !status?.supported}
        style={{ border: 0, padding: 0, margin: 0 }}
      >
        <legend className="sr-only">Activation method</legend>
        <div className="oc-actions">
          {(
            [
              ["microphone", "Hey Atlas microphone listener"],
              ["google-bridge", "Google bridge · experimental"],
              ["off", "Off"],
            ] as const
          ).map(([mode, label]) => (
            <button
              key={mode}
              className={status?.mode === mode ? "oc-primary" : "oc-secondary"}
              aria-pressed={status?.mode === mode}
              disabled={mode === "google-bridge" && !consent}
              onClick={() => change(mode)}
            >
              {busy ? "Switching…" : label}
            </button>
          ))}
        </div>
        <details style={{ marginTop: 16 }}>
          <summary>Google bridge permission and setup</summary>
          <p>
            Atlas observes window identity changes to recognise the exact
            Google/Gemini overlay you confirm. It attempts to dismiss that
            window and opens Atlas voice. It never reads screen contents or
            Google transcripts, and does not use an idle microphone in this
            mode. Other app identities are compared only in memory to observe
            dismissal. Opening the assistant manually may also trigger Atlas.
            Google may hear or act on words spoken before handoff.
          </p>
          <label className="oc-checkbox">
            <input
              type="checkbox"
              disabled={status?.disclosureAccepted}
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />{" "}
            I understand and allow this experimental window-based handoff.
          </label>
          <p>
            Keep Google/Gemini as Android’s default assistant and enable Voice
            Match there. Select Google bridge, then enable{" "}
            <strong>Atlas Google voice bridge (experimental)</strong> in
            Accessibility. It starts in Observe only mode. Say “Hey Google”,
            then return here and refresh.
          </p>
          <div className="oc-actions">
            <button
              className="oc-secondary"
              disabled={!consent}
              onClick={() =>
                void run(() => voiceActivation.openAccessibility())
              }
            >
              Open Android Accessibility
            </button>
            <button
              className="oc-secondary"
              onClick={() =>
                void run(async () => apply(await voiceActivation.status()))
              }
            >
              Refresh activation status
            </button>
          </div>
          <p>
            Last observed Google window:{" "}
            <code style={{ overflowWrap: "anywhere" }}>
              {status?.observedPackage || "None yet"}
              {status?.observedClass ? ` · ${status.observedClass}` : ""}
            </code>
          </p>
          <label className="oc-checkbox">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />{" "}
            I checked that this is the assistant overlay, not a normal
            Google/Gemini screen.
          </label>
          <div className="oc-actions">
            <button
              className="oc-primary"
              disabled={!consent || !confirmed || !status?.observedClass}
              onClick={() =>
                void run(async () => {
                  apply(
                    await voiceActivation.configure({
                      observeOnly: false,
                      packageName: status!.observedPackage,
                      className: status!.observedClass,
                      confirmOverlay: true,
                    }),
                  );
                  setConfirmed(false);
                })
              }
            >
              Enable handoff for this window
            </button>
            <button
              className="oc-secondary"
              onClick={() =>
                void run(async () =>
                  apply(await voiceActivation.configure({ observeOnly: true })),
                )
              }
            >
              Use Observe only
            </button>
          </div>
          {status?.overlayClass && (
            <p>
              Approved overlay:{" "}
              <code style={{ overflowWrap: "anywhere" }}>
                {status.overlayPackage} · {status.overlayClass}
              </code>
            </p>
          )}
          <p>
            Say “Hey Google”, pause, then speak after Atlas’s listening cue.
            While locked, the native voice fallback has fewer capabilities than
            the full Atlas app. Off stops Atlas activation; you can also disable
            its accessibility service in Android settings.
          </p>
        </details>
        <details style={{ marginTop: 16 }}>
          <summary>Local test diagnostics</summary>
          <p>{status?.reason}</p>
          <p>
            {status?.attempts ?? 0} launch requests · {status?.opened ?? 0}{" "}
            conversations started · {status?.failures ?? 0} handoff failures
          </p>
          <p>
            Last handoff: {status?.lastHandoffMs ?? 0} ms · average:{" "}
            {status?.averageHandoffMs ?? 0} ms
          </p>
          <p>
            Bridge voice listening time:{" "}
            {Math.round((status?.listeningMs ?? 0) / 1000)} seconds (state
            estimate, not a battery or microphone hardware measurement). Counts
            reset when the app process ends. No conversation text or audio is
            stored in these diagnostics.
          </p>
          <div className="oc-actions">
            <button
              className="oc-secondary"
              onClick={() =>
                void run(async () => apply(await voiceActivation.status()))
              }
            >
              Refresh diagnostics
            </button>
            <button
              className="oc-secondary"
              onClick={() =>
                void run(async () =>
                  apply(await voiceActivation.clearMetrics()),
                )
              }
            >
              Clear activation diagnostics
            </button>
          </div>
        </details>
      </fieldset>
      {showExperimentLink && (
        <p>
          <Link href="/secret/control-room/experiments/hey-atlas">
            Open existing wake-word and voice diagnostics →
          </Link>
        </p>
      )}
    </section>
  );
}
