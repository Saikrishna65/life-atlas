"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Modal } from "@/components/world/primitives";
import { R2, storageError, systemAction } from "@/lib/r2/native";
import type { GalleryRecoveryStatus } from "@/lib/gallery/collections";
import { useGalleryBack } from "@/lib/gallery/navigation";
export default function GalleryRecoveryPanel({
  onClose,
}: {
  onClose: () => void;
}) {
  const [kitPassword, setKitPassword] = useState(""),
    [kitMessage, setKitMessage] = useState("");
  const [status, setStatus] = useState<GalleryRecoveryStatus>({}),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [faces, setFaces] = useState(false);
  useGalleryBack(true, onClose, 95);
  useEffect(() => {
    let alive = true;
    const refresh = () => {
      if (!document.hidden)
        void R2.getGalleryRecovery()
          .then((v) => {
            if (alive) {
              setStatus(v);
              if (v.state === "restored") {
                window.dispatchEvent(new Event("atlas:gallery-restored"));
                window.dispatchEvent(new Event("atlas:gallery-analysis"));
              }
            }
          })
          .catch((e) => {
            if (alive) setError(storageError(e));
          });
    };
    refresh();
    const timer = setInterval(refresh, 4000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);
  const act = async (
    action: "enable" | "disable" | "backup" | "restore" | "cancel" | "verify",
  ) => {
    if (
      action === "restore" &&
      !confirm(
        "Restore your saved organisation? Matching photos will reconnect by their file checksum. Existing local changes are kept. Keep your recovery kit available.",
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      await systemAction<unknown>(() =>
        action === "enable" || action === "disable"
          ? R2.configureGalleryRecovery({ enabled: action === "enable" })
          : R2.controlGalleryRecovery({ action, peopleApproved: faces }),
      );
      setStatus(await R2.getGalleryRecovery());
      if (action === "restore")
        window.dispatchEvent(new Event("atlas:gallery-analysis"));
    } catch (e) {
      setError(storageError(e));
    } finally {
      setBusy(false);
    }
  };
  const messages: Record<string, string> = {
    waiting: "Waiting for Wi-Fi, charging and enough battery",
    saving: "Saving privately",
    restoring: "Restoring your organisation",
    verifying: "Checking saved encrypted metadata",
    verified: "Saved metadata verified",
    matching: "Finding matching photos",
    saved: "Organisation saved",
    restored: "Restore finished",
    paused: "Paused",
    off: "Automatic saving is off",
    empty: "Analyse some photos before saving",
    error: "Needs attention",
  };
  return (
    <Modal
      title="Keep your organisation safe"
      className="pg-dialog gsmart-dialog"
      onClose={onClose}
    >
      <h2>Keep the names. Keep the memories.</h2>
      <p>
        Save your photo analysis, people names, corrections, picks and
        favourites as encrypted metadata in your private storage. Your originals
        stay unchanged. Nothing goes to your public website.
      </p>
      <p>
        Set up private Cloud Storage and verify its recovery kit first. You will
        need the same kit on a replacement phone. This saves organisation; photo
        backup is a separate choice.
      </p>
      <section className="gsmart-rehearsal">
        <h3>Check your saved organisation</h3>
        <p>
          {status.pending
            ? "Recent changes are waiting to be saved."
            : status.lastSaved
              ? "Your organisation has a saved snapshot."
              : "Create a metadata backup before checking it."}
        </p>
        <p>
          This reads and decrypts the latest snapshot and its photo records. It
          does not import names, change your index or write to cloud storage.
          Original photo availability is a separate check. This uses your
          existing charging and unmetered Wi-Fi rules for organisation backups.
        </p>
        <button
          disabled={
            busy ||
            [
              "waiting",
              "saving",
              "restoring",
              "matching",
              "verifying",
            ].includes(status.state || "")
          }
          onClick={() => void act("verify")}
        >
          Verify saved metadata without restoring
        </button>
        {status.lastVerified && (
          <p role="status">
            Last verified {new Date(status.lastVerified).toLocaleString()} ·{" "}
            {status.verifiedRecords ?? 0} photo records checked.
          </p>
        )}
      </section>
      <section className="gsmart-rehearsal">
        <h3>Check your saved recovery kit</h3>
        <p>
          Select your independently saved kit. Atlas checks its key against this
          device, then encrypts and restores a small synthetic sample locally.
          No photos are uploaded and your active key is never replaced.
        </p>
        <label>
          Kit passphrase
          <input
            type="password"
            autoComplete="off"
            value={kitPassword}
            onChange={(e) => setKitPassword(e.target.value)}
          />
        </label>
        <button
          disabled={busy || !kitPassword}
          onClick={() => {
            setBusy(true);
            setError("");
            setKitMessage("");
            const password = kitPassword;
            setKitPassword("");
            void systemAction(() =>
              R2.restoreRecoveryKit({ passphrase: password, verifyOnly: true }),
            )
              .then(() =>
                setKitMessage(
                  "Recovery kit verified. The local restoration rehearsal passed.",
                ),
              )
              .catch((e) => setError(storageError(e)))
              .finally(() => setBusy(false));
          }}
        >
          Choose kit & verify restoration
        </button>
        {kitMessage && <p role="status">{kitMessage}</p>}
      </section>
      <Link href="/secret/control-room">Cloud Storage & recovery kit ↗</Link>
      <div className="gsmart-recovery-status" role="status">
        <strong>{messages[status.state || "off"] || "Ready"}</strong>
        {!!status.total && (
          <p>
            {status.processed || status.matched || 0} / {status.total}
          </p>
        )}
        {!!status.lastSaved && (
          <p>Last saved {new Date(status.lastSaved).toLocaleString()}</p>
        )}
        {!!status.unmatched && (
          <p>
            {status.unmatched} photos aren’t on this phone yet. Their analysis
            is retained and reconnects when matching originals become
            accessible.
          </p>
        )}
      </div>
      <label className="gsmart-recovery-toggle">
        <input
          type="checkbox"
          checked={!!status.enabled}
          disabled={busy}
          onChange={(e) => void act(e.target.checked ? "enable" : "disable")}
        />
        Save changes automatically on unmetered Wi-Fi
      </label>
      <div className="gsmart-tools">
        <button
          disabled={busy || !status.enabled}
          onClick={() => void act("backup")}
        >
          Save now
        </button>
        <button disabled={busy} onClick={() => void act("cancel")}>
          Pause transfer
        </button>
      </div>
      <hr />
      <h3>Moving to this phone?</h3>
      <label className="gsmart-recovery-toggle">
        <input
          type="checkbox"
          checked={faces}
          onChange={(e) => setFaces(e.target.checked)}
        />
        I want to restore my private face groups and confirmed names too.
      </label>
      <button disabled={busy} onClick={() => void act("restore")}>
        Restore saved organisation
      </button>
      <p>
        Restore scans matching file sizes and verifies original bytes locally.
        Large libraries may take time. Existing photos and local corrections are
        kept. Analysis pauses during restore; resume it from photo settings when
        ready.
      </p>
      <p>
        Forgetting people on this phone does not erase older encrypted recovery
        snapshots.
      </p>
      {(error || status.error) && (
        <p role="alert">{error || storageError({ code: status.error })}</p>
      )}
    </Modal>
  );
}
