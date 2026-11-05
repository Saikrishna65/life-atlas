"use client";

import { useEffect, useMemo, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Polyline,
  Marker,
  Popup,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { LiveExpeditionSession, WaypointRecord } from "@/lib/vault/types";

// Supported Cartographic Tile Layers
export type MapStyleKey = "VOYAGER" | "TOPO" | "DARK" | "SATELLITE";

const MAP_STYLES: Record<
  MapStyleKey,
  { label: string; icon: string; url: string; subdomains: string; maxZoom: number }
> = {
  VOYAGER: {
    label: "Voyager",
    icon: "🧭",
    url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    subdomains: "abcd",
    maxZoom: 19,
  },
  TOPO: {
    label: "Topographic",
    icon: "🏔️",
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    subdomains: "abc",
    maxZoom: 17,
  },
  DARK: {
    label: "Midnight HUD",
    icon: "🌌",
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    subdomains: "abcd",
    maxZoom: 19,
  },
  SATELLITE: {
    label: "Satellite",
    icon: "🛰️",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    subdomains: "",
    maxZoom: 18,
  },
};

// Luxury Custom Markers
const createStartIcon = (elevation?: number | null) =>
  L.divIcon({
    className: "custom-map-start",
    iconSize: [42, 42],
    iconAnchor: [21, 42],
    popupAnchor: [0, -42],
    html: `
      <div style="position:relative;display:flex;flex-direction:column;align-items:center;">
        <div style="background:linear-gradient(135deg,#10b981,#059669);color:white;padding:3px 9px;border-radius:20px;font-size:10px;font-weight:800;letter-spacing:0.5px;box-shadow:0 4px 14px rgba(16,185,129,0.5);border:1.5px solid #ffffff;white-space:nowrap;display:flex;align-items:center;gap:3px;">
          <span>START</span>
          ${elevation ? `<span style="opacity:0.85;font-weight:500;">· ${elevation}m</span>` : ""}
        </div>
        <div style="width:2px;height:8px;background:#059669;box-shadow:0 2px 4px rgba(0,0,0,0.3);"></div>
        <div style="width:6px;height:6px;background:#ffffff;border-radius:50%;border:2px solid #059669;"></div>
      </div>
    `,
  });

const createSummitEndIcon = (label: string, elevation?: number | null) =>
  L.divIcon({
    className: "custom-map-summit",
    iconSize: [48, 48],
    iconAnchor: [24, 48],
    popupAnchor: [0, -48],
    html: `
      <div style="position:relative;display:flex;flex-direction:column;align-items:center;">
        <div style="background:linear-gradient(135deg,#f59e0b,#ea580c);color:white;padding:3px 10px;border-radius:20px;font-size:10px;font-weight:800;letter-spacing:0.5px;box-shadow:0 4px 16px rgba(245,158,11,0.55);border:1.5px solid #ffffff;white-space:nowrap;display:flex;align-items:center;gap:3px;">
          <span>🏔️ ${label.toUpperCase()}</span>
          ${elevation ? `<span style="opacity:0.9;font-weight:600;">· ${elevation}m</span>` : ""}
        </div>
        <div style="width:2px;height:8px;background:#ea580c;box-shadow:0 2px 4px rgba(0,0,0,0.3);"></div>
        <div style="width:6px;height:6px;background:#ffffff;border-radius:50%;border:2px solid #ea580c;"></div>
      </div>
    `,
  });

const createWaypointIcon = (index: number, name: string) =>
  L.divIcon({
    className: "custom-map-waypoint",
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -28],
    html: `
      <div style="position:relative;display:flex;flex-direction:column;align-items:center;">
        <div style="width:24px;height:24px;border-radius:50%;background:#ffffff;border:2px solid #0284c7;color:#0369a1;font-size:10px;font-weight:800;display:grid;place-items:center;box-shadow:0 3px 10px rgba(0,0,0,0.25);">
          ${index}
        </div>
      </div>
    `,
  });

const createLiveBeaconIcon = () =>
  L.divIcon({
    className: "custom-live-beacon",
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    html: `
      <div style="position:relative;width:32px;height:32px;display:grid;place-items:center;">
        <div style="position:absolute;inset:0;border-radius:50%;background:#0284c7;opacity:0.35;animation:pulse 1.8s cubic-bezier(0,0,0.2,1) infinite;"></div>
        <div style="position:absolute;inset:4px;border-radius:50%;background:#38bdf8;opacity:0.6;animation:ping 2.2s cubic-bezier(0,0,0.2,1) infinite;"></div>
        <div style="position:relative;width:14px;height:14px;border-radius:50%;background:#0284c7;border:2.5px solid #ffffff;box-shadow:0 0 14px #0284c7;"></div>
      </div>
    `,
  });

// Fit map bounds controller
function MapAutoBounds({
  coordinates,
  triggerKey,
}: {
  coordinates: [number, number][];
  triggerKey?: string;
}) {
  const map = useMap();
  useEffect(() => {
    if (coordinates.length > 0) {
      const bounds = L.latLngBounds(coordinates);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  }, [coordinates, map, triggerKey]);
  return null;
}

// Controller to programmatic recenter or fit bounds
function MapControllerBridge({
  allPoints,
  currentPos,
  actionKey,
}: {
  allPoints: [number, number][];
  currentPos: [number, number] | null;
  actionKey: { type: "FIT" | "CENTER"; timestamp: number } | null;
}) {
  const map = useMap();
  useEffect(() => {
    if (!actionKey) return;
    if (actionKey.type === "FIT" && allPoints.length > 0) {
      const bounds = L.latLngBounds(allPoints);
      map.flyToBounds(bounds, { padding: [50, 50], duration: 1.2 });
    } else if (actionKey.type === "CENTER" && currentPos) {
      map.flyTo(currentPos, 15, { duration: 1.2 });
    }
  }, [actionKey, allPoints, currentPos, map]);
  return null;
}

export default function ExpeditionMapInner({
  session,
  selectedLegId,
  waypoints,
  defaultStyle = "VOYAGER",
  interactive = true,
}: {
  session: LiveExpeditionSession;
  selectedLegId: string;
  waypoints?: WaypointRecord[];
  defaultStyle?: MapStyleKey;
  interactive?: boolean;
}) {
  const [activeStyle, setActiveStyle] = useState<MapStyleKey>(defaultStyle);
  const [controlAction, setControlAction] = useState<{
    type: "FIT" | "CENTER";
    timestamp: number;
  } | null>(null);

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

  const defaultCenter =
    allPoints.length > 0
      ? allPoints[0]
      : ([30.4878, 79.1764] as [number, number]);

  // Elevation metadata
  const firstCoord = allPoints.length > 0 ? legsToRender[0]?.coordinates[0] : null;
  const lastCoord =
    allPoints.length > 0
      ? legsToRender[legsToRender.length - 1]?.coordinates[
          legsToRender[legsToRender.length - 1].coordinates.length - 1
        ]
      : null;

  const startPoint = allPoints.length > 0 ? allPoints[0] : null;
  const endPoint = allPoints.length > 1 ? allPoints[allPoints.length - 1] : null;
  const currentPos = session.currentLocation
    ? ([session.currentLocation.latitude, session.currentLocation.longitude] as [number, number])
    : null;

  const currentStyleConfig = MAP_STYLES[activeStyle];

  return (
    <div className="relative w-full h-full overflow-hidden rounded-2xl sm:rounded-3xl shadow-inner select-none bg-slate-900">
      <MapContainer
        center={defaultCenter}
        zoom={13}
        style={{ height: "100%", width: "100%", borderRadius: "inherit" }}
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer
          key={activeStyle}
          url={currentStyleConfig.url}
          subdomains={currentStyleConfig.subdomains}
          maxZoom={currentStyleConfig.maxZoom}
        />

        {/* DOUBLE-PASS GLOWING POLYLINES */}
        {legsToRender.map((leg) => {
          const latLngs = leg.coordinates.map(
            (c) => [c.latitude, c.longitude] as [number, number]
          );

          // Colors based on category and style
          const isDark = activeStyle === "DARK";
          const coreColor =
            leg.category === "TREK"
              ? isDark
                ? "#00f0ff"
                : "#0284c7"
              : leg.category === "DRIVE"
              ? isDark
                ? "#fbb034"
                : "#f59e0b"
              : isDark
              ? "#10b981"
              : "#059669";

          const haloColor =
            leg.category === "TREK"
              ? "#06b6d4"
              : leg.category === "DRIVE"
              ? "#f59e0b"
              : "#10b981";

          return (
            <div key={leg.id}>
              {/* Pass 1: Glowing Halo */}
              <Polyline
                positions={latLngs}
                pathOptions={{
                  color: haloColor,
                  weight: 9,
                  opacity: isDark ? 0.45 : 0.28,
                  lineJoin: "round",
                  lineCap: "round",
                }}
              />
              {/* Pass 2: High-Definition Core Trail */}
              <Polyline
                positions={latLngs}
                pathOptions={{
                  color: coreColor,
                  weight: 4.5,
                  opacity: 0.95,
                  lineJoin: "round",
                  lineCap: "round",
                }}
              >
                <Popup>
                  <div style={{ padding: "6px", minWidth: 160 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: coreColor,
                          display: "inline-block",
                        }}
                      />
                      <strong style={{ fontSize: 13, color: "#0f172a" }}>
                        {leg.title}
                      </strong>
                    </div>
                    <p style={{ margin: "6px 0 2px", fontSize: 11, color: "#64748b" }}>
                      Mode: <b style={{ color: "#334155" }}>{leg.category}</b> ·{" "}
                      {leg.distanceKm} km
                    </p>
                    <p style={{ margin: "2px 0", fontSize: 11, color: "#64748b" }}>
                      Gain: <b style={{ color: "#334155" }}>+{leg.elevationGainMeters} m</b> · Max:{" "}
                      {leg.maxSpeedKmh ? `${Math.round(leg.maxSpeedKmh)} km/h` : "—"}
                    </p>
                  </div>
                </Popup>
              </Polyline>
            </div>
          );
        })}

        {/* Start Pin */}
        {startPoint && (
          <Marker
            position={startPoint}
            icon={createStartIcon(firstCoord?.altitude)}
          >
            <Popup>
              <div style={{ padding: 4 }}>
                <strong style={{ color: "#059669" }}>Expedition Trailhead</strong>
                <p style={{ margin: "4px 0 0", fontSize: 11, color: "#64748b" }}>
                  Departure elevation: {firstCoord?.altitude ? `${firstCoord.altitude}m` : "Base"}
                </p>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Summit / End Pin */}
        {endPoint && (
          <Marker
            position={endPoint}
            icon={createSummitEndIcon(
              session.status === "COMPLETED" ? "End" : "Summit",
              lastCoord?.altitude
            )}
          >
            <Popup>
              <div style={{ padding: 4 }}>
                <strong style={{ color: "#ea580c" }}>
                  {session.status === "COMPLETED" ? "Expedition Conclusion" : "Summit / Latest Stop"}
                </strong>
                <p style={{ margin: "4px 0 0", fontSize: 11, color: "#64748b" }}>
                  Elevation: {lastCoord?.altitude ? `${lastCoord.altitude}m` : "Recorded"}
                </p>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Waypoints along journey */}
        {waypoints?.map((wp, idx) => {
          if (!wp.latitude || !wp.longitude) return null;
          return (
            <Marker
              key={wp.id}
              position={[wp.latitude, wp.longitude]}
              icon={createWaypointIcon(idx + 1, wp.title)}
            >
              <Popup>
                <div style={{ padding: 4 }}>
                  <strong style={{ color: "#0369a1" }}>{wp.title}</strong>
                  {wp.elevationMeters && (
                    <p style={{ margin: "3px 0 0", fontSize: 11, color: "#64748b" }}>
                      Altitude: {wp.elevationMeters} m
                    </p>
                  )}
                  {wp.notes && (
                    <p style={{ margin: "4px 0 0", fontSize: 11, color: "#475569" }}>
                      {wp.notes}
                    </p>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Live Pulsing Beacon for current real-time GPS position */}
        {session.status === "ACTIVE" && currentPos && (
          <Marker position={currentPos} icon={createLiveBeaconIcon()}>
            <Popup>
              <div style={{ padding: 4 }}>
                <strong style={{ color: "#0284c7" }}>🛰️ Live Satellite Position</strong>
                <p style={{ margin: "4px 0 0", fontSize: 11, color: "#334155" }}>
                  Speed: <b>{session.currentSpeedKmh || 0} km/h</b> · Altitude:{" "}
                  <b>{session.currentElevationMeters || 0} m</b>
                </p>
              </div>
            </Popup>
          </Marker>
        )}

        {allPoints.length > 0 && (
          <MapAutoBounds coordinates={allPoints} triggerKey={selectedLegId} />
        )}

        <MapControllerBridge
          allPoints={allPoints}
          currentPos={currentPos}
          actionKey={controlAction}
        />
      </MapContainer>

      {/* FLOATING LUXURY HUD CONTROLS OVERLAY */}
      {interactive && (
        <>
          {/* Top-Right: Cartography Style Switcher */}
          <div className="absolute top-3 right-3 z-[1000] flex items-center bg-white/90 dark:bg-slate-900/90 backdrop-blur-md p-1 rounded-full border border-slate-200/80 dark:border-slate-700/80 shadow-lg text-[11px] font-semibold gap-0.5">
            {(Object.keys(MAP_STYLES) as MapStyleKey[]).map((key) => {
              const active = activeStyle === key;
              return (
                <button
                  type="button"
                  key={key}
                  onClick={() => setActiveStyle(key)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-full transition-all cursor-pointer ${
                    active
                      ? "bg-slate-900 text-white shadow-xs dark:bg-sky-500 dark:text-slate-950 font-bold"
                      : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                  }`}
                  title={MAP_STYLES[key].label}
                >
                  <span>{MAP_STYLES[key].icon}</span>
                  <span className="hidden sm:inline">{MAP_STYLES[key].label}</span>
                </button>
              );
            })}
          </div>

          {/* Bottom-Right: Quick Recenter / Fit Controls */}
          <div className="absolute bottom-3 right-3 z-[1000] flex flex-col gap-1.5">
            {currentPos && (
              <button
                type="button"
                onClick={() =>
                  setControlAction({ type: "CENTER", timestamp: Date.now() })
                }
                className="w-9 h-9 rounded-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-700 shadow-md flex items-center justify-center text-sky-600 active:scale-95 transition-all cursor-pointer"
                title="Center on Live Position"
              >
                <span className="w-3.5 h-3.5 rounded-full bg-sky-500 animate-ping absolute" />
                <span className="relative w-2.5 h-2.5 rounded-full bg-sky-600" />
              </button>
            )}

            {allPoints.length > 0 && (
              <button
                type="button"
                onClick={() =>
                  setControlAction({ type: "FIT", timestamp: Date.now() })
                }
                className="px-3 py-1.5 rounded-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-700 shadow-md text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
                title="Fit full route in view"
              >
                <span>🔍</span>
                <span className="hidden xs:inline">Fit Route</span>
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
