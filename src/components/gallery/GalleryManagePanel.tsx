"use client";
import { useEffect, useState, useRef } from "react";
import { Capacitor, registerPlugin } from "@capacitor/core";
import { Modal } from "@/components/world/primitives";
import { R2, bytes, storageError } from "@/lib/r2/native";
import {
  intelligenceStateText,
  type GalleryIntelligenceStatus,
} from "@/lib/gallery/intelligence";
import type { GalleryCacheReport } from "@/lib/gallery/media-tools";
import {
  readGalleryPreference,
  saveGalleryPreference,
} from "@/lib/gallery/store";
import { useGalleryBack } from "@/lib/gallery/navigation";
const launcher = registerPlugin<{
  pinGalleryShortcut(): Promise<{ supported: boolean; requested: boolean }>;
}>("AtlasPermissions");
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
  const [nativeViewer, setNativeViewer] = useState(false);
  useEffect(() => {
    void readGalleryPreference("native-viewer", false)
      .then(setNativeViewer)
      .catch(() => {});
  }, []);
  const [cache, setCache] = useState<GalleryCacheReport>(),
    [status, setStatus] = useState<GalleryIntelligenceStatus>(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [shortcutNotice, setShortcutNotice] = useState("");
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
  const configure = async (
    limitMiB: number,
    clear = false,
    preview?: { previewQuality?: number; previewMaxEdge?: number },
  ) => {
    setBusy(true);
    setError("");
    try {
      setCache(await R2.configureGalleryCache({ limitMiB, clear, ...preview }));
      window.dispatchEvent(new Event("atlas:gallery-preview-settings"));
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
      <h2>Your Gallery, your way.</h2>
      {Capacitor.isNativePlatform() && (
        <section>
          <h3>Open Gallery directly</h3>
          <p>
            Add a shortcut to your home screen. Your photos stay in the same
            Atlas app.
          </p>
          <button
            onClick={() =>
              void launcher
                .pinGalleryShortcut()
                .then((result) =>
                  setShortcutNotice(
                    result.requested
                      ? "Confirm Add in your launcher’s prompt."
                      : "Open your app drawer, then long-press Atlas Gallery and drag it to the home screen.",
                  ),
                )
                .catch(() =>
                  setShortcutNotice(
                    "Open your app drawer, then long-press Atlas Gallery and drag it to the home screen.",
                  ),
                )
            }
          >
            Add Gallery to home screen
          </button>
          {shortcutNotice && <p role="status">{shortcutNotice}</p>}
        </section>
      )}
      {Capacitor.isNativePlatform() && (
        <section>
          <h3>Photo viewer</h3>
          <label>
            <input
              type="checkbox"
              checked={nativeViewer}
              onChange={(e) => {
                setNativeViewer(e.target.checked);
                void saveGalleryPreference("native-viewer", e.target.checked);
              }}
            />
            Try the native Android viewer
          </label>
          <p>
            Uses tiled original photos and Android video controls. Local media
            only. Info and More open Atlas tools; return to the grid to start
            another native session. This option is experimental pending phone
            testing.
          </p>
        </section>
      )}
      <section aria-label="Preview quality">
        <h3>Photo preview quality</h3>
        <p>
          Choose how sharp photos look in the grid. Open a photo to view the
          original. Your files and cloud uploads are never compressed by this
          setting.
        </p>
        <label>
          Quality preset
          <select
            aria-label="Preview quality preset"
            disabled={busy || !cache}
            value={
              cache?.previewQuality === 80 && cache?.previewMaxEdge === 768
                ? "saver"
                : cache?.previewQuality === 92 && cache?.previewMaxEdge === 1280
                  ? "balanced"
                  : cache?.previewQuality === 98 &&
                      cache?.previewMaxEdge === 2560
                    ? "high"
                    : "custom"
            }
            onChange={(e) => {
              const presets = {
                saver: [80, 768],
                balanced: [92, 1280],
                high: [98, 2560],
              };
              const p = presets[e.target.value as keyof typeof presets];
              if (p)
                void configure(cache!.limitMiB, false, {
                  previewQuality: p[0],
                  previewMaxEdge: p[1],
                });
            }}
          >
            <option value="saver">Data saver · lighter previews</option>
            <option value="balanced">Balanced · recommended</option>
            <option value="high">High · sharper, more storage</option>
            <option value="custom" disabled>
              Custom
            </option>
          </select>
        </label>
        <details>
          <summary>Fine-tune quality</summary>
          <label>
            JPEG quality · {cache?.previewQuality ?? 92}
            <input
              aria-label="Preview JPEG quality"
              type="range"
              min="70"
              max="98"
              defaultValue={cache?.previewQuality ?? 92}
              key={cache?.previewQuality}
              disabled={busy || !cache}
              onPointerUp={(e) =>
                void configure(cache!.limitMiB, false, {
                  previewQuality: +e.currentTarget.value,
                })
              }
              onKeyUp={(e) => {
                if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key))
                  void configure(cache!.limitMiB, false, {
                    previewQuality: +e.currentTarget.value,
                  });
              }}
            />
          </label>
          <label>
            Maximum preview size
            <select
              aria-label="Maximum preview size"
              disabled={busy || !cache}
              value={cache?.previewMaxEdge ?? 1280}
              onChange={(e) =>
                void configure(cache!.limitMiB, false, {
                  previewMaxEdge: +e.target.value,
                })
              }
            >
              {[512, 768, 1280, 1920, 2560].map((n) => (
                <option key={n} value={n}>
                  {n} pixels
                </option>
              ))}
            </select>
          </label>
        </details>
        <p>
          Only visible previews are rebuilt after a change. Higher settings take
          more time and cache space; quality numbers are encoder settings, not a
          percentage of original detail.
        </p>
      </section>
      <section>
        <h3>Temporary images</h3>
        <p>
          {cache
            ? `${bytes(cache.bytes)} used · ${cache.files} temporary files`
            : "Checking cache…"}
        </p>
        {cache?.categories && (
          <dl className="gallery-cache-breakdown">
            {Object.entries(cache.categories).map(([key, value]) => (
              <div key={key}>
                <dt>
                  {{
                    "device-gallery": "Photo & video previews",
                    "gallery-filmstrip": "Video timeline frames",
                    "gallery-motion": "Motion clips",
                  }[key] || key}
                </dt>
                <dd>
                  {bytes(value.bytes)}
                  {value.limitBytes ? ` / ${bytes(value.limitBytes)}` : ""}
                </dd>
              </div>
            ))}
          </dl>
        )}
        <p>
          This total covers rebuildable display files. Original files, shared
          exports, cloud downloads and the AI index are not included.
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
