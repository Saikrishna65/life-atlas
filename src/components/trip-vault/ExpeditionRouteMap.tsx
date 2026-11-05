"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Navigation, Mountain, Compass, Download, Clock, Zap } from "lucide-react";
import { LiveExpeditionSession } from "@/lib/vault/types";
import { formatDuration, exportExpeditionToGeoJson } from "@/lib/vault/liveTrackingEngine";

// Dynamically import map component with SSR disabled
const ExpeditionMapInner = dynamic(() => import("./ExpeditionMapInner"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full min-h-[340px] rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 text-xs">
      Loading topographic route map…
    </div>
  ),
});

export default function ExpeditionRouteMap({
  session,
}: {
  session: LiveExpeditionSession;
}) {
  const [selectedLegId, setSelectedLegId] = useState<string>("ALL");

  const totalPoints = session.legs.reduce((acc, leg) => acc + leg.coordinates.length, 0);

  const downloadGeoJson = () => {
    const data = exportExpeditionToGeoJson(session);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `expedition-route-${session.tripId}.geojson`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-sm">
          <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase flex items-center gap-1.5">
            <Navigation className="w-3.5 h-3.5 text-sky-600" />
            Distance
          </span>
          <p className="text-xl font-bold text-slate-800 mt-1">
            {session.totalDistanceKm} <small className="text-xs font-normal text-slate-500">km</small>
          </p>
        </div>

        <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-sm">
          <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-emerald-600" />
            Moving Time
          </span>
          <p className="text-xl font-bold text-slate-800 mt-1">
            {formatDuration(session.movingSeconds || session.totalDurationSeconds)}
          </p>
        </div>

        <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-sm">
          <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase flex items-center gap-1.5">
            <Mountain className="w-3.5 h-3.5 text-amber-600" />
            Elevation Gain
          </span>
          <p className="text-xl font-bold text-slate-800 mt-1">
            {session.elevationGainMeters} <small className="text-xs font-normal text-slate-500">m</small>
          </p>
        </div>

        <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-sm">
          <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase flex items-center gap-1.5">
            <Compass className="w-3.5 h-3.5 text-indigo-600" />
            Peak Altitude
          </span>
          <p className="text-xl font-bold text-slate-800 mt-1">
            {session.maxElevationMeters ?? "—"}{" "}
            {session.maxElevationMeters && <small className="text-xs font-normal text-slate-500">m</small>}
          </p>
        </div>
      </div>

      {/* Leg Selector Chips */}
      {session.legs.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            type="button"
            onClick={() => setSelectedLegId("ALL")}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
              selectedLegId === "ALL"
                ? "bg-slate-900 text-white shadow-sm"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            All Route ({session.totalDistanceKm} km)
          </button>
          {session.legs.map((leg, idx) => (
            <button
              key={leg.id}
              type="button"
              onClick={() => setSelectedLegId(leg.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                selectedLegId === leg.id
                  ? "bg-sky-600 text-white shadow-sm"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              Leg {idx + 1}: {leg.title} ({leg.distanceKm} km)
            </button>
          ))}
        </div>
      )}

      {/* Map Container */}
      <div className="w-full h-[360px] sm:h-[440px] rounded-2xl overflow-hidden border border-slate-200 shadow-sm relative">
        {totalPoints === 0 ? (
          <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-slate-50">
            <div className="w-12 h-12 rounded-full bg-sky-50 text-sky-600 grid place-items-center mb-3">
              <Compass className="w-6 h-6" />
            </div>
            <h4 className="font-semibold text-slate-800 text-sm">Ready to record your route</h4>
            <p className="text-xs text-slate-500 max-w-xs mt-1">
              Start your expedition to record live satellite GPS breadcrumbs and trace your journey on the map.
            </p>
          </div>
        ) : (
          <ExpeditionMapInner session={session} selectedLegId={selectedLegId} />
        )}
      </div>

      {/* Action footer */}
      {totalPoints > 0 && (
        <div className="flex justify-between items-center pt-1 text-xs text-slate-500">
          <span>{totalPoints} GPS breadcrumb coordinates recorded</span>
          <button
            type="button"
            onClick={downloadGeoJson}
            className="inline-flex items-center gap-1.5 text-sky-600 font-semibold hover:underline"
          >
            <Download className="w-3.5 h-3.5" />
            Export GeoJSON
          </button>
        </div>
      )}
    </div>
  );
}
