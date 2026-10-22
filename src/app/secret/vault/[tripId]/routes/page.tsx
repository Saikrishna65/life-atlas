"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Compass,
  Plus,
  Trash2,
  Edit3,
  ExternalLink,
  Navigation,
  Lock,
  Search,
  X,
  Car,
  AlertTriangle,
  Clock,
  TrendingUp,
  Mountain,
} from "lucide-react";
import { getTrip } from "@/lib/vault/storage";
import { useRoutesAndWaypoints } from "@/lib/vault/useRoutesAndWaypoints";
import { TripRecord, RouteSegment } from "@/lib/vault/types";
import { revokeSecretAccess } from "@/lib/deviceAuth";
import { useLockBodyScroll } from "@/lib/vault/useLockBodyScroll";
import { Select } from "@/components/ui/Select";

export default function TripRoutesPage() {
  const params = useParams();
  const router = useRouter();
  const tripId = params.tripId as string;

  const [trip, setTrip] = useState<TripRecord | null>(null);
  const [isTripLoading, setIsTripLoading] = useState(true);

  const {
    routeSegments,
    stats,
    isLoading: isRoutesLoading,
    addRouteSegment,
    updateRouteSegment,
    removeRouteSegment,
  } = useRoutesAndWaypoints(tripId);

  const getRouteNavigationUrl = (from: string, to: string) => {
    return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(from)}&destination=${encodeURIComponent(to)}`;
  };

  // Search filter
  const [searchQuery, setSearchQuery] = useState("");

  // Route Leg Modal State
  const [showSegmentModal, setShowSegmentModal] = useState(false);
  const [editingSegment, setEditingSegment] = useState<RouteSegment | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<RouteSegment | null>(null);

  // Form State
  const [segFrom, setSegFrom] = useState("");
  const [segTo, setSegTo] = useState("");
  const [segDistance, setSegDistance] = useState<number>(100);
  const [segHours, setSegHours] = useState<number>(3.5);
  const [segTerrain, setSegTerrain] = useState<RouteSegment["terrainType"]>("MOUNTAIN_TWISTIES");
  const [segCondition, setSegCondition] = useState<RouteSegment["roadCondition"]>("PAVED_GOOD");
  const [segElevation, setSegElevation] = useState<string>("");
  const [segPasses, setSegPasses] = useState("");
  const [segAdvisory, setSegAdvisory] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Lock body scroll when modal is active
  useLockBodyScroll(showSegmentModal || !!deleteCandidate);

  // Load trip record
  useEffect(() => {
    let mounted = true;
    if (!tripId) return;

    (async () => {
      try {
        const data = await getTrip(tripId);
        if (mounted) setTrip(data);
      } catch (err) {
        console.error("Failed to load trip:", err);
      } finally {
        if (mounted) setIsTripLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [tripId]);

  // Lock vault session
  const handleLockVault = () => {
    revokeSecretAccess();
    router.push("/secret/vault");
  };

  // Open Segment Modal
  const handleOpenAddSegment = () => {
    setEditingSegment(null);
    setSegFrom("");
    setSegTo("");
    setSegDistance(120);
    setSegHours(3.5);
    setSegTerrain("MOUNTAIN_TWISTIES");
    setSegCondition("PAVED_GOOD");
    setSegElevation("3200");
    setSegPasses("");
    setSegAdvisory("");
    setShowSegmentModal(true);
  };

  const handleOpenEditSegment = (seg: RouteSegment) => {
    setEditingSegment(seg);
    setSegFrom(seg.fromStop);
    setSegTo(seg.toStop);
    setSegDistance(seg.distanceKm);
    setSegHours(seg.estimatedHours);
    setSegTerrain(seg.terrainType);
    setSegCondition(seg.roadCondition);
    setSegElevation(seg.highestElevationMeters ? String(seg.highestElevationMeters) : "");
    setSegPasses(seg.passNames ? seg.passNames.join(", ") : "");
    setSegAdvisory(seg.advisoryNotes || "");
    setShowSegmentModal(true);
  };

  // Submit Segment Form
  const handleSubmitSegment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!segFrom.trim() || !segTo.trim()) return;

    setIsSubmitting(true);
    try {
      const elev = segElevation.trim() ? parseFloat(segElevation) : undefined;
      const passes = segPasses
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean);

      if (editingSegment) {
        await updateRouteSegment({
          ...editingSegment,
          fromStop: segFrom.trim(),
          toStop: segTo.trim(),
          distanceKm: Number(segDistance) || 0,
          estimatedHours: Number(segHours) || 0,
          terrainType: segTerrain,
          roadCondition: segCondition,
          highestElevationMeters: elev,
          passNames: passes.length > 0 ? passes : undefined,
          advisoryNotes: segAdvisory.trim() || undefined,
        });
      } else {
        await addRouteSegment({
          fromStop: segFrom.trim(),
          toStop: segTo.trim(),
          distanceKm: Number(segDistance) || 0,
          estimatedHours: Number(segHours) || 0,
          terrainType: segTerrain,
          roadCondition: segCondition,
          highestElevationMeters: elev,
          passNames: passes.length > 0 ? passes : undefined,
          advisoryNotes: segAdvisory.trim() || undefined,
          orderIndex: routeSegments.length,
        });
      }
      setShowSegmentModal(false);
      setEditingSegment(null);
    } catch (err) {
      console.error("Failed saving route segment:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteSegment = async () => {
    if (!deleteCandidate) return;
    try {
      await removeRouteSegment(deleteCandidate.id);
      setDeleteCandidate(null);
    } catch (err) {
      console.error("Failed deleting route segment:", err);
    }
  };

  // Filtered segments
  const filteredSegments = useMemo(() => {
    if (!searchQuery.trim()) return routeSegments;
    const q = searchQuery.toLowerCase();
    return routeSegments.filter((seg) => {
      return (
        seg.fromStop.toLowerCase().includes(q) ||
        seg.toStop.toLowerCase().includes(q) ||
        seg.advisoryNotes?.toLowerCase().includes(q) ||
        seg.passNames?.some((p) => p.toLowerCase().includes(q))
      );
    });
  }, [routeSegments, searchQuery]);

  // Road condition styling badge
  const getRoadConditionBadge = (cond: RouteSegment["roadCondition"]) => {
    switch (cond) {
      case "EXCELLENT":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase font-semibold bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
            Excellent Tarmac
          </span>
        );
      case "PAVED_GOOD":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase font-semibold bg-teal-500/15 border border-teal-500/30 text-teal-400">
            Paved Good
          </span>
        );
      case "POTHOLES":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase font-semibold bg-amber-500/15 border border-amber-500/30 text-amber-400">
            Potholes & Broken
          </span>
        );
      case "GRAVEL_UNPAVED":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase font-semibold bg-orange-500/15 border border-orange-500/30 text-orange-400">
            Loose Gravel / Dirt
          </span>
        );
      case "WATER_CROSSING":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase font-semibold bg-blue-500/15 border border-blue-500/30 text-blue-400">
            Water Crossings
          </span>
        );
      case "EXTREME":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase font-semibold bg-rose-500/15 border border-rose-500/30 text-rose-400">
            Extreme Off-Road
          </span>
        );
    }
  };

  if (isTripLoading || isRoutesLoading) {
    return (
      <div className="max-w-4xl mx-auto py-24 text-center text-xs font-mono text-muted-foreground flex items-center justify-center gap-2">
        <div className="w-4 h-4 rounded-full border border-muted border-t-teal-500 animate-spin" />
        <span>Loading offline route legs & navigation...</span>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="max-w-md mx-auto py-20 text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-teal-500 flex items-center justify-center mx-auto">
          <Compass className="w-6 h-6 text-teal-500" />
        </div>
        <h2 className="font-display text-2xl text-foreground font-normal">
          Expedition Dossier Not Found
        </h2>
        <Link
          href="/secret/vault"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-surface border border-muted text-xs font-sans text-foreground"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Return to Dashboard</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in pt-2 sm:pt-4 pb-24">
      {/* Top Navigation */}
      <nav className="flex items-center justify-between border-b border-muted pb-4">
        <Link
          href={`/secret/vault/${trip.id}`}
          className="group inline-flex items-center gap-2 text-xs font-sans tracking-wide text-muted-foreground hover:text-foreground transition-colors py-1.5"
        >
          <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" />
          <span>Command Center</span>
        </Link>

        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/20 text-[11px] font-mono tracking-wider text-teal-400 font-semibold uppercase">
            <Compass className="w-3.5 h-3.5 text-teal-400" />
            <span>Pillar 07 • Routes</span>
          </div>

          <button
            onClick={handleLockVault}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-muted hover:border-foreground/30 text-[11px] font-sans text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            title="Lock Private Atlas"
          >
            <Lock className="w-3 h-3 text-amber-500" />
            <span>Lock</span>
          </button>
        </div>
      </nav>

      {/* MAPS HERO COMMAND BANNER */}
      <section className="relative rounded-3xl border border-teal-500/30 bg-surface/80 overflow-hidden shadow-soft p-6 sm:p-8 backdrop-blur-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-teal-500/10 border border-teal-500/20 text-[10px] font-mono text-teal-400 uppercase tracking-widest">
              <Navigation className="w-3 h-3 text-teal-400" />
              <span>Offline Route Legs & Navigation Deck</span>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl text-foreground font-normal tracking-tight">
              Route Legs & Offline Maps
            </h1>
            <p className="font-body text-xs text-muted-foreground max-w-xl leading-relaxed">
              Curated road legs, driving durations, mountain pass crossings, and 1-tap offline navigation for{" "}
              <span className="text-foreground font-medium">{trip.destination}</span>.
            </p>
          </div>

          <button
            onClick={handleOpenAddSegment}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs font-sans transition-all shadow-md active:scale-95 cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add Route Leg</span>
          </button>
        </div>

        {/* METRICS GRID */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-muted/50">
          <div className="p-3.5 rounded-2xl bg-background/80 border border-muted/60">
            <span className="text-[10px] font-mono uppercase text-muted-foreground tracking-wider block">
              Total Route Distance
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xl font-bold font-mono text-teal-400">
                {stats.totalRouteKm > 0 ? `${stats.totalRouteKm} km` : "—"}
              </span>
            </div>
            <span className="text-[10px] text-muted-foreground block mt-0.5">
              {stats.segmentsCount} road legs
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-background/80 border border-muted/60">
            <span className="text-[10px] font-mono uppercase text-muted-foreground tracking-wider block">
              Est. Driving Time
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xl font-bold font-mono text-cyan-400">
                {stats.totalEstHours > 0 ? `~${stats.totalEstHours} hrs` : "—"}
              </span>
            </div>
            <span className="text-[10px] text-muted-foreground block mt-0.5">
              Cumulative travel time
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-background/80 border border-muted/60">
            <span className="text-[10px] font-mono uppercase text-muted-foreground tracking-wider block">
              Mountain Passes
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xl font-bold font-mono text-purple-400">
                {routeSegments.filter((s) => s.passNames && s.passNames.length > 0).length}
              </span>
              <span className="text-xs font-mono text-muted-foreground">legs</span>
            </div>
            <span className="text-[10px] text-muted-foreground block mt-0.5">
              High altitude summits
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-background/80 border border-muted/60">
            <span className="text-[10px] font-mono uppercase text-muted-foreground tracking-wider block">
              Challenging Terrain
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xl font-bold font-mono text-amber-400">
                {routeSegments.filter((s) => s.roadCondition === "WATER_CROSSING" || s.roadCondition === "EXTREME" || s.roadCondition === "GRAVEL_UNPAVED").length}
              </span>
              <span className="text-xs font-mono text-muted-foreground">legs</span>
            </div>
            <span className="text-[10px] text-muted-foreground block mt-0.5">
              Gravel / River crossings
            </span>
          </div>
        </div>
      </section>

      {/* SEARCH BAR */}
      <section className="flex items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search route legs, destinations, pass names, or advisories..."
            className="w-full pl-10 pr-9 py-2.5 rounded-2xl bg-surface border border-muted focus:border-teal-500 focus:outline-hidden text-xs text-foreground placeholder:text-muted-foreground/60 shadow-xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </section>

      {/* ROUTE SEGMENTS LIST */}
      <section className="space-y-3">
        {filteredSegments.length === 0 ? (
          <div className="p-12 text-center rounded-3xl border border-muted bg-surface/50 space-y-3">
            <Car className="w-8 h-8 text-muted-foreground mx-auto opacity-50" />
            <h4 className="font-display text-base text-foreground font-normal">
              No Route Legs Recorded
            </h4>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Define your travel legs between cities and checkpoints with distance, road conditions, and GPS directions.
            </p>
            <button
              onClick={handleOpenAddSegment}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-medium text-xs font-sans transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add First Route Leg</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3.5">
            {filteredSegments.map((seg, idx) => {
              const navUrl = getRouteNavigationUrl(seg.fromStop, seg.toStop);

              return (
                <div
                  key={seg.id}
                  className="rounded-3xl border border-muted hover:border-teal-500/40 bg-surface shadow-soft p-5 sm:p-6 space-y-4 transition-all"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-teal-500/15 border border-teal-500/30 text-teal-400 font-mono text-xs font-bold flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>

                        <h4 className="font-display text-base sm:text-lg font-normal text-foreground">
                          {seg.fromStop} <span className="text-teal-400 mx-1.5">→</span> {seg.toStop}
                        </h4>

                        {getRoadConditionBadge(seg.roadCondition)}

                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono text-muted-foreground bg-background border border-muted">
                          {seg.terrainType.replace(/_/g, " ")}
                        </span>
                      </div>

                      {/* Distance & Time Row */}
                      <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-muted-foreground">
                        <span className="flex items-center gap-1 text-foreground font-semibold">
                          <TrendingUp className="w-3.5 h-3.5 text-teal-400" />
                          <span>{seg.distanceKm} km</span>
                        </span>

                        <span>•</span>

                        <span className="flex items-center gap-1 text-foreground font-semibold">
                          <Clock className="w-3.5 h-3.5 text-cyan-400" />
                          <span>~{seg.estimatedHours} hrs</span>
                        </span>

                        {seg.highestElevationMeters ? (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1 text-purple-400 font-semibold">
                              <Mountain className="w-3.5 h-3.5" />
                              <span>{seg.highestElevationMeters.toLocaleString()} m</span>
                            </span>
                          </>
                        ) : null}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                      <a
                        href={navUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-500/15 hover:bg-teal-500/25 border border-teal-500/30 text-teal-300 text-xs font-sans font-medium transition-colors"
                        title="Open navigation in Google Maps"
                      >
                        <Navigation className="w-3.5 h-3.5 text-teal-400" />
                        <span>Navigate</span>
                        <ExternalLink className="w-3 h-3 opacity-60" />
                      </a>

                      <button
                        onClick={() => handleOpenEditSegment(seg)}
                        className="p-1.5 rounded-xl bg-background border border-muted hover:border-foreground/30 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                        title="Edit Route Leg"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => setDeleteCandidate(seg)}
                        className="p-1.5 rounded-xl bg-background border border-muted hover:border-rose-400 text-muted-foreground hover:text-rose-400 transition-colors cursor-pointer"
                        title="Delete Route Leg"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Passes & Advisories */}
                  {(seg.passNames && seg.passNames.length > 0 || seg.advisoryNotes) && (
                    <div className="pt-3 border-t border-muted/50 space-y-2">
                      {seg.passNames && seg.passNames.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mr-1">
                            Passes Crossed:
                          </span>
                          {seg.passNames.map((p, pIdx) => (
                            <span
                              key={pIdx}
                              className="px-2 py-0.5 rounded-md bg-purple-500/10 border border-purple-500/25 text-[11px] font-mono text-purple-300"
                            >
                              {p}
                            </span>
                          ))}
                        </div>
                      )}

                      {seg.advisoryNotes && (
                        <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-xs flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                          <p className="leading-relaxed">{seg.advisoryNotes}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* MODAL: ADD / EDIT ROUTE SEGMENT */}
      {showSegmentModal && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setShowSegmentModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in overscroll-contain"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-w-lg w-full p-6 rounded-3xl border border-muted bg-surface shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-muted pb-3">
              <h3 className="font-display text-lg text-foreground font-normal">
                {editingSegment ? "Edit Route Leg" : "Add Route Leg"}
              </h3>
              <button
                type="button"
                onClick={() => setShowSegmentModal(false)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitSegment} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-sans font-medium text-foreground">
                    From Origin *
                  </label>
                  <input
                    type="text"
                    required
                    value={segFrom}
                    onChange={(e) => setSegFrom(e.target.value)}
                    placeholder="e.g. Manali or Kaza"
                    className="w-full px-3.5 py-2 rounded-xl bg-background border border-muted focus:border-teal-500 focus:outline-hidden text-xs text-foreground"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-sans font-medium text-foreground">
                    To Destination *
                  </label>
                  <input
                    type="text"
                    required
                    value={segTo}
                    onChange={(e) => setSegTo(e.target.value)}
                    placeholder="e.g. Jispa or Tabo"
                    className="w-full px-3.5 py-2 rounded-xl bg-background border border-muted focus:border-teal-500 focus:outline-hidden text-xs text-foreground"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-sans font-medium text-foreground">
                    Distance (km) *
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={segDistance}
                    onChange={(e) => setSegDistance(parseFloat(e.target.value) || 0)}
                    className="w-full px-3.5 py-2 rounded-xl bg-background border border-muted focus:border-teal-500 focus:outline-hidden text-xs font-mono text-foreground"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-sans font-medium text-foreground">
                    Estimated Time (Hours) *
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min={0.5}
                    required
                    value={segHours}
                    onChange={(e) => setSegHours(parseFloat(e.target.value) || 0)}
                    className="w-full px-3.5 py-2 rounded-xl bg-background border border-muted focus:border-teal-500 focus:outline-hidden text-xs font-mono text-foreground"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-sans font-medium text-foreground">
                    Road Condition
                  </label>
                  <Select
                    value={segCondition}
                    onChange={(e) => setSegCondition(e.target.value as RouteSegment["roadCondition"])}
                  >
                    <option value="EXCELLENT">Excellent Tarmac</option>
                    <option value="PAVED_GOOD">Paved Good</option>
                    <option value="POTHOLES">Potholes & Broken Asphalt</option>
                    <option value="GRAVEL_UNPAVED">Loose Gravel / Dirt Road</option>
                    <option value="WATER_CROSSING">Water / Nallah Crossings</option>
                    <option value="EXTREME">Extreme Off-Road</option>
                  </Select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-sans font-medium text-foreground">
                    Terrain Profile
                  </label>
                  <Select
                    value={segTerrain}
                    onChange={(e) => setSegTerrain(e.target.value as RouteSegment["terrainType"])}
                  >
                    <option value="MOUNTAIN_TWISTIES">Mountain Twisties / Ghats</option>
                    <option value="HIGH_ALTITUDE_PASS">High Altitude Pass</option>
                    <option value="OFFROAD_GRAVEL">Offroad Gravel / Boulders</option>
                    <option value="RIVER_VALLEY">River Valley Highway</option>
                    <option value="FOREST_SINGLE_LANE">Forest Single Lane</option>
                    <option value="EXPRESSWAY">National Expressway</option>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-sans font-medium text-foreground">
                    Mountain Passes Crossed
                  </label>
                  <input
                    type="text"
                    value={segPasses}
                    onChange={(e) => setSegPasses(e.target.value)}
                    placeholder="e.g. Rohtang Pass, Kunzum La"
                    className="w-full px-3.5 py-2 rounded-xl bg-background border border-muted focus:border-teal-500 focus:outline-hidden text-xs text-foreground"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-sans font-medium text-foreground">
                    Highest Altitude Peak (m)
                  </label>
                  <input
                    type="number"
                    value={segElevation}
                    onChange={(e) => setSegElevation(e.target.value)}
                    placeholder="e.g. 4551"
                    className="w-full px-3.5 py-2 rounded-xl bg-background border border-muted focus:border-teal-500 focus:outline-hidden text-xs font-mono text-foreground"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-sans font-medium text-foreground">
                  Terrain Advisory & Road Warning
                </label>
                <textarea
                  rows={2}
                  value={segAdvisory}
                  onChange={(e) => setSegAdvisory(e.target.value)}
                  placeholder="e.g. Cross Pagal Nallah before 11 AM before snowmelt increases water flow. Fill fuel at Tandi."
                  className="w-full px-3.5 py-2 rounded-xl bg-background border border-muted focus:border-teal-500 focus:outline-hidden text-xs text-foreground resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-muted">
                <button
                  type="button"
                  onClick={() => setShowSegmentModal(false)}
                  className="px-4 py-2 rounded-xl border border-muted text-xs font-sans text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-medium text-xs font-sans transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {isSubmitting ? "Saving..." : editingSegment ? "Save Changes" : "Create Route Leg"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteCandidate && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setDeleteCandidate(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-w-sm w-full p-6 rounded-3xl border border-muted bg-surface shadow-2xl space-y-4"
          >
            <div className="space-y-1">
              <h3 className="font-display text-lg text-foreground font-normal">
                Delete Route Leg?
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Are you sure you want to remove the leg &ldquo;{deleteCandidate.fromStop} → {deleteCandidate.toStop}&rdquo;?
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-muted">
              <button
                type="button"
                onClick={() => setDeleteCandidate(null)}
                className="px-3.5 py-2 rounded-xl border border-muted text-xs font-sans text-muted-foreground hover:text-foreground cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteSegment}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-sans font-medium transition-colors cursor-pointer"
              >
                Delete Leg
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
