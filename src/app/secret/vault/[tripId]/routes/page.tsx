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
  MapPin,
  Mountain,
  Fuel,
  Wrench,
  Camera,
  HeartPulse,
  ShieldAlert,
  AlertTriangle,
  ExternalLink,
  Navigation,
  Lock,
  Sparkles,
  Search,
  X,
  Copy,
  Check,
  TrendingUp,
  Clock,
  Car,
  Home,
  Utensils,
} from "lucide-react";
import { getTrip } from "@/lib/vault/storage";
import { useRoutesAndWaypoints } from "@/lib/vault/useRoutesAndWaypoints";
import {
  TripRecord,
  WaypointRecord,
  WaypointCategory,
  RouteSegment,
} from "@/lib/vault/types";
import { revokeSecretAccess } from "@/lib/deviceAuth";

type ViewTab = "ALL" | "WAYPOINTS" | "SEGMENTS";
type WaypointCategoryFilter = "ALL" | WaypointCategory;

export default function TripRoutesPage() {
  const params = useParams();
  const router = useRouter();
  const tripId = params.tripId as string;

  const [trip, setTrip] = useState<TripRecord | null>(null);
  const [isTripLoading, setIsTripLoading] = useState(true);

  const {
    waypoints,
    routeSegments,
    stats,
    isLoading: isRoutesLoading,
    addWaypoint,
    updateWaypoint,
    removeWaypoint,
    addRouteSegment,
    updateRouteSegment,
    removeRouteSegment,
    seedMountainPresets,
    getNavigationUrl,
  } = useRoutesAndWaypoints(tripId);

  // Tabs & Filters
  const [activeTab, setActiveTab] = useState<ViewTab>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<WaypointCategoryFilter>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedCoordsId, setCopiedCoordsId] = useState<string | null>(null);
  const [seedingNotice, setSeedingNotice] = useState<string | null>(null);

  // Modals
  const [showWaypointModal, setShowWaypointModal] = useState(false);
  const [editingWaypoint, setEditingWaypoint] = useState<WaypointRecord | null>(null);
  const [showSegmentModal, setShowSegmentModal] = useState(false);
  const [editingSegment, setEditingSegment] = useState<RouteSegment | null>(null);

  // Waypoint Form State
  const [wpTitle, setWpTitle] = useState("");
  const [wpCategory, setWpCategory] = useState<WaypointCategory>("PASS");
  const [wpLat, setWpLat] = useState<string>("");
  const [wpLng, setWpLng] = useState<string>("");
  const [wpElevation, setWpElevation] = useState<string>("");
  const [wpNotes, setWpNotes] = useState("");

  // Route Segment Form State
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
    router.push("/");
  };

  // Open Waypoint Modal
  const handleOpenAddWaypoint = () => {
    setEditingWaypoint(null);
    setWpTitle("");
    setWpCategory("PASS");
    setWpLat(trip?.destination.toLowerCase().includes("ladakh") ? "34.2787" : "32.2432");
    setWpLng(trip?.destination.toLowerCase().includes("ladakh") ? "77.6047" : "77.1892");
    setWpElevation("3500");
    setWpNotes("");
    setShowWaypointModal(true);
  };

  const handleOpenEditWaypoint = (wp: WaypointRecord) => {
    setEditingWaypoint(wp);
    setWpTitle(wp.title);
    setWpCategory(wp.category);
    setWpLat(String(wp.latitude));
    setWpLng(String(wp.longitude));
    setWpElevation(wp.elevationMeters !== undefined ? String(wp.elevationMeters) : "");
    setWpNotes(wp.notes || "");
    setShowWaypointModal(true);
  };

  // Open Segment Modal
  const handleOpenAddSegment = () => {
    setEditingSegment(null);
    setSegFrom("");
    setSegTo("");
    setSegDistance(120);
    setSegHours(4);
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
    setSegElevation(seg.highestElevationMeters !== undefined ? String(seg.highestElevationMeters) : "");
    setSegPasses(seg.passNames ? seg.passNames.join(", ") : "");
    setSegAdvisory(seg.advisoryNotes || "");
    setShowSegmentModal(true);
  };

  // Handle Save Waypoint
  const handleSubmitWaypoint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wpTitle.trim() || !wpLat.trim() || !wpLng.trim()) return;

    setIsSubmitting(true);
    try {
      const lat = parseFloat(wpLat);
      const lng = parseFloat(wpLng);
      const elev = wpElevation.trim() ? parseFloat(wpElevation) : undefined;

      if (editingWaypoint) {
        await updateWaypoint({
          ...editingWaypoint,
          title: wpTitle.trim(),
          category: wpCategory,
          latitude: lat,
          longitude: lng,
          elevationMeters: elev,
          notes: wpNotes.trim() || undefined,
        });
      } else {
        await addWaypoint({
          title: wpTitle.trim(),
          category: wpCategory,
          latitude: lat,
          longitude: lng,
          elevationMeters: elev,
          notes: wpNotes.trim() || undefined,
        });
      }
      setShowWaypointModal(false);
      setEditingWaypoint(null);
    } catch (err) {
      console.error("Failed saving waypoint:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Save Route Segment
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

  // Copy GPS Coordinates
  const handleCopyCoords = (wp: WaypointRecord) => {
    const text = `${wp.latitude.toFixed(5)}, ${wp.longitude.toFixed(5)}`;
    navigator.clipboard.writeText(text);
    setCopiedCoordsId(wp.id);
    setTimeout(() => setCopiedCoordsId(null), 2000);
  };

  // Handle Seed Presets
  const handleSeedPresets = async () => {
    try {
      const result = await seedMountainPresets();
      if (result.waypointsCount > 0 || result.segmentsCount > 0) {
        setSeedingNotice(
          `Added ${result.waypointsCount} mountain passes & ${result.segmentsCount} route legs to your navigation deck!`
        );
      } else {
        setSeedingNotice("All curated mountain passes and route segments are already in your dossier.");
      }
      setTimeout(() => setSeedingNotice(null), 3500);
    } catch (err) {
      console.error("Failed seeding mountain presets:", err);
    }
  };

  // Filtered waypoints
  const filteredWaypoints = useMemo(() => {
    return waypoints.filter((wp) => {
      if (categoryFilter !== "ALL" && wp.category !== categoryFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = wp.title.toLowerCase().includes(q);
        const matchesNotes = wp.notes?.toLowerCase().includes(q);
        const matchesCategory = wp.category.toLowerCase().includes(q);
        if (!matchesTitle && !matchesNotes && !matchesCategory) return false;
      }
      return true;
    });
  }, [waypoints, categoryFilter, searchQuery]);

  // Category Icon & Styling Helper
  const getCategoryDetails = (cat: WaypointCategory) => {
    switch (cat) {
      case "PASS":
        return { label: "Mountain Pass", icon: <Mountain className="w-3.5 h-3.5 text-cyan-400" />, badge: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30" };
      case "FUEL_PUMP":
        return { label: "Fuel Station", icon: <Fuel className="w-3.5 h-3.5 text-amber-400" />, badge: "bg-amber-500/10 text-amber-400 border-amber-500/30" };
      case "MECHANIC":
        return { label: "Mechanic / Workshop", icon: <Wrench className="w-3.5 h-3.5 text-orange-400" />, badge: "bg-orange-500/10 text-orange-400 border-orange-500/30" };
      case "VIEWPOINT":
        return { label: "Scenic Viewpoint", icon: <Camera className="w-3.5 h-3.5 text-emerald-400" />, badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" };
      case "MEDICAL":
        return { label: "Medical Aid / SOS", icon: <HeartPulse className="w-3.5 h-3.5 text-rose-400" />, badge: "bg-rose-500/10 text-rose-400 border-rose-500/30" };
      case "CHECKPOST":
        return { label: "Permit Checkpost", icon: <ShieldAlert className="w-3.5 h-3.5 text-indigo-400" />, badge: "bg-indigo-500/10 text-indigo-400 border-indigo-500/30" };
      case "HAZARD":
        return { label: "Hazard / Water Crossing", icon: <AlertTriangle className="w-3.5 h-3.5 text-yellow-400" />, badge: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30" };
      case "STAY":
        return { label: "Stay / Camp", icon: <Home className="w-3.5 h-3.5 text-teal-400" />, badge: "bg-teal-500/10 text-teal-400 border-teal-500/30" };
      case "FOOD":
        return { label: "Dhaba / Food", icon: <Utensils className="w-3.5 h-3.5 text-orange-400" />, badge: "bg-orange-500/10 text-orange-400 border-orange-500/30" };
      default:
        return { label: "Waypoint", icon: <MapPin className="w-3.5 h-3.5 text-teal-400" />, badge: "bg-teal-500/10 text-teal-400 border-teal-500/30" };
    }
  };

  // Road condition badge
  const getRoadConditionBadge = (cond: RouteSegment["roadCondition"]) => {
    switch (cond) {
      case "EXCELLENT":
        return <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase font-semibold bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">Excellent Tarmac</span>;
      case "PAVED_GOOD":
        return <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase font-semibold bg-teal-500/15 border border-teal-500/30 text-teal-400">Paved Good</span>;
      case "POTHOLES":
        return <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase font-semibold bg-amber-500/15 border border-amber-500/30 text-amber-400">Potholes & Broken</span>;
      case "GRAVEL_UNPAVED":
        return <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase font-semibold bg-orange-500/15 border border-orange-500/30 text-orange-400">Loose Gravel / Dirt</span>;
      case "WATER_CROSSING":
        return <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase font-semibold bg-blue-500/15 border border-blue-500/30 text-blue-400">Water Crossings</span>;
      case "EXTREME":
        return <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase font-semibold bg-rose-500/15 border border-rose-500/30 text-rose-400">Extreme Off-Road</span>;
    }
  };

  if (isTripLoading || isRoutesLoading) {
    return (
      <div className="max-w-4xl mx-auto py-24 text-center text-xs font-mono text-muted-foreground flex items-center justify-center gap-2">
        <div className="w-4 h-4 rounded-full border border-muted border-t-teal-500 animate-spin" />
        <span>Loading offline maps & route waypoints...</span>
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
            <span>Pillar 07 • Maps</span>
          </div>

          <button
            onClick={handleLockVault}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-muted hover:border-foreground/30 text-[11px] font-sans text-muted-foreground hover:text-foreground transition-colors"
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
              <span>Offline Navigation & Waypoint Directory</span>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl text-foreground font-normal tracking-tight">
              Maps, Routes & Offline Waypoints
            </h1>
            <p className="font-body text-xs text-muted-foreground max-w-xl leading-relaxed">
              GPS coordinates, high-altitude mountain passes, critical fuel stations, road condition warnings, and 1-tap native Android navigation in{" "}
              <span className="text-foreground font-medium">{trip.destination}</span>.
            </p>
          </div>

          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 shrink-0">
            <button
              onClick={handleOpenAddWaypoint}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-500 hover:bg-teal-600 text-black font-semibold text-xs font-sans transition-all shadow-md active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Add Waypoint</span>
            </button>

            <button
              onClick={handleOpenAddSegment}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-surface border border-muted hover:border-teal-500/40 text-xs font-sans text-foreground transition-colors shadow-xs"
            >
              <Plus className="w-3.5 h-3.5 text-teal-400" />
              <span>Add Route Leg</span>
            </button>

            <button
              onClick={handleSeedPresets}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-surface border border-muted hover:border-teal-500/40 text-xs font-sans text-foreground transition-colors shadow-xs"
              title="Load legendary Himalayan passes & fuel stations"
            >
              <Sparkles className="w-3.5 h-3.5 text-teal-400" />
              <span>Seed Passes</span>
            </button>
          </div>
        </div>

        {/* Seeding Toast Notice */}
        {seedingNotice && (
          <div className="mt-4 p-3 rounded-xl bg-teal-500/10 border border-teal-500/30 text-xs font-sans text-teal-300 flex items-center gap-2 animate-fade-in">
            <Sparkles className="w-4 h-4 text-teal-400 shrink-0" />
            <span>{seedingNotice}</span>
          </div>
        )}

        {/* NAVIGATION STATS METRICS RIBBON */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-muted/60">
          {/* Metric 1: Saved Waypoints */}
          <div className="p-3.5 rounded-2xl bg-background/80 border border-muted/60">
            <span className="text-[10px] font-mono uppercase text-muted-foreground tracking-wider block">
              Saved Waypoints
            </span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-bold font-mono text-teal-400">
                {stats.totalWaypoints}
              </span>
              <span className="text-xs font-mono text-muted-foreground">
                POIs
              </span>
            </div>
            <span className="text-[10px] text-muted-foreground block mt-0.5">
              {stats.fuelPumpsCount} fuel stops • {stats.hazardsCount} hazards
            </span>
          </div>

          {/* Metric 2: Mountain Passes */}
          <div className="p-3.5 rounded-2xl bg-background/80 border border-muted/60">
            <span className="text-[10px] font-mono uppercase text-muted-foreground tracking-wider block">
              High Passes
            </span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-bold font-mono text-cyan-400">
                {stats.passesCount}
              </span>
              <span className="text-xs font-mono text-muted-foreground">
                mountain passes
              </span>
            </div>
            <span className="text-[10px] text-muted-foreground block mt-0.5">
              Altitude summits
            </span>
          </div>

          {/* Metric 3: Highest Elevation */}
          <div className="p-3.5 rounded-2xl bg-background/80 border border-muted/60">
            <span className="text-[10px] font-mono uppercase text-muted-foreground tracking-wider block">
              Max Altitude Peak
            </span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-bold font-mono text-emerald-400">
                {stats.maxElevation > 0 ? `${stats.maxElevation.toLocaleString()} m` : "—"}
              </span>
              {stats.maxElevation > 0 && (
                <span className="text-[10px] font-mono text-muted-foreground">
                  ({Math.round(stats.maxElevation * 3.28084).toLocaleString()} ft)
                </span>
              )}
            </div>
            <span className="text-[10px] text-muted-foreground block mt-0.5">
              Peak altitude reached
            </span>
          </div>

          {/* Metric 4: Total Route Distance */}
          <div className="p-3.5 rounded-2xl bg-background/80 border border-muted/60">
            <span className="text-[10px] font-mono uppercase text-muted-foreground tracking-wider block">
              Route Distance
            </span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-bold font-mono text-foreground">
                {stats.totalRouteKm > 0 ? `${stats.totalRouteKm} km` : "—"}
              </span>
              {stats.totalEstHours > 0 && (
                <span className="text-[10px] font-mono text-muted-foreground">
                  (~{stats.totalEstHours} hrs)
                </span>
              )}
            </div>
            <span className="text-[10px] text-muted-foreground block mt-0.5">
              {stats.segmentsCount} road legs sequenced
            </span>
          </div>
        </div>
      </section>

      {/* VIEW TABS & FILTERS */}
      <section className="space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Segmented View Tabs */}
          <div className="flex items-center p-1 rounded-2xl bg-surface border border-muted text-xs font-sans">
            <button
              onClick={() => setActiveTab("ALL")}
              className={`px-3 py-1.5 rounded-xl transition-all ${
                activeTab === "ALL"
                  ? "bg-teal-500 text-black font-semibold shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              All Navigation ({waypoints.length + routeSegments.length})
            </button>
            <button
              onClick={() => setActiveTab("WAYPOINTS")}
              className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 ${
                activeTab === "WAYPOINTS"
                  ? "bg-teal-500 text-black font-semibold shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>Waypoints & POIs ({waypoints.length})</span>
            </button>
            <button
              onClick={() => setActiveTab("SEGMENTS")}
              className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 ${
                activeTab === "SEGMENTS"
                  ? "bg-teal-500 text-black font-semibold shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Car className="w-3.5 h-3.5" />
              <span>Route Legs ({routeSegments.length})</span>
            </button>
          </div>

          {/* Search Input */}
          <div className="relative min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search passes, fuel, coordinates..."
              className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-surface border border-muted focus:border-teal-500 focus:outline-hidden text-xs text-foreground placeholder:text-muted-foreground/60"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Waypoint Category Filter Pills (Visible when ALL or WAYPOINTS active) */}
        {activeTab !== "SEGMENTS" && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px] font-sans">
            {(
              [
                "ALL",
                "PASS",
                "FUEL_PUMP",
                "MECHANIC",
                "VIEWPOINT",
                "MEDICAL",
                "CHECKPOST",
                "HAZARD",
              ] as WaypointCategoryFilter[]
            ).map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-2.5 py-1 rounded-xl border transition-colors ${
                  categoryFilter === cat
                    ? "bg-teal-500/20 border-teal-500/40 text-teal-300 font-semibold"
                    : "bg-surface/60 border-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {cat === "ALL"
                  ? "All POIs"
                  : cat === "PASS"
                  ? "Mountain Passes"
                  : cat === "FUEL_PUMP"
                  ? "Fuel Pumps"
                  : cat === "MECHANIC"
                  ? "Mechanics"
                  : cat === "VIEWPOINT"
                  ? "Viewpoints"
                  : cat === "MEDICAL"
                  ? "Medical SOS"
                  : cat === "CHECKPOST"
                  ? "Checkposts"
                  : "Hazards"}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* ROUTE SEGMENTS SECTION (REQ-MAP-02) */}
      {(activeTab === "ALL" || activeTab === "SEGMENTS") && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg text-foreground font-normal tracking-tight flex items-center gap-2">
              <Car className="w-4 h-4 text-teal-400" />
              <span>Route Segments & Terrain Advisories</span>
            </h3>
            <span className="text-xs font-mono text-muted-foreground">
              {routeSegments.length} legs sequenced
            </span>
          </div>

          {routeSegments.length === 0 ? (
            <div className="p-8 text-center rounded-2xl border border-muted bg-surface/30 space-y-2">
              <p className="text-xs font-sans text-muted-foreground">
                No route legs defined. Tap &ldquo;Add Route Leg&rdquo; or &ldquo;Seed Passes&rdquo; to structure road legs with driving hours and terrain warnings.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {routeSegments.map((seg, idx) => (
                <div
                  key={seg.id}
                  className="rounded-2xl border border-muted hover:border-teal-500/40 bg-surface shadow-soft p-5 space-y-3.5 transition-all"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-teal-500/15 border border-teal-500/30 text-teal-400 font-mono text-xs font-bold flex items-center justify-center">
                          {idx + 1}
                        </span>

                        <h4 className="font-display text-base sm:text-lg font-normal text-foreground">
                          {seg.fromStop} <span className="text-teal-400 mx-1">→</span> {seg.toStop}
                        </h4>

                        {getRoadConditionBadge(seg.roadCondition)}

                        <span className="px-2 py-0.5 rounded text-[10px] font-mono text-muted-foreground bg-background border border-muted">
                          {seg.terrainType.replace(/_/g, " ")}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-muted-foreground pl-8">
                        <span className="flex items-center gap-1 text-foreground font-semibold">
                          <TrendingUp className="w-3.5 h-3.5 text-teal-400" />
                          <span>{seg.distanceKm} km</span>
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-amber-400" />
                          <span>~{seg.estimatedHours} hrs drive</span>
                        </span>
                        {seg.highestElevationMeters && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1 text-cyan-400 font-semibold">
                              <Mountain className="w-3.5 h-3.5" />
                              <span>{seg.highestElevationMeters.toLocaleString()} m</span>
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* 1-Tap Navigation for Route Segment */}
                    <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(
                          seg.fromStop
                        )}&destination=${encodeURIComponent(seg.toStop)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-500 hover:bg-teal-600 text-black text-xs font-semibold font-sans transition-all shadow-xs"
                        title="Start Google Maps Route Navigation"
                      >
                        <Navigation className="w-3.5 h-3.5" />
                        <span>Navigate Leg</span>
                        <ExternalLink className="w-2.5 h-2.5 opacity-70" />
                      </a>

                      <button
                        onClick={() => handleOpenEditSegment(seg)}
                        className="p-1.5 rounded-lg border border-muted hover:border-foreground/30 text-muted-foreground hover:text-foreground transition-colors"
                        title="Edit Leg"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => removeRouteSegment(seg.id)}
                        className="p-1.5 rounded-lg border border-muted hover:border-rose-500/40 text-muted-foreground hover:text-rose-400 transition-colors"
                        title="Delete Leg"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Mountain Passes Crossed on this leg */}
                  {seg.passNames && seg.passNames.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pl-8">
                      <span className="text-[10px] font-mono uppercase text-muted-foreground">
                        Passes on this leg:
                      </span>
                      {seg.passNames.map((pass, pIdx) => (
                        <span
                          key={pIdx}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-[11px] font-sans"
                        >
                          <Mountain className="w-2.5 h-2.5 text-cyan-400" />
                          <span>{pass}</span>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Advisory note */}
                  {seg.advisoryNotes && (
                    <div className="p-3 rounded-xl bg-background/70 border border-muted text-xs font-sans text-muted-foreground flex items-start gap-2 ml-8">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                      <p className="leading-relaxed text-foreground/90">{seg.advisoryNotes}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* WAYPOINTS DIRECTORY SECTION (REQ-MAP-01 & REQ-MAP-03) */}
      {(activeTab === "ALL" || activeTab === "WAYPOINTS") && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg text-foreground font-normal tracking-tight flex items-center gap-2">
              <MapPin className="w-4 h-4 text-teal-400" />
              <span>Waypoints & High-Altitude Directory</span>
            </h3>
            <span className="text-xs font-mono text-muted-foreground">
              {filteredWaypoints.length} waypoints matching
            </span>
          </div>

          {filteredWaypoints.length === 0 ? (
            <div className="p-10 text-center rounded-2xl border border-muted bg-surface/40 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-400 flex items-center justify-center mx-auto">
                <MapPin className="w-5 h-5" />
              </div>
              <h4 className="font-display text-base text-foreground font-normal">
                No Waypoints Match Filter
              </h4>
              <p className="font-body text-xs text-muted-foreground max-w-sm mx-auto">
                Add mountain passes, mechanics, fuel pumps, and emergency medical stations, or seed Himalayan waypoints.
              </p>
              <button
                onClick={handleOpenAddWaypoint}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-teal-500 text-black text-xs font-semibold"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Waypoint</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredWaypoints.map((wp) => {
                const cat = getCategoryDetails(wp.category);
                const isCopied = copiedCoordsId === wp.id;

                return (
                  <div
                    key={wp.id}
                    className="rounded-2xl border border-muted hover:border-teal-500/40 bg-surface shadow-soft p-4 space-y-3 transition-all flex flex-col justify-between"
                  >
                    <div className="space-y-2">
                      {/* Top row: Category Badge & Elevation */}
                      <div className="flex items-center justify-between gap-2">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-sans border ${cat.badge}`}>
                          {cat.icon}
                          <span>{cat.label}</span>
                        </span>

                        {wp.elevationMeters && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-mono font-semibold text-cyan-400 bg-background px-2 py-0.5 rounded-md border border-muted">
                            <Mountain className="w-3 h-3" />
                            <span>{wp.elevationMeters.toLocaleString()} m</span>
                          </span>
                        )}
                      </div>

                      {/* Title */}
                      <h4 className="font-display text-base font-normal text-foreground tracking-tight">
                        {wp.title}
                      </h4>

                      {/* Notes / Advisory */}
                      {wp.notes && (
                        <p className="font-body text-xs text-muted-foreground leading-relaxed line-clamp-2">
                          {wp.notes}
                        </p>
                      )}

                      {/* GPS Coordinates & Copy */}
                      <div className="flex items-center justify-between pt-1 text-[11px] font-mono text-muted-foreground bg-background/60 p-2 rounded-xl border border-muted/60">
                        <span className="truncate">
                          {wp.latitude.toFixed(5)}°, {wp.longitude.toFixed(5)}°
                        </span>

                        <button
                          onClick={() => handleCopyCoords(wp)}
                          className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors ml-2 shrink-0"
                          title="Copy GPS Coordinates"
                        >
                          {isCopied ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                          <span>{isCopied ? "Copied" : "Copy"}</span>
                        </button>
                      </div>
                    </div>

                    {/* Bottom Actions: 1-Tap Navigation Intent (REQ-MAP-03) */}
                    <div className="flex items-center justify-between gap-2 pt-3 border-t border-muted/50 mt-2">
                      <div className="flex items-center gap-2">
                        {/* Native Android geo: or Google Maps link */}
                        <a
                          href={getNavigationUrl(wp.latitude, wp.longitude, wp.title)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-500/15 hover:bg-teal-500/25 border border-teal-500/30 text-xs font-sans font-semibold text-teal-400 transition-colors"
                          title="Launch Native Google Maps / GPS Navigation"
                        >
                          <Navigation className="w-3.5 h-3.5" />
                          <span>Navigate</span>
                          <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                        </a>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenEditWaypoint(wp)}
                          className="p-1.5 rounded-lg border border-muted hover:border-foreground/30 text-muted-foreground hover:text-foreground transition-colors"
                          title="Edit Waypoint"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => removeWaypoint(wp.id)}
                          className="p-1.5 rounded-lg border border-muted hover:border-rose-500/40 text-muted-foreground hover:text-rose-400 transition-colors"
                          title="Delete Waypoint"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* ADD / EDIT WAYPOINT MODAL */}
      {showWaypointModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
        >
          <div className="max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 rounded-2xl border border-muted bg-surface shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-muted pb-3">
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-teal-400" />
                <h3 className="font-display text-xl text-foreground font-normal">
                  {editingWaypoint ? "Edit Waypoint" : "Add GPS Waypoint"}
                </h3>
              </div>
              <button
                onClick={() => setShowWaypointModal(false)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitWaypoint} className="space-y-4">
              {/* Title & Category */}
              <div className="space-y-1">
                <label className="text-xs font-sans font-medium text-foreground">Waypoint Title *</label>
                <input
                  type="text"
                  value={wpTitle}
                  onChange={(e) => setWpTitle(e.target.value)}
                  placeholder="e.g. Khardung La Pass, Tandi Fuel Pump"
                  className="w-full px-3 py-2 rounded-xl bg-background border border-muted focus:border-teal-500 focus:outline-hidden text-sm text-foreground placeholder:text-muted-foreground/50"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-sans font-medium text-foreground">Category *</label>
                  <select
                    value={wpCategory}
                    onChange={(e) => setWpCategory(e.target.value as WaypointCategory)}
                    className="w-full px-3 py-2 rounded-xl bg-background border border-muted focus:border-teal-500 focus:outline-hidden text-xs text-foreground [color-scheme:dark]"
                  >
                    <option value="PASS">Mountain Pass</option>
                    <option value="FUEL_PUMP">Fuel Station</option>
                    <option value="MECHANIC">Mechanic / Workshop</option>
                    <option value="VIEWPOINT">Scenic Viewpoint</option>
                    <option value="MEDICAL">Medical SOS / Aid</option>
                    <option value="CHECKPOST">Permit Checkpost</option>
                    <option value="HAZARD">Hazard / Water Crossing</option>
                    <option value="STAY">Camp / Homestay</option>
                    <option value="FOOD">Dhaba / Food Stop</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-sans font-medium text-foreground">Elevation (Meters)</label>
                  <input
                    type="number"
                    value={wpElevation}
                    onChange={(e) => setWpElevation(e.target.value)}
                    placeholder="e.g. 5359"
                    className="w-full px-3 py-2 rounded-xl bg-background border border-muted focus:border-teal-500 focus:outline-hidden text-xs font-mono text-foreground placeholder:text-muted-foreground/50"
                  />
                </div>
              </div>

              {/* Coordinates */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-sans font-medium text-foreground">Latitude (Decimal) *</label>
                  <input
                    type="number"
                    step="any"
                    value={wpLat}
                    onChange={(e) => setWpLat(e.target.value)}
                    placeholder="e.g. 34.2787"
                    className="w-full px-3 py-2 rounded-xl bg-background border border-muted focus:border-teal-500 focus:outline-hidden text-xs font-mono text-foreground placeholder:text-muted-foreground/50"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-sans font-medium text-foreground">Longitude (Decimal) *</label>
                  <input
                    type="number"
                    step="any"
                    value={wpLng}
                    onChange={(e) => setWpLng(e.target.value)}
                    placeholder="e.g. 77.6047"
                    className="w-full px-3 py-2 rounded-xl bg-background border border-muted focus:border-teal-500 focus:outline-hidden text-xs font-mono text-foreground placeholder:text-muted-foreground/50"
                    required
                  />
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <label className="text-xs font-sans font-medium text-foreground">
                  Advisory Notes & Key Details
                </label>
                <textarea
                  value={wpNotes}
                  onChange={(e) => setWpNotes(e.target.value)}
                  rows={2}
                  placeholder="e.g. Limit stay to 15 mins to avoid acute mountain sickness. Carry warm windproof gloves."
                  className="w-full px-3 py-2 rounded-xl bg-background border border-muted focus:border-teal-500 focus:outline-hidden text-xs text-foreground placeholder:text-muted-foreground/50 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-muted">
                <button
                  type="button"
                  onClick={() => setShowWaypointModal(false)}
                  className="px-4 py-2 rounded-xl border border-muted hover:bg-surface-hover text-xs font-sans text-muted-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-black font-semibold text-xs font-sans transition-all"
                >
                  {isSubmitting ? "Saving..." : editingWaypoint ? "Update Waypoint" : "Save Waypoint"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD / EDIT ROUTE SEGMENT MODAL */}
      {showSegmentModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
        >
          <div className="max-w-xl w-full max-h-[90vh] overflow-y-auto p-6 rounded-2xl border border-muted bg-surface shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-muted pb-3">
              <div className="flex items-center gap-2">
                <Car className="w-5 h-5 text-teal-400" />
                <h3 className="font-display text-xl text-foreground font-normal">
                  {editingSegment ? "Edit Route Leg" : "Add Route Leg"}
                </h3>
              </div>
              <button
                onClick={() => setShowSegmentModal(false)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitSegment} className="space-y-4">
              {/* From & To */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-sans font-medium text-foreground">Origin Stop *</label>
                  <input
                    type="text"
                    value={segFrom}
                    onChange={(e) => setSegFrom(e.target.value)}
                    placeholder="e.g. Manali"
                    className="w-full px-3 py-2 rounded-xl bg-background border border-muted focus:border-teal-500 focus:outline-hidden text-xs text-foreground placeholder:text-muted-foreground/50"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-sans font-medium text-foreground">Destination Stop *</label>
                  <input
                    type="text"
                    value={segTo}
                    onChange={(e) => setSegTo(e.target.value)}
                    placeholder="e.g. Jispa"
                    className="w-full px-3 py-2 rounded-xl bg-background border border-muted focus:border-teal-500 focus:outline-hidden text-xs text-foreground placeholder:text-muted-foreground/50"
                    required
                  />
                </div>
              </div>

              {/* Distance & Hours */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-sans font-medium text-foreground">Distance (km) *</label>
                  <input
                    type="number"
                    value={segDistance}
                    onChange={(e) => setSegDistance(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-background border border-muted focus:border-teal-500 focus:outline-hidden text-xs font-mono text-foreground"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-sans font-medium text-foreground">Estimated Drive Time (Hours)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={segHours}
                    onChange={(e) => setSegHours(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-background border border-muted focus:border-teal-500 focus:outline-hidden text-xs font-mono text-foreground"
                  />
                </div>
              </div>

              {/* Terrain & Condition */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-sans font-medium text-foreground">Terrain Classification</label>
                  <select
                    value={segTerrain}
                    onChange={(e) => setSegTerrain(e.target.value as RouteSegment["terrainType"])}
                    className="w-full px-3 py-2 rounded-xl bg-background border border-muted focus:border-teal-500 focus:outline-hidden text-xs text-foreground [color-scheme:dark]"
                  >
                    <option value="MOUNTAIN_TWISTIES">Mountain Twisties / Ghats</option>
                    <option value="HIGH_ALTITUDE_PASS">High-Altitude Mountain Pass</option>
                    <option value="OFF_ROAD_TRAIL">Off-Road Trail & Dirt Track</option>
                    <option value="DESERT_HIGHWAY">Desert Highway</option>
                    <option value="COASTAL_ROAD">Coastal Road</option>
                    <option value="EXPRESSWAY">Expressway / 4-Lane</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-sans font-medium text-foreground">Road Surface Condition</label>
                  <select
                    value={segCondition}
                    onChange={(e) => setSegCondition(e.target.value as RouteSegment["roadCondition"])}
                    className="w-full px-3 py-2 rounded-xl bg-background border border-muted focus:border-teal-500 focus:outline-hidden text-xs text-foreground [color-scheme:dark]"
                  >
                    <option value="EXCELLENT">Excellent Tarmac</option>
                    <option value="PAVED_GOOD">Paved Good Condition</option>
                    <option value="POTHOLES">Potholes / Broken Asphalt</option>
                    <option value="GRAVEL_UNPAVED">Loose Gravel / Unpaved</option>
                    <option value="WATER_CROSSING">Active Water Crossings</option>
                    <option value="EXTREME">Extreme Off-Road Boulder Field</option>
                  </select>
                </div>
              </div>

              {/* Highest Elevation & Mountain Passes */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-sans font-medium text-foreground">Highest Altitude Peak (m)</label>
                  <input
                    type="number"
                    value={segElevation}
                    onChange={(e) => setSegElevation(e.target.value)}
                    placeholder="e.g. 4890"
                    className="w-full px-3 py-2 rounded-xl bg-background border border-muted focus:border-teal-500 focus:outline-hidden text-xs font-mono text-foreground placeholder:text-muted-foreground/50"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-sans font-medium text-foreground">Passes Crossed (Comma Separated)</label>
                  <input
                    type="text"
                    value={segPasses}
                    onChange={(e) => setSegPasses(e.target.value)}
                    placeholder="e.g. Baralacha La, Rohtang Pass"
                    className="w-full px-3 py-2 rounded-xl bg-background border border-muted focus:border-teal-500 focus:outline-hidden text-xs text-foreground placeholder:text-muted-foreground/50"
                  />
                </div>
              </div>

              {/* Advisory notes */}
              <div className="space-y-1">
                <label className="text-xs font-sans font-medium text-foreground">Road & Safety Advisories</label>
                <textarea
                  value={segAdvisory}
                  onChange={(e) => setSegAdvisory(e.target.value)}
                  rows={2}
                  placeholder="e.g. Zero fuel stations after Tandi. Carry cash for road toll checkposts."
                  className="w-full px-3 py-2 rounded-xl bg-background border border-muted focus:border-teal-500 focus:outline-hidden text-xs text-foreground placeholder:text-muted-foreground/50 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-muted">
                <button
                  type="button"
                  onClick={() => setShowSegmentModal(false)}
                  className="px-4 py-2 rounded-xl border border-muted hover:bg-surface-hover text-xs font-sans text-muted-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-black font-semibold text-xs font-sans transition-all"
                >
                  {isSubmitting ? "Saving..." : editingSegment ? "Update Leg" : "Save Route Leg"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
