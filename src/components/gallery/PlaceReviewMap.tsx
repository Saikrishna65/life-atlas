"use client";
import { useEffect } from "react";
import L from "leaflet";
import {
  MapContainer,
  TileLayer,
  Circle,
  CircleMarker,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import type { GeoPoint, PlaceMedia } from "@/lib/gallery/places";
import "leaflet/dist/leaflet.css";
function Contents({
  anchor,
  radius,
  media,
  onPin,
}: {
  anchor?: GeoPoint;
  radius: number;
  media: PlaceMedia[];
  onPin: (point: GeoPoint) => void;
}) {
  const map = useMap();
  useMapEvents({
    click: (event) =>
      onPin({
        latitude: event.latlng.wrap().lat,
        longitude: event.latlng.wrap().lng,
      }),
    keydown: (event) => {
      if (event.originalEvent.key === "Enter") {
        const p = map.getCenter().wrap();
        onPin({ latitude: p.lat, longitude: p.lng });
      }
    },
  });
  useEffect(() => {
    const points = media.flatMap((m) =>
      m.gps ? [[m.gps.latitude, m.gps.longitude] as [number, number]] : [],
    );
    if (anchor) points.push([anchor.latitude, anchor.longitude]);
    if (points.length)
      map.fitBounds(L.latLngBounds(points), {
        padding: [35, 35],
        maxZoom: 15,
        animate: false,
      });
  }, [map, anchor, media]);
  return (
    <>
      {anchor && (
        <>
          <Circle
            center={[anchor.latitude, anchor.longitude]}
            radius={radius}
            pathOptions={{ color: "#d2b77a", weight: 1, fillOpacity: 0.08 }}
          />
          <CircleMarker
            center={[anchor.latitude, anchor.longitude]}
            radius={8}
            pathOptions={{
              color: "#fff",
              fillColor: "#b68a3b",
              fillOpacity: 1,
            }}
          >
            <Tooltip>Place pin · tap to move</Tooltip>
          </CircleMarker>
        </>
      )}
      {media.slice(0, 1000).flatMap((m) =>
        m.gps
          ? [
              <CircleMarker
                key={m.id}
                center={[m.gps.latitude, m.gps.longitude]}
                radius={3}
                pathOptions={{ color: "#335f4f", fillOpacity: 0.8, weight: 1 }}
              >
                <Tooltip>{m.name}</Tooltip>
              </CircleMarker>,
            ]
          : [],
      )}
    </>
  );
}
export default function PlaceReviewMap(props: {
  anchor?: GeoPoint;
  radius: number;
  media: PlaceMedia[];
  onPin: (point: GeoPoint) => void;
}) {
  return (
    <div className="gp-map">
      <MapContainer
        center={[props.anchor?.latitude ?? 22, props.anchor?.longitude ?? 78]}
        zoom={props.anchor ? 12 : 3}
        style={{ height: "100%", width: "100%", zIndex: 0 }}
        scrollWheelZoom={false}
      >
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        <Contents {...props} />
      </MapContainer>
      <p>
        Original GPS dots · gold place pin. Tap the map, or pan and press Enter,
        to adjust the pin. Online map tiles; coordinates remain available
        offline.
      </p>
    </div>
  );
}
