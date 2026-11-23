"use client";
import { useEffect, useRef, useState } from "react";
import {
  localPerformance,
  metricNames,
  type MetricName,
} from "@/lib/performance/metrics";
import type { FrameSample } from "@/lib/performance/frame-sample";
const labels: Record<MetricName, string> = {
  "app-first-screen": "Opening the first screen",
  navigation: "Changing screens",
  "gallery-first-page": "Opening photos",
  "gallery-next-page": "Loading more photos",
  collection: "Opening a collection",
  "search-local": "Saved search matches",
  "search-visual": "Visual search matches",
  "thumbnail-native": "Preparing a preview",
  "thumbnail-cache": "Reusing a preview",
  "gallery-layout": "Arranging photos",
  "gallery-window": "Finding visible photos",
};
export default function PerformanceDetails() {
  const [report, setReport] = useState(() => localPerformance.snapshot()),
    [sample, setSample] = useState<FrameSample>(),
    [measuring, setMeasuring] = useState(false),
    [error, setError] = useState("");
  const cancel = useRef<(() => void) | undefined>(undefined),
    alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      cancel.current?.();
    };
  }, []);
  const refresh = () => setReport(localPerformance.snapshot());
  const measure = async () => {
    setMeasuring(true);
    setError("");
    try {
      const { sampleFrames } = await import("@/lib/performance/frame-sample");
      if (!alive.current) return;
      cancel.current = sampleFrames((value) => {
        if (alive.current) {
          setSample(value);
          setMeasuring(false);
          refresh();
        }
      });
    } catch {
      if (alive.current) {
        setMeasuring(false);
        setError("The frame sample could not start. Try again.");
      }
    }
  };
  return (
    <details
      onToggle={(event) => {
        if (event.currentTarget.open) refresh();
      }}
    >
      <summary>App responsiveness</summary>
      <p>
        Local timings from this app session. Photo names, locations, search text
        and conversations are never recorded or sent anywhere.
      </p>
      {report.gauges["gallery-loaded"] !== undefined && (
        <p>
          {report.gauges["gallery-mounted"] ?? 0} photo tiles mounted from{" "}
          {report.gauges["gallery-loaded"]} loaded records.
        </p>
      )}
      <dl>
        {metricNames
          .filter((key) => report.metrics[key])
          .map((key) => {
            const value = report.metrics[key];
            return (
              <div key={key}>
                <dt>{labels[key]}</dt>
                <dd>
                  {key === "thumbnail-cache"
                    ? `${value.count} cache hits`
                    : `${value.averageMs.toFixed(1)} ms average · ${value.maxMs.toFixed(1)} ms slowest · ${value.count} samples`}
                  {value.failed ? ` · ${value.failed} incomplete` : ""}
                </dd>
              </div>
            );
          })}
      </dl>
      {!Object.keys(report.metrics).length && (
        <p>Timings appear as you open photos, navigate and search.</p>
      )}
      <button onClick={refresh}>Refresh timings</button>
      <button
        disabled={measuring}
        onClick={() => {
          localPerformance.clear();
          setSample(undefined);
          refresh();
        }}
      >
        Clear timings
      </button>
      <p>
        For a short frame sample, start below and scroll or swipe for ten
        seconds. Sampling stops when you leave this screen or put Atlas in the
        background.
      </p>
      <button disabled={measuring} onClick={() => void measure()}>
        {measuring ? "Measuring for 10 seconds…" : "Measure responsiveness"}
      </button>
      {error && <p role="status">{error}</p>}
      {sample && (
        <p>
          {sample.intervals} frame intervals sampled · {sample.over32ms} over 32
          ms · longest {sample.longestMs.toFixed(1)} ms
          {sample.reason === "hidden" ? " · stopped in background" : ""}. These
          are WebView callbacks, not a native GPU benchmark; display refresh
          rate can vary.
        </p>
      )}
    </details>
  );
}
