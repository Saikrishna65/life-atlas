"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Compass,
  ArrowLeft,
  Plus,
  Lock,
  Calendar,
  MapPin,
  Clock,
  Trash2,
  MoreVertical,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  ShieldCheck,
  Bike,
  Backpack,
  Car,
  Footprints,
  Sparkles,
} from "lucide-react";
import { useTripVault } from "@/lib/vault/useTripVault";
import { TripRecord, TravelStyle } from "@/lib/vault/types";
import { revokeSecretAccess } from "@/lib/deviceAuth";
import { useLockBodyScroll } from "@/lib/vault/useLockBodyScroll";
import { computeTripDuration, getTripDayCount } from "@/lib/vault/tripDuration";

type FilterTab = "ALL" | "ACTIVE" | "COMPLETED" | "DRAFT";

export default function TripVaultDashboard() {
  const router = useRouter();
  const { trips, activeTrip, isLoading, changeTripStatus, deleteTrip } = useTripVault();

  const [activeTab, setActiveTab] = useState<FilterTab>("ALL");
  const [menuOpenTripId, setMenuOpenTripId] = useState<string | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<TripRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleLockVault = () => {
    revokeSecretAccess();
    router.push("/");
  };

  const filteredTrips = useMemo(() => {
    if (activeTab === "ALL") return trips;
    if (activeTab === "ACTIVE") return trips.filter((t) => t.status === "ACTIVE" || t.status === "PLANNING");
    if (activeTab === "COMPLETED") return trips.filter((t) => t.status === "COMPLETED");
    if (activeTab === "DRAFT") return trips.filter((t) => t.status === "DRAFT" || t.status === "ARCHIVED");
    return trips;
  }, [trips, activeTab]);

  const confirmDelete = async () => {
    if (!deleteCandidate) return;
    try {
      setIsDeleting(true);
      await deleteTrip(deleteCandidate.id);
      setDeleteCandidate(null);
    } catch (err) {
      console.error("Failed to delete trip:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  const getStyleIcon = (style: TravelStyle) => {
    switch (style) {
      case "MOTORCYCLE":
        return <Bike className="w-4 h-4 text-amber-500" />;
      case "BACKPACKING":
        return <Backpack className="w-4 h-4 text-emerald-500" />;
      case "ROADTRIP":
        return <Car className="w-4 h-4 text-cyan-500" />;
      case "TREKKING":
        return <Footprints className="w-4 h-4 text-orange-500" />;
      default:
        return <Compass className="w-4 h-4 text-indigo-500" />;
    }
  };

  const formatDateRange = (start: string, end?: string) => {
    const s = new Date(start);
    const startStr = s.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    if (!end) return startStr;
    const e = new Date(end);
    const endStr = e.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    return `${startStr} – ${endStr}`;
  };

  const getTripDurationBadge = (trip: TripRecord) => {
    const { formatted } = getTripDayCount(trip.startDate, trip.endDate);
    return formatted;
  };

  // Lock body scroll when delete confirmation dialog is open
  useLockBodyScroll(!!deleteCandidate);

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in pt-2 sm:pt-4 pb-16">
      {/* Top Navigation */}
      <nav className="flex items-center justify-between border-b border-muted pb-4 sm:pb-5">
        <Link
          href="/secret"
          className="group inline-flex items-center gap-2 text-xs font-sans tracking-wide text-muted-foreground hover:text-foreground transition-colors py-1.5"
        >
          <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" />
          <span>Private Atlas</span>
        </Link>

        <div className="flex items-center gap-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/10 border border-accent/20 text-[11px] font-mono tracking-wider text-accent font-semibold uppercase">
            <ShieldCheck className="w-3.5 h-3.5 text-accent" />
            <span>Trip Vault</span>
          </div>

          <button
            onClick={handleLockVault}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-muted hover:border-foreground/30 text-[11px] font-sans text-muted-foreground hover:text-foreground transition-colors"
            title="Lock Private Atlas"
          >
            <Lock className="w-3 h-3 text-accent" />
            <span>Lock</span>
          </button>
        </div>
      </nav>

      {/* Header with Title and Create Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl text-foreground font-normal tracking-tight flex items-center gap-3">
            <span>Expedition Vault</span>
          </h1>
          <p className="font-body text-xs sm:text-sm text-muted-foreground mt-1 max-w-lg">
            Offline travel command center. Manage itineraries, tickets, PNRs, hotel vouchers, and logistics with zero internet dependency.
          </p>
        </div>

        <Link
          href="/secret/vault/new"
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-accent hover:bg-accent/90 text-white font-medium text-xs font-sans tracking-wide shadow-sm transition-all active:scale-[0.98] shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Plan Expedition</span>
        </Link>
      </div>

      {/* ACTIVE EXPEDITION HERO (If any trip exists) */}
      {activeTrip && (
        <section className="relative rounded-3xl border border-muted bg-surface p-6 sm:p-8 overflow-hidden shadow-soft transition-all">
          <div className="relative z-10 flex flex-col gap-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="flex h-2.5 w-2.5 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-accent" />
                </span>
                <span className="text-[11px] font-mono uppercase tracking-widest text-accent font-semibold">
                  {activeTrip.status === "ACTIVE" ? "Active Expedition Command" : "Upcoming Expedition"}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-background border border-muted text-xs font-sans text-muted-foreground">
                  {getStyleIcon(activeTrip.travelStyle)}
                  <span>{activeTrip.travelStyle}</span>
                </span>
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-accent/10 border border-accent/20 text-xs font-mono text-accent font-semibold">
                  <Clock className="w-3.5 h-3.5 text-accent" />
                  <span>{getTripDurationBadge(activeTrip)}</span>
                </span>
              </div>
            </div>

            <div>
              <h2 className="font-display text-2xl sm:text-3xl text-foreground font-normal tracking-tight">
                {activeTrip.title}
              </h2>
              <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground mt-1">
                <MapPin className="w-3.5 h-3.5 text-accent shrink-0" />
                <span>{activeTrip.destination}</span>
                <span className="text-muted-foreground/40">•</span>
                <span>{formatDateRange(activeTrip.startDate, activeTrip.endDate)}</span>
              </div>
            </div>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-muted">
              <div className="p-3 rounded-xl bg-background border border-muted">
                <span className="text-[10px] font-mono uppercase text-muted-foreground tracking-wider block">Budget Allocated</span>
                <span className="text-sm sm:text-base font-semibold font-mono text-foreground mt-0.5 block">
                  {activeTrip.currency} {activeTrip.budgetTotal.toLocaleString()}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-background border border-muted">
                <span className="text-[10px] font-mono uppercase text-muted-foreground tracking-wider block">Route Stops</span>
                <span className="text-sm sm:text-base font-semibold font-mono text-foreground mt-0.5 block">
                  {activeTrip.destinations?.length || 1} Destinations
                </span>
              </div>
              <div className="p-3 rounded-xl bg-background border border-muted">
                <span className="text-[10px] font-mono uppercase text-muted-foreground tracking-wider block">Offline Cache</span>
                <span className="text-sm sm:text-base font-semibold font-mono text-emerald-600 mt-0.5 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>100% Ready</span>
                </span>
              </div>
              <div className="p-3 rounded-xl bg-background border border-muted">
                <span className="text-[10px] font-mono uppercase text-muted-foreground tracking-wider block">Companions</span>
                <span className="text-sm sm:text-base font-semibold font-mono text-foreground mt-0.5 block">
                  {activeTrip.companions?.length ? `${activeTrip.companions.length} Travelers` : "Solo Journey"}
                </span>
              </div>
            </div>

            {/* Primary Action Button */}
            <Link
              href={`/secret/vault/${activeTrip.id}`}
              className="w-full py-3 px-4 rounded-xl font-medium text-xs font-sans uppercase tracking-wider bg-background hover:bg-surface-hover border border-muted hover:border-foreground/30 text-foreground flex items-center justify-between transition-colors shadow-xs"
            >
              <span>Enter Trip Command Center</span>
              <ChevronRight className="w-4 h-4 text-accent" />
            </Link>
          </div>
        </section>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 p-1 bg-surface border border-muted rounded-xl text-xs overflow-x-auto [scrollbar-width:none]">
        {(
          [
            { id: "ALL", label: `All Trips (${trips.length})` },
            { id: "ACTIVE", label: `Active & Planning (${trips.filter((t) => t.status === "ACTIVE" || t.status === "PLANNING").length})` },
            { id: "COMPLETED", label: `Completed (${trips.filter((t) => t.status === "COMPLETED").length})` },
            { id: "DRAFT", label: `Drafts (${trips.filter((t) => t.status === "DRAFT" || t.status === "ARCHIVED").length})` },
          ] as { id: FilterTab; label: string }[]
        ).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3.5 py-1.5 rounded-lg transition-all whitespace-nowrap select-none ${
              activeTab === tab.id
                ? "bg-background text-foreground border border-muted shadow-xs font-medium"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TRIP CARDS LIST */}
      {isLoading ? (
        <div className="py-16 text-center text-xs font-mono text-muted-foreground flex items-center justify-center gap-2">
          <div className="w-4 h-4 rounded-full border border-muted border-t-amber-500 animate-spin" />
          <span>Synchronizing local vault...</span>
        </div>
      ) : filteredTrips.length === 0 ? (
        <div className="p-10 rounded-2xl border border-muted border-dashed bg-surface/50 text-center flex flex-col items-center">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 mb-4">
            <Compass className="w-6 h-6 text-amber-500" />
          </div>
          <h3 className="font-display text-lg text-foreground font-normal">
            No expeditions found
          </h3>
          <p className="font-body text-xs text-muted-foreground mt-1 max-w-sm mb-6">
            {activeTab === "ALL"
              ? "Your offline expedition vault is empty. Plan a journey with daily itineraries, transport bookings, and offline documents."
              : `No expeditions matching the '${activeTab.toLowerCase()}' filter.`}
          </p>
          <Link
            href="/secret/vault/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-medium text-xs font-sans tracking-wide transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Plan Expedition</span>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredTrips.map((trip) => {
            const isMenuOpen = menuOpenTripId === trip.id;

            return (
              <div
                key={trip.id}
                className="group relative rounded-2xl border border-muted bg-surface hover:bg-surface-hover/60 hover:border-foreground/20 p-5 transition-all duration-200 shadow-soft flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className={`text-[10px] font-mono uppercase tracking-wider px-2.5 py-0.5 rounded-full font-semibold border ${
                          trip.status === "ACTIVE"
                            ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                            : trip.status === "PLANNING"
                            ? "bg-amber-500/15 border-amber-500/30 text-amber-400"
                            : trip.status === "COMPLETED"
                            ? "bg-indigo-500/15 border-indigo-500/30 text-indigo-400"
                            : "bg-muted border-muted text-muted-foreground"
                        }`}
                      >
                        {trip.status}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[11px] font-sans text-muted-foreground bg-background px-2 py-0.5 rounded-md border border-muted">
                        {getStyleIcon(trip.travelStyle)}
                        <span>{trip.travelStyle}</span>
                      </span>
                    </div>

                    {/* Quick Menu Button */}
                    <div className="relative">
                      <button
                        onClick={() => setMenuOpenTripId(isMenuOpen ? null : trip.id)}
                        className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                        aria-label="Trip actions"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {/* Dropdown Menu */}
                      {isMenuOpen && (
                        <div className="absolute right-0 top-7 z-20 w-44 rounded-xl border border-muted bg-neutral-900 shadow-xl p-1 text-xs select-none animate-fade-in">
                          <button
                            onClick={() => {
                              changeTripStatus(trip.id, trip.status === "ACTIVE" ? "PLANNING" : "ACTIVE");
                              setMenuOpenTripId(null);
                            }}
                            className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/10 text-neutral-300 flex items-center justify-between"
                          >
                            <span>{trip.status === "ACTIVE" ? "Set Planning" : "Set Active"}</span>
                            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                          </button>
                          <button
                            onClick={() => {
                              changeTripStatus(trip.id, "COMPLETED");
                              setMenuOpenTripId(null);
                            }}
                            className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/10 text-neutral-300 flex items-center justify-between"
                          >
                            <span>Mark Completed</span>
                            <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" />
                          </button>
                          <div className="my-1 border-t border-white/10" />
                          <button
                            onClick={() => {
                              setDeleteCandidate(trip);
                              setMenuOpenTripId(null);
                            }}
                            className="w-full text-left px-3 py-2 rounded-lg hover:bg-rose-500/20 text-rose-400 flex items-center justify-between"
                          >
                            <span>Delete Trip</span>
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <Link href={`/secret/vault/${trip.id}`} className="block group-hover:text-amber-500 transition-colors">
                    <h3 className="font-display text-xl text-foreground group-hover:text-amber-500 font-normal tracking-tight line-clamp-1">
                      {trip.title}
                    </h3>
                  </Link>

                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1 mb-4">
                    <MapPin className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <span className="line-clamp-1">{trip.destination}</span>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-muted-foreground/80 font-mono">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-accent" />
                      <span>{formatDateRange(trip.startDate, trip.endDate)}</span>
                    </span>
                    <span>•</span>
                    <span className="text-foreground font-semibold">
                      {trip.currency} {trip.budgetTotal.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Footer Action */}
                <div className="mt-5 pt-3 border-t border-muted/60 flex items-center justify-between">
                  <span className="text-[11px] font-mono text-muted-foreground">
                    {trip.destinations?.length || 1} Stops
                  </span>

                  <Link
                    href={`/secret/vault/${trip.id}`}
                    className="inline-flex items-center gap-1 text-xs font-sans tracking-wide text-accent hover:text-accent/80 font-medium transition-colors"
                  >
                    <span>Command Center</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteCandidate && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setDeleteCandidate(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-w-sm w-full p-6 rounded-2xl border border-muted bg-background shadow-2xl text-center overscroll-contain animate-fade-in-up"
          >
            <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6 text-rose-600" />
            </div>

            <h3 className="font-display text-xl text-foreground font-normal mb-2">
              Delete Expedition?
            </h3>
            <p className="font-body text-xs text-muted-foreground leading-relaxed mb-6">
              Are you sure you want to delete <strong className="text-foreground">{deleteCandidate.title}</strong>? All offline tickets, itineraries, expenses, and documents associated with this trip will be permanently erased from this device.
            </p>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setDeleteCandidate(null)}
                disabled={isDeleting}
                className="flex-1 py-2.5 px-3 rounded-xl border border-muted hover:border-foreground/30 text-xs font-sans text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={isDeleting}
                className="flex-1 py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-medium text-xs font-sans transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
              >
                {isDeleting ? "Erasing..." : "Delete Forever"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
