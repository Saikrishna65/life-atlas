"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Polyline, CircleMarker, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { FeaturedJourney } from "@/lib/public-trips/featured-journey";

function Fit({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (!points.length) return;
    const fit = () => { map.invalidateSize(); map.fitBounds(L.latLngBounds(points), { padding: [60, 70], maxZoom: 13, animate: false }); };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map, points]);
  return null;
}
function DrawnPath({ positions }: { positions: [number, number][] }) {
  const ref = useRef<L.Polyline>(null);
  const map = useMap();
  useEffect(() => {
    const measure = () => {
      const path = ref.current?.getElement() as SVGPathElement | undefined;
      if (path?.getTotalLength) path.style.setProperty("--track-length", `${path.getTotalLength()}px`);
    };
    measure();
    map.on("zoomend moveend resize", measure);
    return () => { map.off("zoomend moveend resize", measure); };
  }, [map, positions]);
  return <Polyline ref={ref} className="featured-route-drawn" positions={positions} pathOptions={{ color: "#d9f4c4", weight: 4 }} />;
}
export default function FeaturedJourneyMap({ journey, active, onSelect }: { journey: FeaturedJourney; active: number; onSelect: (index: number) => void }) {
  const [failed, setFailed] = useState(false);
  const stops = journey.chapters.flatMap((chapter, index) => typeof chapter.latitude === "number" && typeof chapter.longitude === "number" ? [{ ...chapter, index, latitude: chapter.latitude, longitude: chapter.longitude }] : []);
  const points = useMemo<[number, number][]>(() => {
    const fixes = journey.paths.flat().map(point => [point.latitude, point.longitude] as [number, number]);
    return fixes.length ? fixes : journey.chapters.flatMap(chapter => typeof chapter.latitude === "number" && typeof chapter.longitude === "number" ? [[chapter.latitude, chapter.longitude] as [number, number]] : []);
  }, [journey]);
  if (!points.length) return <div className="featured-map-empty"><span>THE STORY IS HERE.</span><p>No geographic locations or GPS track have been published for this journey yet.</p></div>;
  return <>
    <MapContainer center={points[0]} zoom={9} zoomControl={false} scrollWheelZoom={false} dragging={false} doubleClickZoom={false} touchZoom={false} boxZoom={false} keyboard={false} className="featured-leaflet" attributionControl>
      <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" attribution={'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'} eventHandlers={{ tileerror: () => setFailed(true) }} />
      <Fit points={points} />
      {journey.paths.map((path, index) => {
        const positions = path.map(point => [point.latitude, point.longitude] as [number, number]);
        return <DrawnPath key={index} positions={positions} />;
      })}
      {stops.map(stop => <CircleMarker key={`${stop.id}-${stop.index === active}`} className={stop.index === active ? "featured-stop-active" : undefined} center={[stop.latitude, stop.longitude]} radius={stop.index === active ? 10 : 5} pathOptions={{ color: "#fff", weight: 2, fillColor: stop.index === active ? "#d9f4c4" : "#16211d", fillOpacity: 1, className: stop.index === active ? "featured-stop-active" : "" }} eventHandlers={{ click: () => onSelect(stop.index) }}><Tooltip permanent direction="top" offset={[0, -10]}>{stop.place}</Tooltip></CircleMarker>)}
    </MapContainer>
    {failed && <p className="featured-map-offline" role="status">Map imagery is unavailable. The route and stops remain visible.</p>}
  </>;
}
