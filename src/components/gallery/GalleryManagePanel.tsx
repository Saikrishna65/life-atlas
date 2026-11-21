"use client";
import { useEffect, useState, useRef } from "react";
import { Modal } from "@/components/world/primitives";
import { R2, bytes, storageError } from "@/lib/r2/native";
import {
  intelligenceStateText,
  type GalleryIntelligenceStatus,
} from "@/lib/gallery/intelligence";
import type { GalleryCacheReport } from "@/lib/gallery/media-tools";
import { useGalleryBack } from "@/lib/gallery/navigation";
export default function GalleryManagePanel({
  onClose,
  onLarge,
  onAnalysis,
  onRecovery,
}: {
  onClose: () => void;
  onLarge: () => void;
  onAnalysis: () => void;
  onRecovery: () => void;
}) {
  const [cache, setCache] = useState<GalleryCacheReport>(),
    [status, setStatus] = useState<GalleryIntelligenceStatus>(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useGalleryBack(true, onClose, 70);
  const alive = useRef(true);
  const refresh = async () => {
    const values = await Promise.allSettled([
      R2.getGalleryCache(),
      R2.getGalleryIntelligence(),
    ]);
    if (!alive.current) return;
    if (values[0].status === "fulfilled") setCache(values[0].value);
    if (values[1].status === "fulfilled") setStatus(values[1].value);
  };
  useEffect(() => {
    alive.current = true;
    void Promise.resolve()
      .then(() => {
        if (alive.current) return refresh();
      })
      .catch((e) => {
        if (alive.current) setError(storageError(e));
      });
    const poll = setInterval(() => {
      if (document.hidden) return;
      void R2.getGalleryIntelligence()
        .then((value) => {
          if (alive.current) setStatus(value);
        })
        .catch(() => {});
    }, 5000);
    return () => {
      alive.current = false;
      clearInterval(poll);
    };
  }, []);
  const configure = async (limitMiB: number, clear = false) => {
    setBusy(true);
    setError("");
    try {
      setCache(await R2.configureGalleryCache({ limitMiB, clear }));
      window.dispatchEvent(new Event("atlas:gallery-analysis"));
    } catch (e) {
      setError(storageError(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      title="Gallery settings"
      className="pg-dialog gallery-manage"
      onClose={onClose}
    >
      <h2>A little room to breathe.</h2>
      <section>
        <h3>Temporary images</h3>
        <p>
          {cache
            ? `${bytes(cache.bytes)} used · ${cache.files} temporary files`
            : "Checking cache…"}
        </p>
        <label>
          Photo cache limit
          <select
            disabled={busy || !cache}
            value={cache?.limitMiB || 96}
            onChange={(e) => void configure(+e.target.value)}
          >
            {[32, 64, 96, 192].map((n) => (
              <option key={n} value={n}>
                {n} MB
              </option>
            ))}
          </select>
        </label>
        <button
          disabled={busy || !cache}
          onClick={() => void configure(cache!.limitMiB, true)}
        >
          Clear thumbnails & video frames
        </button>
        <p>
          This removes rebuildable previews, never originals, edits in progress,
          shared files or cloud backups. Video frames and motion clips have
          separate small limits.
        </p>
        <button onClick={onLarge}>Review largest phone files</button>
      </section>
      <section aria-label="Analysis activity">
        <h3>Analysis activity</h3>
        <strong>
          {status ? intelligenceStateText(status) : "Checking activity…"}
        </strong>
        {status && (
          <>
            <p>
              {status.scanned.toLocaleString()} checked in this pass ·{" "}
              {status.indexed.toLocaleString()} saved index records ·{" "}
              {status.failed} need attention
            </p>
            <ul>
              {(["ocr", "visual", "similar", "people"] as const)
                .filter((key) => status[key])
                .map((key) => (
                  <li key={key}>
                    {
                      {
                        ocr: "English text recognition",
                        visual: "Scene search",
                        similar: "Similar photos",
                        people: "People grouping",
                      }[key]
                    }
                  </li>
                ))}
            </ul>
            <p>
              {status.chargingOnly
                ? "Heavy work waits for charging."
                : "Heavy work waits for enough battery."}{" "}
              {status.wifiOnly ? "Model downloads use Wi-Fi." : ""} New and
              changed files are checked incrementally; unchanged results are
              reused.
            </p>
            <button
              disabled={busy}
              onClick={() => {
                if (status.state === "off") {
                  onAnalysis();
                  return;
                }
                setBusy(true);
                void R2.controlGalleryIntelligence({
                  action: status.enabled ? "pause" : "resume",
                })
                  .then(refresh)
                  .catch((e) => setError(storageError(e)))
                  .finally(() => setBusy(false));
              }}
            >
              {status.state === "off"
                ? "Set up analysis"
                : status.enabled
                  ? "Pause analysis"
                  : "Resume analysis"}
            </button>
          </>
        )}
        <button onClick={onAnalysis}>Analysis preferences</button>
      </section>
      <section>
        <h3>Your recovery kit</h3>
        <p>
          Check an independently saved kit before relying on cloud recovery.
        </p>
        <button onClick={onRecovery}>Verify recovery & organisation</button>
      </section>
      {error && <p role="alert">{error}</p>}
    </Modal>
  );
}
