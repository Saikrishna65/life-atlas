"use client";
import PublicRouteExplorer from "./PublicRouteExplorer";
import { publishedRoute, type RouteStop } from "@/lib/public-trips/route";
function duration(seconds: number | null) {
  if (seconds === null) return "Not recorded";
  return (
    Math.floor(seconds / 3600) + "h " + Math.floor((seconds % 3600) / 60) + "m"
  );
}
export default function PublicTripRouteMap({
  destination,
  routeData,
  totalDistanceKm,
  elevationGainMeters,
  maxElevationMeters,
  tripPlaces = [],
}: {
  tripTitle: string;
  destination: string;
  routeData?: unknown;
  totalDistanceKm?: number | null;
  elevationGainMeters?: number | null;
  maxElevationMeters?: number | null;
  tripPlaces?: {
    place: {
      id: string;
      name: string;
      latitude?: number | null;
      longitude?: number | null;
      description?: string | null;
    };
  }[];
}) {
  const route = publishedRoute(routeData);
  const stops: RouteStop[] = tripPlaces.flatMap(({ place }) =>
    typeof place.latitude === "number" && typeof place.longitude === "number"
      ? [{ ...place, latitude: place.latitude, longitude: place.longitude }]
      : [],
  );
  const metrics = [
    ["Distance", totalDistanceKm ?? route.distance, "km"],
    ["Highest altitude", maxElevationMeters ?? route.maxAltitude, "m"],
    ["Total ascent", elevationGainMeters ?? route.ascent, "m"],
    ["Maximum speed", route.maxSpeed, "km/h"],
    ["Moving average speed", route.averageSpeed, "km/h"],
  ];
  return (
    <section className="trip-geographic-section">
      <p className="world-eyebrow">THE RECORDED JOURNEY / {destination}</p>
      <h2>
        Follow the road.
        <br />
        <em>Relive every turn.</em>
      </h2>
      <div className="trip-telemetry">
        {metrics.map(([label, value, unit]) => (
          <article key={String(label)}>
            <small>{label}</small>
            <strong>
              {typeof value === "number"
                ? value.toLocaleString(undefined, { maximumFractionDigits: 1 })
                : "Not recorded"}
              {typeof value === "number" && <span> {unit}</span>}
            </strong>
          </article>
        ))}
        <article>
          <small>Elapsed time</small>
          <strong>{duration(route.elapsed)}</strong>
        </article>
        <article>
          <small>Moving time</small>
          <strong>{duration(route.moving)}</strong>
        </article>
        <article>
          <small>Travellers</small>
          <strong>Not published</strong>
        </article>
      </div>
      <PublicRouteExplorer stops={stops} routeData={routeData} />
      <div className="trip-visited">
        <h3>Places visited</h3>
        {tripPlaces.map(({ place }, index) => (
          <article key={place.id}>
            <small>{String(index + 1).padStart(2, "0")}</small>
            <div>
              <h4>{place.name}</h4>
              {place.description && <p>{place.description}</p>}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
