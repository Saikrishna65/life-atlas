"use client";
import dynamic from "next/dynamic";
import {
  publishedRoute,
  validPoint,
  type RouteStop,
} from "@/lib/public-trips/route";
const Map = dynamic(() => import("./GeographicRouteMap"), {
  ssr: false,
  loading: () => (
    <p className="route-map-loading">Opening the geographic map…</p>
  ),
});
export default function PublicRouteExplorer({
  stops,
  routeData,
  activeId,
  onSelect,
  illustrative = false,
}: {
  illustrative?: boolean;
  stops: RouteStop[];
  routeData?: unknown;
  activeId?: string;
  onSelect?: (id: string) => void;
}) {
  const route = publishedRoute(routeData);
  const valid = stops.filter(validPoint);
  if (!valid.length && !route.paths.length)
    return (
      <p className="route-map-note">
        No geographic locations or GPS track have been published for this
        journey.
      </p>
    );
  return (
    <Map
      illustrative={illustrative}
      stops={valid}
      paths={route.paths}
      activeId={activeId}
      onSelect={onSelect}
    />
  );
}
