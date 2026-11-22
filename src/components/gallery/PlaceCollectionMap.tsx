"use client";
import { useEffect } from "react";
import L from "leaflet";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Tooltip,
  useMap,
} from "react-leaflet";
import type { SavedPlace } from "@/lib/gallery/places";
import "leaflet/dist/leaflet.css";
function Pins({
  places,
  onOpen,
}: {
  places: SavedPlace[];
  onOpen: (id: string) => void;
}) {
  const map = useMap();
  useEffect(() => {
    const points = places.flatMap((p) =>
      p.anchor
        ? [[p.anchor.latitude, p.anchor.longitude] as [number, number]]
        : [],
    );
    if (points.length)
      map.fitBounds(L.latLngBounds(points), {
        padding: [40, 40],
        maxZoom: 13,
        animate: false,
      });
  }, [map, places]);
  return (
    <>
      {places.flatMap((p) =>
        p.anchor
          ? [
              <CircleMarker
                key={p.id}
                center={[p.anchor.latitude, p.anchor.longitude]}
                radius={10}
                pathOptions={{
                  color: "#fff",
                  weight: 3,
                  fillColor: "#285c49",
                  fillOpacity: 1,
                }}
                eventHandlers={{ click: () => onOpen(p.id) }}
              >
                <Tooltip direction="top" permanent>
                  {p.name}
                </Tooltip>
              </CircleMarker>,
            ]
          : [],
      )}
    </>
  );
}
export default function PlaceCollectionMap({
  places,
  onOpen,
}: {
  places: SavedPlace[];
  onOpen: (id: string) => void;
}) {
  return (
    <div className="gp-collection-map">
      <MapContainer
        center={[22, 78]}
        zoom={4}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="© OpenStreetMap contributors"
        />
        <Pins places={places} onOpen={onOpen} />
      </MapContainer>
      <p>
        Tap a place to open its photos. Map tiles need a connection; your saved
        places work offline.
      </p>
      <nav aria-label="Places on map">
        {places.map((p) => (
          <button key={p.id} onClick={() => onOpen(p.id)}>
            {p.name}
            {!p.anchor ? " · no pin" : ""}
          </button>
        ))}
      </nav>
    </div>
  );
}
