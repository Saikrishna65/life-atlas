"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import {
  Navigation,
  Mountain,
  Compass,
  Download,
  Clock,
  Zap,
  TrendingUp,
  MapPin,
} from "lucide-react";
import { LiveExpeditionSession, WaypointRecord } from "@/lib/vault/types";
import {
  formatDuration,
  exportExpeditionToGeoJson,
} from "@/lib/vault/liveTrackingEngine";

// Dynamically import map component with SSR disabled
const ExpeditionMapInner = dynamic(() => import("./ExpeditionMapInner"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full min-h-[340px] rounded-2xl sm:rounded-3xl bg-slate-900 flex flex-col items-center justify-center text-slate-400 text-xs gap-3">
      <div className="w-6 h-6 rounded-full border-2 border-sky-400 border-t-transparent animate-spin" />
      <span>Loading cartographic route map…</span>
    </div>
  ),
});

export default function ExpeditionRouteMap({
  session,
  waypoints,
  className = "",
}: {
  session: LiveExpeditionSession;
  waypoints?: WaypointRecord[];
  className?: string;
}) {
  const [selectedLegId, setSelectedLegId] = useState<string>("ALL");

  const totalPoints = session.legs.reduce(
    (acc, leg) => acc + leg.coordinates.length,
    0
  );

  // Compute elevation profile data points for the SVG sparkline
  const elevationProfile = useMemo(() => {
    const points: { alt: number; idx: number }[] = [];
    session.legs.forEach((leg) => {
      leg.coordinates.forEach((c) => {
        if (typeof c.altitude === "number" && c.altitude > 0) {
          points.push({ alt: Math.round(c.altitude), idx: points.length });
        }
      });
    });
    if (points.length < 2) return null;

    const minAlt = Math.min(...points.map((p) => p.alt));
    const maxAlt = Math.max(...points.map((p) => p.alt));
    const diff = Math.max(10, maxAlt - minAlt);

    // Downsample to max 50 SVG points for smooth curve
    const step = Math.max(1, Math.floor(points.length / 50));
    const sampled = points.filter((_, i) => i % step === 0 || i === points.length - 1);

    const width = 300;
    const height = 48;
    const d = sampled
      .map((p, i) => {
        const x = (i / (sampled.length - 1)) * width;
        const y = height - ((p.alt - minAlt) / diff) * (height - 8) - 4;
        return `${i === 0 ? "M" : "L"} ${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");

    return { path: d, minAlt, maxAlt, count: points.length };
  }, [session.legs]);

  const downloadGeoJson = () => {
    const data = exportExpeditionToGeoJson(session);
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `expedition-route-${session.tripId}.geojson`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Sleek Outdoor Telemetry HUD Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="p-3 sm:p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <span className="text-[10px] font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase flex items-center gap-1.5">
            <Navigation className="w-3.5 h-3.5 text-sky-500" />
            Distance
          </span>
          <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1 tracking-tight">
            {session.totalDistanceKm}{" "}
            <small className="text-xs font-semibold text-slate-400">km</small>
          </p>
        </div>

        <div className="p-3 sm:p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <span className="text-[10px] font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-emerald-500" />
            Moving Time
          </span>
          <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1 font-mono tracking-tight">
            {formatDuration(
              session.movingSeconds || session.totalDurationSeconds
            )}
          </p>
        </div>

        <div className="p-3 sm:p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <span className="text-[10px] font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-amber-500" />
            Elevation Gain
          </span>
          <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1 tracking-tight">
            +{session.elevationGainMeters}{" "}
            <small className="text-xs font-semibold text-slate-400">m</small>
          </p>
        </div>

        <div className="p-3 sm:p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <span className="text-[10px] font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase flex items-center gap-1.5">
            <Mountain className="w-3.5 h-3.5 text-indigo-500" />
            Peak Altitude
          </span>
          <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1 tracking-tight">
            {session.maxElevationMeters ?? "—"}{" "}
            {session.maxElevationMeters && (
              <small className="text-xs font-semibold text-slate-400">m</small>
            )}
          </p>
        </div>
      </div>

      {/* Altitude Profile Sparkline (If GPS elevation data exists) */}
      {elevationProfile && (
        <div className="p-3 sm:p-4 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 text-white border border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="shrink-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-sky-400 flex items-center gap-1">
              <Mountain className="w-3 h-3" /> Elevation Ascent Profile
            </span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <strong className="text-base font-bold">
                {elevationProfile.minAlt}m → {elevationProfile.maxAlt}m
              </strong>
              <span className="text-[11px] text-slate-400">
                (+{elevationProfile.maxAlt - elevationProfile.minAlt}m climb)
              </span>
            </div>
          </div>

          <div className="w-full sm:w-[260px] h-[44px]">
            <svg
              viewBox="0 0 300 48"
              className="w-full h-full overflow-visible"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="elevGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              <path
                d={elevationProfile.path}
                fill="none"
                stroke="#38bdf8"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>
      )}

      {/* Leg Selector Chips with category color pills */}
      {session.legs.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none items-center">
          <button
            type="button"
            onClick={() => setSelectedLegId("ALL")}
            className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
              selectedLegId === "ALL"
                ? "bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-900"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
            }`}
          >
            All Route ({session.totalDistanceKm} km)
          </button>
          {session.legs.map((leg, idx) => {
            const isSelected = selectedLegId === leg.id;
            const badgeColor =
              leg.category === "TREK"
                ? "bg-sky-500"
                : leg.category === "DRIVE"
                ? "bg-amber-500"
                : "bg-emerald-500";
            return (
              <button
                key={leg.id}
                type="button"
                onClick={() => setSelectedLegId(leg.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  isSelected
                    ? "bg-sky-600 text-white shadow-sm"
                    : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    isSelected ? "bg-white" : badgeColor
                  }`}
                />
                <span>
                  Leg {idx + 1}: {leg.title} ({leg.distanceKm} km)
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Map Container: Fluid height for phones and desktops */}
      <div className="w-full h-[340px] xs:h-[380px] sm:h-[460px] md:h-[520px] rounded-2xl sm:rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-md relative">
        {totalPoints === 0 ? (
          <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-slate-900 text-white">
            <div className="w-14 h-14 rounded-full bg-sky-500/10 text-sky-400 grid place-items-center mb-3 border border-sky-500/20 shadow-inner">
              <Compass className="w-7 h-7 animate-pulse" />
            </div>
            <h4 className="font-bold text-slate-100 text-sm sm:text-base">
              Ready to record your route
            </h4>
            <p className="text-xs text-slate-400 max-w-xs mt-1.5 leading-relaxed">
              Start your expedition to record live satellite GPS breadcrumbs, altitude elevation, and trace your journey on the map.
            </p>
          </div>
        ) : (
          <ExpeditionMapInner
            session={session}
            selectedLegId={selectedLegId}
            waypoints={waypoints}
          />
        )}
      </div>

      {/* Action Footer */}
      {totalPoints > 0 && (
        <div className="flex justify-between items-center pt-1 text-xs text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
            {totalPoints} GPS breadcrumbs logged
          </span>
          <button
            type="button"
            onClick={downloadGeoJson}
            className="inline-flex items-center gap-1.5 text-sky-600 dark:text-sky-400 font-bold hover:underline cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Export GeoJSON
          </button>
        </div>
      )}
    </div>
  );
}
