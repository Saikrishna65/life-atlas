"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Edit3,
  Trash2,
  Share2,
  Check,
  ChevronRight,
  ShieldCheck,
  AlertTriangle,
  Lock,
  Compass,
  Bike,
  Backpack,
  Car,
  Footprints,
  CalendarDays,
  Ticket,
  FileText,
  Utensils,
  CreditCard,
  CheckSquare,
  PhoneCall,
  Bell,
  Camera,
  Bot,
  X,
} from "lucide-react";
import { useTripVault } from "@/lib/vault/useTripVault";
import { getTrip } from "@/lib/vault/storage";
import {
  TripRecord,
  TripStatus,
  TravelStyle,
} from "@/lib/vault/types";
import { revokeSecretAccess } from "@/lib/deviceAuth";

export default function TripCommandCenterPage() {
  const params = useParams();
  const router = useRouter();
  const tripId = params.tripId as string;

  const { deleteTrip, changeTripStatus, updateTrip } = useTripVault();

  const [trip, setTrip] = useState<TripRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [copiedBriefing, setCopiedBriefing] = useState(false);
  const [now] = useState(() => Date.now());

  // Edit form state
  const [editTitle, setEditTitle] = useState("");
  const [editSubtitle, setEditSubtitle] = useState("");
  const [editDestination, setEditDestination] = useState("");
  const [editStartDate, setEditStartDate] = useState("");
  const [editEndDate, setEditEndDate] = useState("");
  const [editTravelStyle, setEditTravelStyle] = useState<TravelStyle>("MOTORCYCLE");
  const [editBudgetTotal, setEditBudgetTotal] = useState<number>(0);
  const [editCurrency, setEditCurrency] = useState("INR");
  const [editNotes, setEditNotes] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Load trip data
  useEffect(() => {
    let mounted = true;
    if (!tripId) return;

    (async () => {
      try {
        const data = await getTrip(tripId);
        if (!mounted) return;
        if (data) {
          setTrip(data);
          // Prepopulate edit form
          setEditTitle(data.title);
          setEditSubtitle(data.subtitle || "");
          setEditDestination(data.destination);
          setEditStartDate(data.startDate ? data.startDate.split("T")[0] : "");
          setEditEndDate(data.endDate ? data.endDate.split("T")[0] : "");
          setEditTravelStyle(data.travelStyle);
          setEditBudgetTotal(data.budgetTotal);
          setEditCurrency(data.currency);
          setEditNotes(data.notes || "");
        } else {
          setTrip(null);
        }
      } catch (err) {
        if (mounted) {
          console.error("Failed to load trip:", err);
          setTrip(null);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
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

  // Status transition handler
  const handleStatusChange = async (newStatus: TripStatus) => {
    if (!trip) return;
    try {
      const updated = await changeTripStatus(trip.id, newStatus);
      setTrip(updated);
    } catch (err) {
      console.error("Failed to change trip status:", err);
    }
  };

  // Delete trip handler
  const handleDeleteTrip = async () => {
    if (!trip) return;
    try {
      setIsDeleting(true);
      await deleteTrip(trip.id);
      router.push("/secret/vault");
    } catch (err) {
      console.error("Failed to delete trip:", err);
      setIsDeleting(false);
    }
  };

  // Save edit handler
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trip) return;

    try {
      setIsSavingEdit(true);
      const updated: TripRecord = {
        ...trip,
        title: editTitle.trim() || trip.title,
        subtitle: editSubtitle.trim() || undefined,
        destination: editDestination.trim() || trip.destination,
        startDate: editStartDate ? new Date(editStartDate).toISOString() : trip.startDate,
        endDate: editEndDate ? new Date(editEndDate).toISOString() : undefined,
        travelStyle: editTravelStyle,
        budgetTotal: Number(editBudgetTotal) || 0,
        currency: editCurrency,
        notes: editNotes.trim() || undefined,
        updatedAt: new Date().toISOString(),
      };

      await updateTrip(updated);
      setTrip(updated);
      setShowEditModal(false);
    } catch (err) {
      console.error("Failed to update trip:", err);
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Copy Briefing to Clipboard
  const handleCopyBriefing = () => {
    if (!trip) return;
    const briefingText = [
      `EXPEDITION DOSSIER: ${trip.title.toUpperCase()}`,
      trip.subtitle ? `Tagline: ${trip.subtitle}` : null,
      `Destination: ${trip.destination}`,
      `Travel Style: ${trip.travelStyle}`,
      `Dates: ${new Date(trip.startDate).toLocaleDateString()} to ${
        trip.endDate ? new Date(trip.endDate).toLocaleDateString() : "Open"
      }`,
      `Budget: ${trip.currency} ${trip.budgetTotal.toLocaleString()}`,
      trip.companions?.length ? `Companions: ${trip.companions.join(", ")}` : "Solo Expedition",
      trip.notes ? `Notes: ${trip.notes}` : null,
      `\nStored securely offline in Life Atlas Trip Vault.`,
    ]
      .filter(Boolean)
      .join("\n");

    navigator.clipboard.writeText(briefingText);
    setCopiedBriefing(true);
    setTimeout(() => setCopiedBriefing(false), 2500);
  };

  // Countdown & duration computations
  const { daysTotal, countdownLabel, countdownSub } = useMemo(() => {
    if (!trip) return { daysTotal: 1, countdownLabel: "", countdownSub: "" };

    const start = new Date(trip.startDate).getTime();
    const end = trip.endDate ? new Date(trip.endDate).getTime() : start;

    const diffDays = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1);

    if (trip.status === "COMPLETED") {
      return {
        daysTotal: diffDays,
        countdownLabel: "Expedition Completed",
        countdownSub: "Archived in your personal chronicle",
      };
    }

    const msUntilStart = start - now;
    const daysUntilStart = Math.ceil(msUntilStart / (1000 * 60 * 60 * 24));

    if (daysUntilStart > 0) {
      return {
        daysTotal: diffDays,
        countdownLabel: `T-${daysUntilStart} Days`,
        countdownSub: `Countdown to departure`,
      };
    } else if (daysUntilStart === 0) {
      return {
        daysTotal: diffDays,
        countdownLabel: "Departure Day",
        countdownSub: "Expedition launches today",
      };
    } else {
      const dayOnRoad = Math.abs(daysUntilStart) + 1;
      return {
        daysTotal: diffDays,
        countdownLabel: `Day ${Math.min(dayOnRoad, diffDays)} of ${diffDays}`,
        countdownSub: "Expedition actively in progress",
      };
    }
  }, [trip, now]);

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

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto py-24 text-center text-xs font-mono text-muted-foreground flex items-center justify-center gap-2">
        <div className="w-4 h-4 rounded-full border border-muted border-t-amber-500 animate-spin" />
        <span>Decrypting local expedition vault...</span>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="max-w-md mx-auto py-20 text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center mx-auto">
          <Compass className="w-6 h-6 text-amber-500" />
        </div>
        <h2 className="font-display text-2xl text-foreground font-normal">
          Expedition Not Found
        </h2>
        <p className="font-body text-xs text-muted-foreground">
          This expedition dossier does not exist in local IndexedDB storage, or it may have been erased.
        </p>
        <Link
          href="/secret/vault"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-surface border border-muted text-xs font-sans text-foreground hover:bg-surface-hover"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Return to Vault Dashboard</span>
        </Link>
      </div>
    );
  }

  // 8 Pillars Feature Hubs
  const FEATURE_HUBS = [
    {
      id: "itinerary",
      title: "Itinerary & Schedule",
      subtitle: "Day-by-day timeline, themes & hourly activity blocks",
      href: `/secret/vault/${trip.id}/itinerary`,
      icon: <CalendarDays className="w-5 h-5 text-amber-500" />,
      badge: "Pillar 02",
      accent: "border-amber-500/30 hover:border-amber-400/60 bg-amber-500/5",
    },
    {
      id: "bookings",
      title: "Bookings & PNRs",
      subtitle: "Train berths, flights, stay vouchers & 1-tap copy PNR",
      href: `/secret/vault/${trip.id}/bookings`,
      icon: <Ticket className="w-5 h-5 text-cyan-400" />,
      badge: "Pillar 03",
      accent: "border-cyan-500/30 hover:border-cyan-400/60 bg-cyan-500/5",
    },
    {
      id: "documents",
      title: "Offline Document Vault",
      subtitle: "IRCTC PDFs, boarding passes, ID cards cached offline",
      href: `/secret/vault/${trip.id}/documents`,
      icon: <FileText className="w-5 h-5 text-indigo-400" />,
      badge: "Pillar 04",
      accent: "border-indigo-500/30 hover:border-indigo-400/60 bg-indigo-500/5",
    },
    {
      id: "rentals",
      title: "Bike & Scooter Rentals",
      subtitle: "Vehicle models, security deposits & fuel policies",
      href: `/secret/vault/${trip.id}/rentals`,
      icon: <Bike className="w-5 h-5 text-emerald-400" />,
      badge: "Pillar 06",
      accent: "border-emerald-500/30 hover:border-emerald-400/60 bg-emerald-500/5",
    },
    {
      id: "routes",
      title: "Maps & Offline Waypoints",
      subtitle: "GPS waypoints, mountain passes, road advisories & maps intent",
      href: `/secret/vault/${trip.id}/routes`,
      icon: <MapPin className="w-5 h-5 text-teal-400" />,
      badge: "Pillar 07",
      accent: "border-teal-500/30 hover:border-teal-400/60 bg-teal-500/5",
    },
    {
      id: "food",
      title: "Culinary Roadmap",
      subtitle: "Regional delicacies, street eats & restaurant wishlist",
      href: `/secret/vault/${trip.id}/food`,
      icon: <Utensils className="w-5 h-5 text-orange-400" />,
      badge: "Pillar 05",
      accent: "border-orange-500/30 hover:border-orange-400/60 bg-orange-500/5",
    },
    {
      id: "budget",
      title: "Budget & Expenses",
      subtitle: "Multi-currency expense log, payment modes & totals",
      href: `/secret/vault/${trip.id}/budget`,
      icon: <CreditCard className="w-5 h-5 text-rose-400" />,
      badge: "Pillar 08",
      accent: "border-rose-500/30 hover:border-rose-400/60 bg-rose-500/5",
    },
    {
      id: "packing",
      title: "Gear & Packing Checklist",
      subtitle: "Categorized audit: riding gear, first aid & electronics",
      href: `/secret/vault/${trip.id}/packing`,
      icon: <CheckSquare className="w-5 h-5 text-teal-400" />,
      badge: "Pillar 09",
      accent: "border-teal-500/30 hover:border-teal-400/60 bg-teal-500/5",
    },
    {
      id: "safety",
      title: "Safety & Emergency ICE",
      subtitle: "Quick-dial rescue, hospitals, blood group & Plan B",
      href: `/secret/vault/${trip.id}/safety`,
      icon: <PhoneCall className="w-5 h-5 text-red-400" />,
      badge: "Pillar 10",
      accent: "border-red-500/30 hover:border-red-400/60 bg-red-500/5",
    },
    {
      id: "reminders",
      title: "Alarms & Departure Reminders",
      subtitle: "Native local notifications for departures, stays & rental returns",
      href: `/secret/vault/${trip.id}/reminders`,
      icon: <Bell className="w-5 h-5 text-yellow-400" />,
      badge: "Pillar 11",
      accent: "border-yellow-500/30 hover:border-yellow-400/60 bg-yellow-500/5",
    },
    {
      id: "memories",
      title: "Memories & Completed Archives",
      subtitle: "Milestone celebration dossier, photo wall & public journal export",
      href: `/secret/vault/${trip.id}/memories`,
      icon: <Camera className="w-5 h-5 text-amber-400" />,
      badge: "Pillar 12",
      accent: "border-amber-500/30 hover:border-amber-400/60 bg-amber-500/5",
    },
    {
      id: "assistant",
      title: "AI Assistant & Smart Parser",
      subtitle: "Neon AI Gateway itinerary generator & offline PNR ticket extractor",
      href: `/secret/vault/${trip.id}/assistant`,
      icon: <Bot className="w-5 h-5 text-purple-400" />,
      badge: "Pillar 13",
      accent: "border-purple-500/30 hover:border-purple-400/60 bg-purple-500/5",
    },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in pt-2 sm:pt-4 pb-20">
      {/* Top Navigation */}
      <nav className="flex items-center justify-between border-b border-muted pb-4">
        <Link
          href="/secret/vault"
          className="group inline-flex items-center gap-2 text-xs font-sans tracking-wide text-muted-foreground hover:text-foreground transition-colors py-1.5"
        >
          <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" />
          <span>Vault Dashboard</span>
        </Link>

        <div className="flex items-center gap-2.5">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-[11px] font-mono tracking-wider text-amber-400 font-semibold uppercase">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />
            <span>Command Center</span>
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

      {/* MASTER EXPEDITION HERO BANNER */}
      <section className="relative rounded-3xl border border-muted bg-surface overflow-hidden shadow-soft">
        {/* Cover Image Background if available */}
        {trip.coverImage && (
          <div className="relative h-48 sm:h-64 w-full overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={trip.coverImage}
              alt={trip.title}
              className="w-full h-full object-cover brightness-[0.65] contrast-[1.05]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/60 to-transparent" />
          </div>
        )}

        <div className={`p-6 sm:p-8 ${trip.coverImage ? "-mt-16 relative z-10" : ""}`}>
          <div className="flex flex-col gap-6">
            {/* Top row: Status selector, Travel Style, Quick Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {/* Status Dropdown Selector */}
                <select
                  value={trip.status}
                  onChange={(e) => handleStatusChange(e.target.value as TripStatus)}
                  className={`text-xs font-mono uppercase tracking-wider px-3 py-1 rounded-full font-semibold border cursor-pointer focus:outline-hidden transition-all ${
                    trip.status === "ACTIVE"
                      ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"
                      : trip.status === "PLANNING"
                      ? "bg-amber-500/20 border-amber-500/40 text-amber-400"
                      : trip.status === "COMPLETED"
                      ? "bg-indigo-500/20 border-indigo-500/40 text-indigo-400"
                      : "bg-muted border-muted text-muted-foreground"
                  }`}
                >
                  <option value="PLANNING">Planning</option>
                  <option value="ACTIVE">Active (On Road)</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="DRAFT">Draft</option>
                  <option value="ARCHIVED">Archived</option>
                </select>

                {/* Travel Style Badge */}
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-background/80 border border-muted text-xs font-sans text-muted-foreground backdrop-blur-xs">
                  {getStyleIcon(trip.travelStyle)}
                  <span>{trip.travelStyle}</span>
                </span>
              </div>

              {/* Action buttons: Edit, Share Briefing, Delete */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowEditModal(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-background border border-muted hover:border-foreground/30 text-xs font-sans text-foreground transition-colors shadow-xs"
                >
                  <Edit3 className="w-3.5 h-3.5 text-amber-500" />
                  <span>Edit</span>
                </button>

                <button
                  onClick={handleCopyBriefing}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-background border border-muted hover:border-foreground/30 text-xs font-sans text-foreground transition-colors shadow-xs"
                  title="Copy Expedition Dossier to clipboard"
                >
                  {copiedBriefing ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Share2 className="w-3.5 h-3.5 text-accent" />
                      <span>Dossier</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => setShowDeleteModal(true)}
                  className="p-2 rounded-xl bg-background border border-muted hover:border-rose-500/40 hover:text-rose-400 text-muted-foreground transition-colors"
                  aria-label="Delete expedition"
                  title="Delete expedition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Title & Subtitle */}
            <div>
              <h1 className="font-display text-3xl sm:text-4xl text-foreground font-normal tracking-tight">
                {trip.title}
              </h1>
              {trip.subtitle && (
                <p className="font-body text-sm sm:text-base text-muted-foreground mt-1">
                  {trip.subtitle}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm text-muted-foreground mt-2">
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-amber-500 shrink-0" />
                  <span className="text-foreground font-medium">{trip.destination}</span>
                </div>
                <span>•</span>
                <div className="flex items-center gap-1.5 font-mono">
                  <Calendar className="w-3.5 h-3.5 text-accent" />
                  <span>
                    {new Date(trip.startDate).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                    {trip.endDate
                      ? ` – ${new Date(trip.endDate).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}`
                      : ""}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Metrics Ribbon */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-muted/60">
              {/* Metric 1: Countdown */}
              <div className="p-3.5 rounded-2xl bg-background/80 border border-muted/60">
                <span className="text-[10px] font-mono uppercase text-muted-foreground tracking-wider block">
                  Status Timeline
                </span>
                <span className="text-sm sm:text-base font-semibold font-mono text-amber-400 mt-0.5 block truncate">
                  {countdownLabel}
                </span>
                <span className="text-[10px] text-muted-foreground truncate block mt-0.5">
                  {countdownSub}
                </span>
              </div>

              {/* Metric 2: Duration */}
              <div className="p-3.5 rounded-2xl bg-background/80 border border-muted/60">
                <span className="text-[10px] font-mono uppercase text-muted-foreground tracking-wider block">
                  Expedition Duration
                </span>
                <span className="text-sm sm:text-base font-semibold font-mono text-foreground mt-0.5 block">
                  {daysTotal} Days
                </span>
                <span className="text-[10px] text-muted-foreground block mt-0.5">
                  {trip.destinations?.length || 1} Scheduled Stops
                </span>
              </div>

              {/* Metric 3: Budget Allocated */}
              <div className="p-3.5 rounded-2xl bg-background/80 border border-muted/60">
                <span className="text-[10px] font-mono uppercase text-muted-foreground tracking-wider block">
                  Budget Target
                </span>
                <span className="text-sm sm:text-base font-semibold font-mono text-foreground mt-0.5 block">
                  {trip.currency} {trip.budgetTotal.toLocaleString()}
                </span>
                <span className="text-[10px] text-emerald-400 block mt-0.5">
                  Offline Tracker Ready
                </span>
              </div>

              {/* Metric 4: Companions */}
              <div className="p-3.5 rounded-2xl bg-background/80 border border-muted/60">
                <span className="text-[10px] font-mono uppercase text-muted-foreground tracking-wider block">
                  Travel Crew
                </span>
                <span className="text-sm sm:text-base font-semibold font-sans text-foreground mt-0.5 block truncate">
                  {trip.companions?.length
                    ? `${trip.companions.length} Companions`
                    : "Solo Voyager"}
                </span>
                <span className="text-[10px] text-muted-foreground block mt-0.5 truncate">
                  {trip.companions?.join(", ") || "No other travelers"}
                </span>
              </div>
            </div>

            {/* ROUTE SEQUENCING RIBBON (If multi-stop defined) */}
            {trip.destinations && trip.destinations.length > 0 && (
              <div className="pt-2 border-t border-muted/60">
                <div className="flex items-center gap-2 mb-2.5">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                    Sequenced Route Waypoints:
                  </span>
                </div>
                <div className="flex items-center gap-2 overflow-x-auto pb-2 [scrollbar-width:none]">
                  {trip.destinations.map((stop, idx) => (
                    <React.Fragment key={stop.id || idx}>
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-background/90 border border-muted shrink-0 text-xs font-sans">
                        <span className="w-5 h-5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[10px] font-mono font-bold flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <span className="font-medium text-foreground">{stop.name}</span>
                        {stop.stayNights ? (
                          <span className="text-[10px] font-mono text-muted-foreground bg-surface px-1.5 py-0.5 rounded-md border border-muted">
                            {stop.stayNights}n
                          </span>
                        ) : null}
                      </div>
                      {idx < (trip.destinations?.length || 0) - 1 && (
                        <span className="text-muted-foreground/40 font-mono text-xs shrink-0">→</span>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* EXPEDITION COMMAND HUBS (The 8 Pillars Grid) */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl text-foreground font-normal tracking-tight">
            Expedition Modules
          </h2>
          <span className="text-xs font-mono text-muted-foreground">
            Expedition Vault Modules • 100% Offline
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {FEATURE_HUBS.map((hub) => (
            <Link
              key={hub.id}
              href={hub.href}
              className={`group relative rounded-2xl border p-5 transition-all duration-300 shadow-soft flex items-start gap-4 active:scale-[0.99] ${hub.accent}`}
            >
              <div className="p-3 rounded-xl bg-background border border-muted group-hover:scale-105 transition-transform shrink-0 shadow-xs">
                {hub.icon}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-display text-lg text-foreground font-normal tracking-tight group-hover:text-amber-500 transition-colors">
                    {hub.title}
                  </h3>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/80 px-2 py-0.5 rounded-md bg-background/60 border border-muted shrink-0">
                    {hub.badge}
                  </span>
                </div>
                <p className="font-body text-xs text-muted-foreground line-clamp-2 mt-1 leading-relaxed">
                  {hub.subtitle}
                </p>
              </div>

              <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-amber-500 group-hover:translate-x-0.5 transition-all shrink-0 self-center" />
            </Link>
          ))}
        </div>
      </section>

      {/* POST-EXPEDITION MEMORIES ACCORDION / BANNER */}
      <section className="p-6 rounded-2xl border border-muted bg-surface/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-background border border-muted text-accent shrink-0">
            <Camera className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h3 className="font-display text-base text-foreground font-normal">
              Expedition Memories & Photo Wall
            </h3>
            <p className="font-body text-xs text-muted-foreground mt-0.5">
              Reflections, landmark photography, and optional export to your public Life Atlas chronicle.
            </p>
          </div>
        </div>

        <Link
          href={`/secret/vault/${trip.id}/memories`}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-surface hover:bg-surface-hover border border-muted text-xs font-sans text-foreground transition-colors shrink-0"
        >
          <span>Open Memories</span>
          <ChevronRight className="w-3.5 h-3.5 text-accent" />
        </Link>
      </section>

      {/* QUICK EDIT MODAL */}
      {showEditModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
        >
          <div className="max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 rounded-2xl border border-muted bg-surface shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-muted pb-3">
              <h3 className="font-display text-xl text-foreground font-normal">
                Edit Expedition Details
              </h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-sans font-medium text-foreground">Title *</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-background border border-muted focus:border-amber-500 focus:outline-hidden text-sm text-foreground"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-sans font-medium text-foreground">Subtitle</label>
                <input
                  type="text"
                  value={editSubtitle}
                  onChange={(e) => setEditSubtitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-background border border-muted focus:border-amber-500 focus:outline-hidden text-xs text-foreground"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-sans font-medium text-foreground">
                  Primary Destination *
                </label>
                <input
                  type="text"
                  value={editDestination}
                  onChange={(e) => setEditDestination(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-background border border-muted focus:border-amber-500 focus:outline-hidden text-xs text-foreground"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-sans font-medium text-foreground">Start Date</label>
                  <input
                    type="date"
                    value={editStartDate}
                    onChange={(e) => setEditStartDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-background border border-muted focus:border-amber-500 focus:outline-hidden text-xs text-foreground [color-scheme:dark]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-sans font-medium text-foreground">End Date</label>
                  <input
                    type="date"
                    value={editEndDate}
                    onChange={(e) => setEditEndDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-background border border-muted focus:border-amber-500 focus:outline-hidden text-xs text-foreground [color-scheme:dark]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-sans font-medium text-foreground">
                    Budget Target
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={editBudgetTotal}
                    onChange={(e) => setEditBudgetTotal(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-xl bg-background border border-muted focus:border-amber-500 focus:outline-hidden text-xs font-mono text-foreground"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-sans font-medium text-foreground">Currency</label>
                  <input
                    type="text"
                    value={editCurrency}
                    onChange={(e) => setEditCurrency(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 rounded-xl bg-background border border-muted focus:border-amber-500 focus:outline-hidden text-xs font-mono text-foreground uppercase"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-sans font-medium text-foreground">
                  Expedition Briefing Notes
                </label>
                <textarea
                  rows={3}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-background border border-muted focus:border-amber-500 focus:outline-hidden text-xs text-foreground resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-muted">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 rounded-xl border border-muted text-xs font-sans text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-semibold text-xs font-sans transition-colors"
                >
                  {isSavingEdit ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {showDeleteModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
        >
          <div className="max-w-sm w-full p-6 rounded-2xl border border-muted bg-surface shadow-2xl text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6 text-rose-500" />
            </div>

            <h3 className="font-display text-xl text-foreground font-normal mb-2">
              Erase Expedition?
            </h3>
            <p className="font-body text-xs text-muted-foreground leading-relaxed mb-6">
              Are you sure you want to delete <strong className="text-foreground">{trip.title}</strong>? All offline tickets, itineraries, expenses, vehicle logs, and documents associated with this trip will be permanently erased.
            </p>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
                className="flex-1 py-2.5 px-3 rounded-xl border border-muted text-xs font-sans text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteTrip}
                disabled={isDeleting}
                className="flex-1 py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-medium text-xs font-sans transition-colors flex items-center justify-center gap-1.5"
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
