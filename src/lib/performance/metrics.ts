/** Process-local numeric aggregates only: no query strings, paths, media IDs or persistence. */
export const metricNames = [
  "app-first-screen",
  "navigation",
  "gallery-first-page",
  "gallery-next-page",
  "collection",
  "search-local",
  "search-visual",
  "thumbnail-native",
  "thumbnail-cache",
  "gallery-layout",
  "gallery-window",
] as const;
export type MetricName = (typeof metricNames)[number];
export const gaugeNames = ["gallery-loaded", "gallery-mounted"] as const;
export type GaugeName = (typeof gaugeNames)[number];
interface Metric {
  count: number;
  failed: number;
  totalMs: number;
  lastMs: number;
  maxMs: number;
}
export class LocalPerformanceMetrics {
  private metrics = new Map<MetricName, Metric>();
  private gauges = new Map<GaugeName, number>();
  record(name: MetricName, ms: number, failed = false) {
    if (!metricNames.includes(name) || !Number.isFinite(ms) || ms < 0) return;
    ms = Math.min(ms, 300000);
    const value = this.metrics.get(name) || {
      count: 0,
      failed: 0,
      totalMs: 0,
      lastMs: 0,
      maxMs: 0,
    };
    value.count = Math.min(1e9, value.count + 1);
    value.failed = Math.min(1e9, value.failed + Number(failed));
    value.totalMs = Math.min(1e12, value.totalMs + ms);
    value.lastMs = ms;
    value.maxMs = Math.max(value.maxMs, ms);
    this.metrics.set(name, value);
  }
  gauge(name: GaugeName, value: number) {
    if (gaugeNames.includes(name) && Number.isFinite(value))
      this.gauges.set(name, Math.max(0, Math.round(value)));
  }
  snapshot() {
    return {
      schemaVersion: 1,
      metrics: Object.fromEntries(
        [...this.metrics].map(([key, value]) => [
          key,
          {
            count: value.count,
            failed: value.failed,
            averageMs: value.totalMs / value.count,
            lastMs: value.lastMs,
            maxMs: value.maxMs,
          },
        ]),
      ),
      gauges: Object.fromEntries(this.gauges),
    };
  }
  clear() {
    this.metrics.clear();
    this.gauges.clear();
  }
}
export const localPerformance = new LocalPerformanceMetrics();
export const performanceNow = () =>
  typeof performance !== "undefined" ? performance.now() : Date.now();
export async function measureOperation<T>(
  name: MetricName,
  work: () => Promise<T>,
) {
  const start = performanceNow();
  let failed = false;
  try {
    return await work();
  } catch (error) {
    failed = true;
    throw error;
  } finally {
    localPerformance.record(name, performanceNow() - start, failed);
  }
}
let startup: number | undefined,
  navigation: { id: number; at: number } | undefined;
let generation = 0;
export function beginAppStartup() {
  startup = performanceNow();
}
export function beginNavigation() {
  navigation = { id: ++generation, at: performanceNow() };
  return generation;
}
export function navigationToken() {
  return generation;
}
export function finishScreen(token: number) {
  if (token !== generation) return;
  if (startup !== undefined) {
    localPerformance.record("app-first-screen", performanceNow() - startup);
    startup = undefined;
  }
  if (navigation?.id === token) {
    localPerformance.record("navigation", performanceNow() - navigation.at);
    navigation = undefined;
  }
}
