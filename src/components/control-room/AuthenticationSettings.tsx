"use client";
import LegacyAssistantRecovery from "./LegacyAssistantRecovery";
import { useEffect, useState } from "react";
import {
  authenticationScopes,
  defaultAuthenticationPolicy,
  getAuthenticationPolicy,
  saveAuthenticationPolicy,
  supportsAuthenticationSettings,
  type AuthenticationPolicy,
  type AuthenticationScope,
} from "@/lib/security/authentication";
const labels: Record<AuthenticationScope, [string, string]> = {
  app: ["Opening Atlas", "Verify when opening or returning to the app."],
  gallery: [
    "Gallery and private cloud library",
    "Protect viewing your photos and private cloud collection.",
  ],
  privateSections: [
    "Private sections",
    "Protect Atlas Trips, Music, Finance and Atlas AI.",
  ],
  cloudCredentials: [
    "Cloud credentials",
    "Protect changing buckets, credentials and connection settings.",
  ],
  publishing: [
    "Publishing to the website",
    "Verify before approving a public publishing session.",
  ],
  deletion: [
    "Deleting files",
    "Protect destructive phone and cloud actions. Ordinary confirmations remain.",
  ],
  backups: [
    "Backups and recovery",
    "Protect exports, restores and private backup configuration.",
  ],
  aiActions: [
    "Atlas AI local actions",
    "Verify before the assistant accesses local modules. No separate AI phrase.",
  ],
};
export default function AuthenticationSettings() {
  const [policy, setPolicy] = useState<AuthenticationPolicy>(
      defaultAuthenticationPolicy,
    ),
    [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const supported = supportsAuthenticationSettings();
  useEffect(() => {
    let live = true;
    void getAuthenticationPolicy()
      .then((value) => {
        if (live) {
          setPolicy(value);
          setReady(true);
        }
      })
      .catch(() => {
        if (live)
          setError(
            "Could not read authentication settings. Your existing protections are unchanged.",
          );
      });
    return () => {
      live = false;
    };
  }, []);
  const update = async (key: AuthenticationScope, value: boolean) => {
    setBusy(true);
    setError("");
    try {
      setPolicy(await saveAuthenticationPolicy({ ...policy, [key]: value }));
    } catch (error) {
      setError(
        (error as { code?: string })?.code === "DEVICE_LOCK_REQUIRED"
          ? "Set a fingerprint or device PIN in Android settings before enabling protection."
          : "The change was not saved. Complete device verification or try again.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <section className="oc-panel" aria-label="Security and authentication">
        <div className="oc-panel-title">
          <div>
            <p className="oc-eyebrow">YOUR CHOICE</p>
            <h2>Security & authentication</h2>
          </div>
        </div>
        <p>
          All authentication is off by default. Turn on only the checks you
          want. Enabled checks use your phone’s fingerprint or device PIN,
          without a separate Atlas password.
        </p>
        <p>
          One successful verification covers enabled checks while Atlas stays in
          the foreground. Returning from the background requires verification
          again. Approved background transfers continue.
        </p>
        {!supported && (
          <p role="status">
            These controls are available in the updated Android app.
          </p>
        )}
        {error && <p role="alert">{error}</p>}
        {authenticationScopes.map((key) => (
          <label className="oc-rule" key={key}>
            <div>
              <strong>{labels[key][0]}</strong>
              <p>{labels[key][1]}</p>
            </div>
            <input
              type="checkbox"
              aria-label={labels[key][0]}
              checked={policy[key]}
              disabled={!supported || !ready || busy}
              onChange={(e) => void update(key, e.target.checked)}
            />
          </label>
        ))}
        <p className="oc-fine-print">
          Enabling or changing active protections verifies your device.
          Encryption stays enabled. Android permissions and delete/publish
          confirmations are separate from these settings.
        </p>
      </section>
      <LegacyAssistantRecovery />
    </>
  );
}
