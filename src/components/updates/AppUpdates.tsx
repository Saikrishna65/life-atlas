"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDownToLine, RefreshCw, ShieldCheck, X } from "lucide-react";
import { Modal } from "@/components/world/primitives";
import { useGalleryBack } from "@/lib/gallery/navigation";
import {
  supportsUpdates,
  Updates,
  type UpdateStatus,
} from "@/lib/updates/native";
import "./app-updates.css";
const mb = (bytes: number) => `${(bytes / 1048576).toFixed(1)} MB`;

export default function AppUpdates() {
  const [status, setStatus] = useState<UpdateStatus>();
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const active = useRef(true);
  const close = useCallback(() => setOpen(false), []);
  useGalleryBack(open, close, 160);
  const apply = useCallback((value: UpdateStatus) => {
    if (active.current) setStatus(value);
  }, []);
  useEffect(() => {
    if (!supportsUpdates()) return;
    active.current = true;
    const refresh = () => {
      if (document.visibilityState === "visible")
        void Updates.getStatus()
          .then(apply)
          .catch(() => {});
    };
    const show = () => {
      refresh();
      setOpen(true);
      setMessage("");
    };
    refresh();
    const timer = setTimeout(() => {
      if (document.visibilityState === "visible")
        void Updates.check({ automatic: true })
          .then(apply)
          .catch(() => {});
    }, 5000);
    window.addEventListener("atlas:updates-open", show);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      active.current = false;
      clearTimeout(timer);
      window.removeEventListener("atlas:updates-open", show);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [apply]);
  useEffect(() => {
    if (
      !busy &&
      !["checking", "downloading", "verifying"].includes(status?.phase || "")
    )
      return;
    const timer = setInterval(() => {
      void Updates.getStatus()
        .then(apply)
        .catch(() => {});
    }, 800);
    return () => clearInterval(timer);
  }, [busy, status?.phase, apply]);
  const run = async (operation: () => Promise<UpdateStatus>, success = "") => {
    setBusy(true);
    setMessage("");
    try {
      const value = await operation();
      apply(value);
      if (active.current && !value.error) setMessage(success);
    } catch {
      if (active.current)
        setMessage(
          "Could not check updates. Your installed app still works. Try again later.",
        );
    } finally {
      if (active.current) setBusy(false);
    }
  };
  if (!status) return null;
  const update = status.update;
  const working =
    busy || ["checking", "downloading", "verifying"].includes(status.phase);
  const showBanner =
    update && update.versionCode > status.postponedVersion && !open;
  return (
    <>
      {showBanner && (
        <aside
          className="atlas-update-banner"
          aria-label="Atlas update available"
        >
          <button onClick={() => setOpen(true)}>
            <ArrowDownToLine size={19} />
            <span>
              Atlas {update.versionName} is available
              <small>
                {status.ready ? "Ready to install" : "See what’s new"}
              </small>
            </span>
          </button>
          <button
            aria-label="Remind me about this update later"
            onClick={() => void Updates.configure({ later: true }).then(apply)}
          >
            <X size={18} />
          </button>
        </aside>
      )}
      {open && (
        <Modal
          onClose={close}
          title="Atlas updates"
          className="atlas-updates-dialog"
        >
          <header>
            <div>
              <p>YOUR ATLAS, UP TO DATE</p>
              <h2>Atlas updates</h2>
            </div>
            <button aria-label="Close updates" onClick={close}>
              <X size={22} />
            </button>
          </header>
          <p className="atlas-update-installed">
            Installed: Atlas {status.installedVersion}
          </p>
          {update ? (
            <section>
              <h3>Atlas {update.versionName}</h3>
              <p>{mb(update.bytes)} · your saved data stays in place</p>
              <p className="atlas-update-notes">{update.notes}</p>
            </section>
          ) : (
            <section>
              <h3>Your next update will appear here.</h3>
              <p>Check for new releases without leaving Atlas.</p>
            </section>
          )}
          {status.phase === "downloading" && update && (
            <div role="status">
              <progress
                aria-label="Update download"
                max={update.bytes}
                value={status.downloadedBytes}
              />
              <p>
                {mb(status.downloadedBytes)} / {mb(update.bytes)} ·{" "}
                {Math.min(
                  100,
                  Math.round((status.downloadedBytes / update.bytes) * 100),
                )}
                %
              </p>
            </div>
          )}
          {status.phase === "verifying" && (
            <p role="status">Verifying download and signing certificate…</p>
          )}
          {status.error && (
            <p className="atlas-update-error" role="alert">
              {status.error}
            </p>
          )}
          {message && <p role="status">{message}</p>}
          <div className="atlas-update-actions">
            {update && !status.ready && (
              <button
                className="is-primary"
                disabled={working}
                onClick={() =>
                  void run(() => Updates.download({ consent: true }))
                }
              >
                <ArrowDownToLine size={18} />
                {status.phase === "downloading"
                  ? "Downloading…"
                  : "Download update"}
              </button>
            )}
            {status.ready && (
              <button
                className="is-primary"
                disabled={working}
                onClick={() =>
                  void run(
                    () => Updates.install({ consent: true }),
                    status.canInstall
                      ? "Approve the update in Android’s installer."
                      : "Allow updates from Atlas in Android settings, return here and tap Install update.",
                  )
                }
              >
                <ShieldCheck size={18} />
                {status.canInstall
                  ? "Install update"
                  : "Allow Atlas to install updates"}
              </button>
            )}
            {status.phase === "downloading" ? (
              <button onClick={() => void Updates.cancel()}>
                Cancel download
              </button>
            ) : (
              <button
                disabled={working}
                onClick={() =>
                  void run(() => Updates.check({}), "Update check complete.")
                }
              >
                <RefreshCw size={17} />
                {status.phase === "checking"
                  ? "Checking…"
                  : "Check for updates"}
              </button>
            )}
            <button
              onClick={() => {
                if (update) void Updates.configure({ later: true }).then(apply);
                close();
              }}
            >
              Later
            </button>
          </div>
          <label className="atlas-update-rule">
            <span>
              Check for updates daily
              <small>Only checks public release information.</small>
            </span>
            <input
              type="checkbox"
              checked={status.automaticChecks}
              disabled={working}
              onChange={(e) =>
                void Updates.configure({
                  automaticChecks: e.target.checked,
                }).then(apply)
              }
            />
          </label>
          <label className="atlas-update-rule">
            <span>
              Download on Wi-Fi only
              <small>Downloads start only when you approve.</small>
            </span>
            <input
              type="checkbox"
              checked={status.wifiOnly}
              disabled={working}
              onChange={(e) =>
                void Updates.configure({ wifiOnly: e.target.checked }).then(
                  apply,
                )
              }
            />
          </label>
          <p className="atlas-update-footnote">
            Atlas verifies the file, app identity and signing certificate.
            Android asks before installation. If a download is interrupted, you
            can retry here; you can keep using Atlas offline.
          </p>
        </Modal>
      )}
    </>
  );
}
