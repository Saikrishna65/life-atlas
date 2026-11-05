"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Play,
  Pause,
  Square,
  Plus,
  Compass,
  Navigation,
  Mountain,
  Clock,
  MapPin,
  ChevronRight,
  CheckCircle2,
} from "lucide-react";
import { useLiveExpedition } from "@/lib/vault/useLiveExpedition";
import { ExpeditionLegCategory } from "@/lib/vault/types";

export default function LiveExpeditionTracker({
  tripId,
  tripDestination,
}: {
  tripId: string;
  tripDestination?: string;
}) {
  const {
    session,
    isLoading,
    isTracking,
    isPaused,
    isCompleted,
    activeLeg,
    elapsedFormatted,
    start,
    startLeg,
    pause,
    resume,
    end,
  } = useLiveExpedition(tripId);

  const [showNewLegModal, setShowNewLegModal] = useState(false);
  const [newLegTitle, setNewLegTitle] = useState("");
  const [newLegCategory, setNewLegCategory] = useState<ExpeditionLegCategory>("TREK");

  if (isLoading) {
    return null;
  }

  const handleStartNewLeg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLegTitle.trim()) return;
    await startLeg(newLegTitle.trim(), newLegCategory);
    setNewLegTitle("");
    setShowNewLegModal(false);
  };

  // State 1: IDLE (Not started yet)
  if (!session || session.status === "IDLE") {
    return (
      <section className="tv-panel my-4 border border-sky-100 bg-gradient-to-br from-white to-sky-50/50 p-5 rounded-2xl shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-sky-100 text-sky-800">
              <Compass className="w-3 h-3 text-sky-600 animate-spin-slow" />
              Live Expedition GPS
            </span>
            <h3 className="text-base font-bold text-slate-900 mt-2">
              Ready to record your journey?
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm">
              Tap Start when you depart. Life Atlas will track distance, speed, altitude, and trace your exact route on the map completely offline.
            </p>
          </div>
          <button
            type="button"
            onClick={() => start(`Expedition to ${tripDestination || "Destination"}`, "TREK")}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 active:scale-95 text-white text-xs font-bold shadow-md shadow-sky-600/25 transition-all flex-shrink-0"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            Start Trip
          </button>
        </div>
      </section>
    );
  }

  // State 2: ACTIVE or PAUSED
  if (isTracking || isPaused) {
    return (
      <section className="tv-panel my-4 border border-sky-200 bg-white p-5 rounded-2xl shadow-md relative overflow-hidden">
        {/* Top live header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isPaused ? "bg-amber-400" : "bg-emerald-400"}`}></span>
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isPaused ? "bg-amber-500" : "bg-emerald-500"}`}></span>
            </span>
            <span className="text-[11px] font-bold tracking-wider uppercase text-slate-700">
              {isPaused ? "Expedition Paused" : "Live Expedition Active"}
            </span>
          </div>

          <Link
            href={`/secret/vault/${tripId}/routes`}
            className="inline-flex items-center gap-1 text-xs font-semibold text-sky-600 hover:text-sky-700"
          >
            Route Map
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Live Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
              Distance Traveled
            </span>
            <strong className="text-2xl font-bold text-slate-900 tracking-tight block mt-0.5">
              {session.totalDistanceKm} <small className="text-xs font-normal text-slate-500">km</small>
            </strong>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
              Expedition Time
            </span>
            <strong className="text-2xl font-bold text-slate-900 tracking-tight block mt-0.5 font-mono">
              {elapsedFormatted}
            </strong>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
              Current Altitude
            </span>
            <strong className="text-2xl font-bold text-slate-900 tracking-tight block mt-0.5">
              {session.currentElevationMeters ?? "—"}{" "}
              {session.currentElevationMeters && <small className="text-xs font-normal text-slate-500">m</small>}
            </strong>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
              Current Speed
            </span>
            <strong className="text-2xl font-bold text-slate-900 tracking-tight block mt-0.5">
              {session.currentSpeedKmh ?? 0} <small className="text-xs font-normal text-slate-500">km/h</small>
            </strong>
          </div>
        </div>

        {/* Active Leg pill */}
        {activeLeg && (
          <div className="flex items-center justify-between text-xs text-slate-600 bg-sky-50/70 border border-sky-100 rounded-xl px-3 py-2 mb-4">
            <span className="flex items-center gap-1.5 font-medium">
              <Navigation className="w-3.5 h-3.5 text-sky-600" />
              Active Track: <b>{activeLeg.title}</b> ({activeLeg.category})
            </span>
            <span className="font-semibold text-sky-800">{activeLeg.distanceKm} km</span>
          </div>
        )}

        {/* Action Controls */}
        <div className="flex items-center gap-2 pt-1 flex-wrap">
          {isPaused ? (
            <button
              type="button"
              onClick={resume}
              className="flex-1 min-w-[110px] inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold active:scale-95 transition-all shadow-sm"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              Resume
            </button>
          ) : (
            <button
              type="button"
              onClick={pause}
              className="flex-1 min-w-[110px] inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold active:scale-95 transition-all"
            >
              <Pause className="w-3.5 h-3.5 fill-current" />
              Pause
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowNewLegModal(true)}
            className="flex-1 min-w-[110px] inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-700 text-xs font-bold border border-sky-200 active:scale-95 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            + New Leg / Trek
          </button>

          <button
            type="button"
            onClick={() => {
              if (window.confirm("Finish and end this expedition? Your complete route, distance, and stats will be finalized.")) {
                void end();
              }
            }}
            className="flex-1 min-w-[110px] inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold active:scale-95 transition-all shadow-sm"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
            End Trip
          </button>
        </div>

        {/* New Leg Modal */}
        {showNewLegModal && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
            <form
              onSubmit={handleStartNewLeg}
              className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-xl space-y-4 border border-slate-200"
            >
              <h4 className="font-bold text-sm text-slate-900">Start a New Leg / Sub-Track</h4>
              <p className="text-xs text-slate-500">
                Record a separate track (e.g. mountain climb, scenic walk, or drive leg) within this expedition.
              </p>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Leg Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Tungnath Summit Climb"
                  value={newLegTitle}
                  onChange={(e) => setNewLegTitle(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-sky-600"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Activity Type
                </label>
                <select
                  value={newLegCategory}
                  onChange={(e) => setNewLegCategory(e.target.value as ExpeditionLegCategory)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-sky-600 bg-white"
                >
                  <option value="TREK">Trek / Hike</option>
                  <option value="DRIVE">Roadtrip / Drive</option>
                  <option value="WALK">Walking Tour</option>
                  <option value="CYCLE">Cycling / Motorcycle</option>
                  <option value="OTHER">Other Activity</option>
                </select>
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewLegModal(false)}
                  className="px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold bg-sky-600 text-white rounded-xl shadow-sm"
                >
                  Start Leg
                </button>
              </div>
            </form>
          </div>
        )}
      </section>
    );
  }

  // State 3: COMPLETED
  return (
    <section className="tv-panel my-4 border border-emerald-200 bg-gradient-to-br from-white to-emerald-50/40 p-5 rounded-2xl shadow-sm">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-emerald-100 text-emerald-800">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          Expedition Completed
        </span>

        <Link
          href={`/secret/vault/${tripId}/routes`}
          className="inline-flex items-center gap-1 text-xs font-bold text-sky-600 hover:text-sky-700"
        >
          View Route on Map
          <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-2 my-3 text-center">
        <div className="p-2.5 rounded-xl bg-white/80 border border-slate-100">
          <span className="text-[9px] font-bold text-slate-400 uppercase block">Distance</span>
          <strong className="text-lg font-bold text-slate-900 mt-0.5 block">
            {session.totalDistanceKm} <small className="text-[10px] font-normal text-slate-500">km</small>
          </strong>
        </div>

        <div className="p-2.5 rounded-xl bg-white/80 border border-slate-100">
          <span className="text-[9px] font-bold text-slate-400 uppercase block">Peak Altitude</span>
          <strong className="text-lg font-bold text-slate-900 mt-0.5 block">
            {session.maxElevationMeters ?? "—"}{" "}
            {session.maxElevationMeters && <small className="text-[10px] font-normal text-slate-500">m</small>}
          </strong>
        </div>

        <div className="p-2.5 rounded-xl bg-white/80 border border-slate-100">
          <span className="text-[9px] font-bold text-slate-400 uppercase block">Total Legs</span>
          <strong className="text-lg font-bold text-slate-900 mt-0.5 block">
            {session.legs.length}
          </strong>
        </div>
      </div>
    </section>
  );
}
