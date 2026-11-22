"use client";
import { useEffect, useState } from "react";
import { R2, bytes, storageError } from "@/lib/r2/native";
import type {
  GalleryAnalysisReport,
  GalleryIntelligenceStatus,
} from "@/lib/gallery/intelligence";
export default function GalleryAnalysisHealth({
  status,
  onRetry,
  onScan,
  disabled,
}: {
  status: GalleryIntelligenceStatus;
  onRetry: () => void;
  onScan: () => void;
  disabled: boolean;
}) {
  const [health, setHealth] = useState<GalleryAnalysisReport>(),
    [error, setError] = useState(""),
    [cache, setCache] = useState<{ bytes: number }>();
  useEffect(() => {
    let live = true;
    const read = () => {
      if (document.hidden) return;
      void R2.getGalleryAnalysisHealth()
        .then((v) => {
          if (live) setHealth(v);
        })
        .catch(() => {});
    };
    read();
    const timer = setInterval(read, 5000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, []);
  return (
    <section className="gi-health" aria-label="Analysis health">
      <h3>Your photo analysis</h3>
      {health ? (
        <>
          <p>
            {health.indexed.toLocaleString()} saved photo records ·{" "}
            {health.checked.toLocaleString()} checked in this pass
          </p>
          {status.enabled &&
            status.state !== "ready" &&
            health.remaining > 0 && (
              <p>About {health.remaining.toLocaleString()} left in this pass</p>
            )}
          <p>
            {health.queued
              ? `${health.queued} queued for priority or retry`
              : "No priority photos waiting"}
          </p>
          {health.failed > 0 && (
            <>
              <p>
                {health.failed} photos need another try
                {health.failureLimit ? " · review limit reached" : ""}.
              </p>
              <button disabled={disabled || !status.enabled} onClick={onRetry}>
                Retry failed photos
              </button>
              {!status.enabled && (
                <small>
                  Resume analysis first. Your completed work stays saved.
                </small>
              )}
            </>
          )}
          {!!health.legacyFailures && (
            <>
              <p>
                Some earlier failures were not recorded individually. One scan
                can locate them; completed analysis is reused.
              </p>
              <button disabled={disabled || !status.enabled} onClick={onScan}>
                Locate earlier failed photos
              </button>
            </>
          )}
          <details
            onToggle={(e) => {
              if (e.currentTarget.open)
                void R2.getGalleryCache()
                  .then(setCache)
                  .catch(() => {});
            }}
          >
            <summary>Performance & storage</summary>
            <p>
              Measured locally on this phone. No photo names, search text or
              recognised words are recorded here.
            </p>
            <p>
              Completed processing since the last full scan:{" "}
              {Math.round((health.passWorkMs ?? 0) / 1000)} seconds.
              Charging/waiting time and model downloads are excluded.
            </p>
            <dl>
              {Object.entries(health.metrics).map(([key, value]) => (
                <div key={key}>
                  <dt>
                    {{
                      "search-text": "Text search phase",
                      "search-visual": "Full search request",
                      "search-cached": "Saved result request",
                      "analysis-batch": "Analysis batch",
                    }[key] || key}
                  </dt>
                  <dd>
                    {value.count} samples · average{" "}
                    {Math.round(value.totalMs / Math.max(1, value.count))} ms ·
                    latest {value.lastMs} ms
                  </dd>
                </div>
              ))}
            </dl>
            {!Object.keys(health.metrics).length && (
              <p>
                Timings appear after searches or analysis. A batch includes
                checking records and can contain already-current photos.
              </p>
            )}
            <p>
              {bytes(health.indexBytes ?? 0)} encrypted index files ·
              approximately {bytes(health.decodedSearchBytes ?? 0)} decoded
              search cache in memory.
            </p>
            {cache && (
              <p>
                {bytes(cache.bytes)} of temporary photo/video previews. Original
                files and the AI index are separate.
              </p>
            )}
            <button
              disabled={disabled}
              onClick={() =>
                void R2.resetGalleryAnalysisMetrics()
                  .then(() => setHealth((v) => (v ? { ...v, metrics: {} } : v)))
                  .catch((e) => setError(storageError(e)))
              }
            >
              Clear performance history
            </button>
          </details>
        </>
      ) : (
        <p>Reading saved analysis progress…</p>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
