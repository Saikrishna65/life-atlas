export interface RoutePoint {
  latitude: number;
  longitude: number;
  altitude?: number | null;
  speed?: number | null;
}
export interface RouteStop {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  description?: string | null;
}
type RecordValue = Record<string, unknown>;
const obj = (value: unknown): RecordValue =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as RecordValue)
    : {};
const number = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;
export function validPoint(value: unknown): value is RoutePoint {
  const p = obj(value);
  return (
    number(p.latitude) !== null &&
    number(p.longitude) !== null &&
    Math.abs(p.latitude as number) <= 90 &&
    Math.abs(p.longitude as number) <= 180
  );
}
export function publishedRoute(value: unknown) {
  const data = obj(value),
    legs = Array.isArray(data.legs) ? data.legs.map(obj) : [];
  // Split at invalid fixes instead of joining across missing GPS segments.
  const paths: RoutePoint[][] = [];
  for (const leg of legs) {
    let run: RoutePoint[] = [];
    for (const point of Array.isArray(leg.coordinates) ? leg.coordinates : []) {
      if (validPoint(point)) run.push(point);
      else {
        if (run.length > 1) paths.push(run);
        run = [];
      }
    }
    if (run.length > 1) paths.push(run);
  }
  const points = paths.flat();
  const distance = number(data.totalDistanceKm),
    moving = number(data.movingSeconds),
    elapsed = number(data.totalDurationSeconds);
  const altitudes = points
    .map((p) => number(p.altitude))
    .filter((n): n is number => n !== null);
  const speeds = [
    ...legs.map((l) => number(l.maxSpeedKmh)),
    ...points.map((p) => number(p.speed)),
  ].filter((n): n is number => n !== null && n >= 0);
  const maxAltitude =
    number(data.maxElevationMeters) ??
    (altitudes.length
      ? altitudes.reduce((max, value) => Math.max(max, value), -Infinity)
      : null);
  return {
    paths,
    distance: distance !== null && distance >= 0 ? distance : null,
    moving: moving !== null && moving >= 0 ? moving : null,
    elapsed: elapsed !== null && elapsed >= 0 ? elapsed : null,
    maxAltitude,
    maxSpeed: speeds.length
      ? speeds.reduce((max, value) => Math.max(max, value), 0)
      : null,
    averageSpeed:
      distance !== null && moving !== null && moving > 0
        ? distance / (moving / 3600)
        : null,
    ascent: number(data.elevationGainMeters),
  };
}
