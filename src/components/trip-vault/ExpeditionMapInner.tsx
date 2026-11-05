"use client";

import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { LiveExpeditionSession, ExpeditionLeg } from "@/lib/vault/types";

// Custom icons
const createPinIcon = (color: string, label: string) =>
  L.divIcon({
    className: "custom-map-pin",
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -28],
    html: `
      <div style="background:${color};width:24px;height:24px;border-radius:50%;border:2px solid #ffffff;box-shadow:0 3px 10px rgba(0,0,0,0.3);display:grid;place-items:center;color:white;font-size:10px;font-weight:bold;">
        ${label}
      </div>
    `,
  });

const createLivePulseIcon = () =>
  L.divIcon({
    className: "custom-live-beacon",
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    html: `
      <div style="position:relative;width:24px;height:24px;">
        <div style="position:absolute;inset:0;border-radius:50%;background:#0284c7;opacity:0.4;animation:ping 1.5s cubic-bezier(0,0,0.2,1) infinite;"></div>
        <div style="position:absolute;inset:4px;border-radius:50%;background:#0284c7;border:2px solid #ffffff;box-shadow:0 0 10px #0284c7;"></div>
      </div>
    `,
  });

function MapAutoBounds({ coordinates }: { coordinates: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (coordinates.length > 0) {
      const bounds = L.latLngBounds(coordinates);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    }
  }, [coordinates, map]);
  return null;
}

export default function ExpeditionMapInner({
  session,
  selectedLegId,
}: {
  session: LiveExpeditionSession;
  selectedLegId: string;
}) {
  const legsToRender = useMemo(() => {
    if (selectedLegId === "ALL") {
      return session.legs.filter((l) => l.coordinates.length > 0);
    }
    return session.legs.filter((l) => l.id === selectedLegId && l.coordinates.length > 0);
  }, [session.legs, selectedLegId]);

  const allPoints = useMemo(() => {
    return legsToRender.flatMap((l) =>
      l.coordinates.map((c) => [c.latitude, c.longitude] as [number, number])
    );
  }, [legsToRender]);

  const defaultCenter = allPoints.length > 0 ? allPoints[0] : ([30.4878, 79.1764] as [number, number]);

  const startPoint = allPoints.length > 0 ? allPoints[0] : null;
  const endPoint = allPoints.length > 1 ? allPoints[allPoints.length - 1] : null;
  const currentPos = session.currentLocation
    ? ([session.currentLocation.latitude, session.currentLocation.longitude] as [number, number])
    : null;

  return (
    <div style={{ height: "100%", width: "100%", position: "relative" }}>
      <MapContainer
        center={defaultCenter}
        zoom={13}
        style={{ height: "100%", width: "100%", borderRadius: "20px" }}
        zoomControl={true}
        attributionControl={false}
      >
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={18}
        />

        {legsToRender.map((leg) => {
          const latLngs = leg.coordinates.map((c) => [c.latitude, c.longitude] as [number, number]);
          const color =
            leg.category === "TREK"
              ? "#0284c7" // Travel cyan
              : leg.category === "DRIVE"
              ? "#f59e0b" // Amber
              : "#10b981"; // Emerald

          return (
            <Polyline
              key={leg.id}
              positions={latLngs}
              pathOptions={{
                color,
                weight: 5,
                opacity: 0.9,
                lineJoin: "round",
                lineCap: "round",
              }}
            >
              <Popup>
                <div style={{ padding: "4px" }}>
                  <strong style={{ fontSize: "13px", display: "block" }}>{leg.title}</strong>
                  <p style={{ margin: "4px 0", fontSize: "11px", color: "#64748b" }}>
                    {leg.category} · {leg.distanceKm} km · {leg.elevationGainMeters}m gain
                  </p>
                </div>
              </Popup>
            </Polyline>
          );
        })}

        {startPoint && (
          <Marker position={startPoint} icon={createPinIcon("#10b981", "A")}>
            <Popup>
              <strong>Expedition Start</strong>
            </Popup>
          </Marker>
        )}

        {endPoint && (
          <Marker position={endPoint} icon={createPinIcon("#ef4444", "B")}>
            <Popup>
              <strong>Current / End Location</strong>
            </Popup>
          </Marker>
        )}

        {session.status === "ACTIVE" && currentPos && (
          <Marker position={currentPos} icon={createLivePulseIcon()}>
            <Popup>
              <strong>You are here</strong>
              <p style={{ margin: 0, fontSize: "11px" }}>
                {session.currentSpeedKmh || 0} km/h · {session.currentElevationMeters || 0} m
              </p>
            </Popup>
          </Marker>
        )}

        {allPoints.length > 0 && <MapAutoBounds coordinates={allPoints} />}
      </MapContainer>
    </div>
  );
}
