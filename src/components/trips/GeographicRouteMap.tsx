"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Polyline,
  CircleMarker,
  Popup,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { RoutePoint, RouteStop } from "@/lib/public-trips/route";
function View({
  points,
  active,
  fit,
  recorded,
}: {
  points: [number, number][];
  active?: RouteStop;
  fit: number;
  recorded: boolean;
}) {
  const map = useMap();
  const previousActive = useRef(active?.id);
  const routeView = useRef(true);
  useEffect(() => {
    const fitBounds = () => {
      if (!points.length) return;
      map.invalidateSize({ pan: false });
      const size = map.getSize();
      if (!size.x || !size.y) return;
      const horizontal = Math.min(48, Math.round(size.x * .1));
      const vertical = Math.min(100, Math.round(size.y * .24));
      map.fitBounds(L.latLngBounds(points), {
        paddingTopLeft: [horizontal, vertical],
        paddingBottomRight: [horizontal, vertical],
        maxZoom: recorded ? 17 : 11,
        animate: false,
      });
    };
    routeView.current = true;
    fitBounds();
    const resize = new ResizeObserver(() => {
      map.invalidateSize({ pan: false });
      if (routeView.current) fitBounds();
    });
    resize.observe(map.getContainer());
    return () => resize.disconnect();
  }, [map, points, fit, recorded]);
  useEffect(() => {
    // A preselected marker must not override the initial full-route bounds.
    if (previousActive.current === active?.id) return;
    previousActive.current = active?.id;
    if (active) {
      routeView.current = false;
      map.setView(
        [active.latitude, active.longitude],
        Math.max(map.getZoom(), 11),
        { animate: !matchMedia("(prefers-reduced-motion:reduce)").matches },
      );
    }
  }, [map, active]);
  return null;
}
export default function GeographicRouteMap({
  stops,
  paths = [],
  activeId,
  onSelect,
  illustrative = false,
}: {
  illustrative?: boolean;
  stops: RouteStop[];
  paths?: RoutePoint[][];
  activeId?: string;
  onSelect?: (id: string) => void;
}) {
  const [failed, setFailed] = useState(false),
    [terrain, setTerrain] = useState(false);
  const [tilesReady,setTilesReady]=useState(false);
  const [fit, setFit] = useState(0);
  const points = useMemo<[number, number][]>(
    () => [
      ...paths.flat().map((p) => [p.latitude, p.longitude] as [number, number]),
      ...stops.map((p) => [p.latitude, p.longitude] as [number, number]),
    ],
    [paths, stops],
  );
  return (
    <div className="geographic-route" data-public-ready={tilesReady?"ready":"pending"}>
      <div className="route-layer-control">
        <button onClick={() => setFit((n) => n + 1)}>Fit route</button>
        <button
          aria-pressed={!terrain}
          onClick={() => {
            setTerrain(false);
            setFailed(false);
          }}
        >
          Street map
        </button>
        <button
          aria-pressed={terrain}
          onClick={() => {
            setTerrain(true);
            setFailed(false);
          }}
        >
          Terrain
        </button>
      </div>
      <MapContainer
        {...(points.length ? {
          bounds: L.latLngBounds(points),
          boundsOptions: { paddingTopLeft: L.point(28, 100), paddingBottomRight: L.point(28, 100), maxZoom: paths.length ? 17 : 11 },
        } : { center: L.latLng(20, 78), zoom: 5 })}
        scrollWheelZoom={false}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          key={String(terrain)}
          url={
            terrain
              ? "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
              : "https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          }
          maxZoom={terrain ? 17 : 19}
          attribution={
            terrain
              ? "Map data &copy; OpenStreetMap contributors, SRTM | Map style &copy; OpenTopoMap (CC-BY-SA)"
              : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          }
          eventHandlers={{ load:()=>setTilesReady(true),tileerror: () => setFailed(true) }}
        />
        <View
          points={points}
          active={stops.find((p) => p.id === activeId)}
          fit={fit}
          recorded={paths.length > 0}
        />
        {paths.map((path, i) => (
          <Polyline
            key={"outline-" + i}
            positions={path.map((p) => [p.latitude, p.longitude])}
            pathOptions={{ color: "#fff", weight: 9, opacity: 0.95 }}
          />
        ))}
        {paths.map((path, i) => (
          <Polyline
            key={i}
            positions={path.map((p) => [p.latitude, p.longitude])}
            pathOptions={{ color: "#1f4fd8", weight: 5, opacity: 1 }}
          />
        ))}
        {paths.length > 0 &&
          [paths[0][0], paths[paths.length - 1].at(-1)!].map((point, index) => (
            <CircleMarker
              key={"endpoint-" + index}
              center={[point.latitude, point.longitude]}
              radius={8}
              pathOptions={{
                color: "#fff",
                weight: 3,
                fillColor: index ? "#0b1220" : "#1f4fd8",
                fillOpacity: 1,
              }}
            >
              <Popup>{index ? "Journey finish" : "Journey start"}</Popup>
            </CircleMarker>
          ))}
        {stops.map((stop) => (
          <CircleMarker
            key={stop.id}
            center={[stop.latitude, stop.longitude]}
            radius={stop.id === activeId ? 10 : 6}
            pathOptions={{
              color: "#fff",
              weight: 2,
              fillColor: "#1f4fd8",
              fillOpacity: 1,
            }}
            eventHandlers={{ click: () => onSelect?.(stop.id) }}
          >
            <Popup>
              <strong>{stop.name}</strong>
              {stop.description && <p>{stop.description}</p>}
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
      {failed && (
        <p className="route-map-status" role="status">
          Map tiles are unavailable. Places and recorded trip details remain
          available below.
        </p>
      )}
      <p className="route-map-note">
        {illustrative
          ? "Illustrative sample route — not recorded travel, not verified road or trail directions."
          : paths.length
            ? "The blue line follows published GPS fixes; gaps between recording segments are preserved."
            : "No recorded GPS track was published. Place markers show approximate locations; no travel path is invented."}
      </p>
    </div>
  );
}
