"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Clock,
  Plus,
  Trash2,
  Edit3,
  Check,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  Lock,
  Sun,
  CloudSun,
  Flame,
  Coffee,
  Moon,
  Compass,
  Bike,
  Backpack,
  Car,
  Footprints,
  X,
  Navigation,
} from "lucide-react";
import { getTrip } from "@/lib/vault/storage";
import { useItinerary } from "@/lib/vault/useItinerary";
import {
  TripRecord,
  ItineraryDayRecord,
  ItineraryActivity,
  ActivityTimeSlot,
  ActivityStatus,
  TravelStyle,
} from "@/lib/vault/types";
import { revokeSecretAccess } from "@/lib/deviceAuth";

const TIME_SLOTS: { id: ActivityTimeSlot; label: string; icon: React.ReactNode; defaultTime: string }[] = [
  { id: "MORNING", label: "Morning", icon: <Sun className="w-4 h-4 text-amber-400" />, defaultTime: "08:00" },
  { id: "AFTERNOON", label: "Afternoon", icon: <CloudSun className="w-4 h-4 text-orange-400" />, defaultTime: "13:00" },
  { id: "EVENING", label: "Evening", icon: <Coffee className="w-4 h-4 text-rose-400" />, defaultTime: "17:30" },
  { id: "NIGHT", label: "Night", icon: <Moon className="w-4 h-4 text-indigo-400" />, defaultTime: "20:30" },
];

export default function TripItineraryPage() {
  const params = useParams();
  const router = useRouter();
  const tripId = params.tripId as string;

  const [trip, setTrip] = useState<TripRecord | null>(null);
  const [isTripLoading, setIsTripLoading] = useState(true);

  const {
    days,
    currentDay,
    selectedDayIndex,
    setSelectedDayIndex,
    isLoading: isItineraryLoading,
    generateDaysFromTrip,
    addDay,
    updateDay,
    removeDay,
    addActivity,
    updateActivity,
    deleteActivity,
    toggleActivityStatus,
    stats,
  } = useItinerary(tripId);

  // Modals state
  const [showAddActivityModal, setShowAddActivityModal] = useState(false);
  const [editingActivity, setEditingActivity] = useState<ItineraryActivity | null>(null);

  // Activity form state
  const [actTitle, setActTitle] = useState("");
  const [actSlot, setActSlot] = useState<ActivityTimeSlot>("MORNING");
  const [actStartTime, setActStartTime] = useState("");
  const [actEndTime, setActEndTime] = useState("");
  const [actLocation, setActLocation] = useState("");
  const [actCost, setActCost] = useState<number>(0);
  const [actNotes, setActNotes] = useState("");
  const [isSubmittingActivity, setIsSubmittingActivity] = useState(false);

  // Edit Day modal state
  const [showEditDayModal, setShowEditDayModal] = useState(false);
  const [dayTitle, setDayTitle] = useState("");
  const [dayDescription, setDayDescription] = useState("");
  const [dayWeather, setDayWeather] = useState("");
  const [dayIntensity, setDayIntensity] = useState<"RELAXED" | "MODERATE" | "CHALLENGING">("MODERATE");
  const [isSubmittingDay, setIsSubmittingDay] = useState(false);

  // Auto-generation spinner
  const [isGenerating, setIsGenerating] = useState(false);

  // Load trip record
  useEffect(() => {
    let mounted = true;
    if (!tripId) return;

    (async () => {
      try {
        const data = await getTrip(tripId);
        if (mounted) {
          setTrip(data);
        }
      } catch (err) {
        console.error("Failed loading trip:", err);
      } finally {
        if (mounted) {
          setIsTripLoading(false);
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

  // Open add activity modal
  const handleOpenAddActivity = (slot?: ActivityTimeSlot) => {
    const selectedSlot = slot || "MORNING";
    setEditingActivity(null);
    setActSlot(selectedSlot);
    setActTitle("");
    const defaultStartTime = TIME_SLOTS.find((s) => s.id === selectedSlot)?.defaultTime || "09:00";
    setActStartTime(defaultStartTime);
    setActEndTime("");
    setActLocation("");
    setActCost(0);
    setActNotes("");
    setShowAddActivityModal(true);
  };

  // Open edit activity modal
  const handleOpenEditActivity = (activity: ItineraryActivity) => {
    setEditingActivity(activity);
    setActSlot(activity.timeSlot);
    setActTitle(activity.title);
    setActStartTime(activity.startTime || "");
    setActEndTime(activity.endTime || "");
    setActLocation(activity.location || "");
    setActCost(activity.estimatedCost || 0);
    setActNotes(activity.notes || "");
    setShowAddActivityModal(true);
  };

  // Save activity (create or edit)
  const handleSaveActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentDay || !actTitle.trim()) return;

    try {
      setIsSubmittingActivity(true);
      if (editingActivity) {
        await updateActivity(currentDay.id, {
          ...editingActivity,
          title: actTitle.trim(),
          timeSlot: actSlot,
          startTime: actStartTime || undefined,
          endTime: actEndTime || undefined,
          location: actLocation.trim() || undefined,
          estimatedCost: Number(actCost) || 0,
          notes: actNotes.trim() || undefined,
        });
      } else {
        await addActivity(currentDay.id, {
          title: actTitle.trim(),
          timeSlot: actSlot,
          startTime: actStartTime || undefined,
          endTime: actEndTime || undefined,
          location: actLocation.trim() || undefined,
          estimatedCost: Number(actCost) || 0,
          status: "PLANNED",
          notes: actNotes.trim() || undefined,
        });
      }
      setShowAddActivityModal(false);
    } catch (err) {
      console.error("Failed saving activity:", err);
    } finally {
      setIsSubmittingActivity(false);
    }
  };

  // Open edit day modal
  const handleOpenEditDay = (day: ItineraryDayRecord) => {
    setDayTitle(day.title);
    setDayDescription(day.description || "");
    setDayWeather(day.weatherNote || "");
    setDayIntensity(day.intensity || "MODERATE");
    setShowEditDayModal(true);
  };

  // Save day details
  const handleSaveDayDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentDay) return;

    try {
      setIsSubmittingDay(true);
      await updateDay({
        ...currentDay,
        title: dayTitle.trim() || currentDay.title,
        description: dayDescription.trim() || undefined,
        weatherNote: dayWeather.trim() || undefined,
        intensity: dayIntensity,
      });
      setShowEditDayModal(false);
    } catch (err) {
      console.error("Failed updating day:", err);
    } finally {
      setIsSubmittingDay(false);
    }
  };

  // Generate days from trip
  const handleGenerateDays = async () => {
    if (!trip) return;
    try {
      setIsGenerating(true);
      await generateDaysFromTrip(trip);
    } catch (err) {
      console.error("Failed generating days:", err);
    } finally {
      setIsGenerating(false);
    }
  };

  // Add an extra day to the end
  const handleAddExtraDay = async () => {
    if (!trip) return;
    const nextIndex = days.length + 1;
    const lastDate = days.length > 0 ? new Date(days[days.length - 1].date) : new Date(trip.startDate);
    const newDate = new Date(lastDate);
    newDate.setDate(newDate.getDate() + 1);

    await addDay({
      date: newDate.toISOString(),
      title: `Day ${nextIndex} - Journey Extension`,
      description: `Additional day activities & route extension.`,
      intensity: "MODERATE",
      activities: [],
    });
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

  if (isTripLoading || isItineraryLoading) {
    return (
      <div className="max-w-4xl mx-auto py-24 text-center text-xs font-mono text-muted-foreground flex items-center justify-center gap-2">
        <div className="w-4 h-4 rounded-full border border-muted border-t-amber-500 animate-spin" />
        <span>Loading offline itinerary schedule...</span>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="max-w-md mx-auto py-20 text-center space-y-4">
        <h2 className="font-display text-2xl text-foreground font-normal">Expedition Not Found</h2>
        <Link
          href="/secret/vault"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-surface border border-muted text-xs font-sans text-foreground"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Return to Vault</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in pt-2 sm:pt-4 pb-24">
      {/* Top Navigation */}
      <nav className="flex items-center justify-between border-b border-muted pb-4">
        <Link
          href={`/secret/vault/${trip.id}`}
          className="group inline-flex items-center gap-2 text-xs font-sans tracking-wide text-muted-foreground hover:text-foreground transition-colors py-1.5"
        >
          <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" />
          <span>Trip Command Center</span>
        </Link>

        <div className="flex items-center gap-2.5">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-[11px] font-mono tracking-wider text-amber-400 font-semibold uppercase">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />
            <span>Itinerary & Route</span>
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

      {/* EXPEDITION ITINERARY HEADER */}
      <header className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono uppercase tracking-widest text-amber-400 font-semibold">
                Pillar 02 • Master Itinerary
              </span>
              <span className="text-muted-foreground/40">•</span>
              <span className="inline-flex items-center gap-1 text-[11px] font-sans text-muted-foreground">
                {getStyleIcon(trip.travelStyle)}
                <span>{trip.travelStyle}</span>
              </span>
            </div>
            <h1 className="font-display text-3xl sm:text-4xl text-foreground font-normal tracking-tight mt-1">
              {trip.title}
            </h1>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
              <MapPin className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span>{trip.destination}</span>
              <span>•</span>
              <Calendar className="w-3.5 h-3.5 text-accent shrink-0" />
              <span>
                {new Date(trip.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                {trip.endDate
                  ? ` – ${new Date(trip.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
                  : ""}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <Link
              href={`/secret/vault/${trip.id}/assistant`}
              className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-2xl bg-purple-500/10 border border-purple-500/30 hover:border-purple-400 text-purple-300 font-medium text-xs font-sans tracking-wide transition-colors shadow-soft"
              title="Generate full day-by-day itinerary with AI"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              <span>AI Architect</span>
            </Link>

            {/* Quick Metrics Badge */}
            <div className="p-3 rounded-2xl bg-surface border border-muted flex items-center gap-4 shrink-0 shadow-soft">
              <div>
                <span className="text-[10px] font-mono uppercase text-muted-foreground block">
                  Expedition Progress
                </span>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-sm font-semibold font-mono text-amber-400">
                    {stats.tripPercentage}%
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    ({stats.completedActivities}/{stats.totalActivities} Done)
                  </span>
                </div>
              </div>
              <div className="w-12 h-2 rounded-full bg-background border border-muted overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-emerald-400 transition-all duration-300"
                  style={{ width: `${stats.tripPercentage}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 1: MULTI-DESTINATION ROUTE LEGS (REQ-ITN-01) */}
        {trip.destinations && trip.destinations.length > 0 && (
          <div className="p-4 rounded-2xl border border-muted bg-surface/70 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-sans font-medium text-foreground flex items-center gap-1.5">
                <Navigation className="w-3.5 h-3.5 text-amber-500" />
                <span>Multi-Destination Route Sequence</span>
              </span>
              <span className="text-[11px] font-mono text-muted-foreground">
                {trip.destinations.length} Waypoint Stops
              </span>
            </div>

            {/* Visual Route Connector Cards */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
              {trip.destinations.map((stop, idx) => {
                const nextStop = trip.destinations?.[idx + 1];
                return (
                  <React.Fragment key={stop.id || idx}>
                    <div className="p-2.5 rounded-xl bg-background border border-muted shrink-0 min-w-[130px] space-y-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[10px] font-mono text-amber-400 font-bold">
                          Stop 0{idx + 1}
                        </span>
                        {stop.stayNights && (
                          <span className="text-[9px] font-mono text-muted-foreground bg-surface px-1.5 py-0.5 rounded border border-muted">
                            {stop.stayNights} Nights
                          </span>
                        )}
                      </div>
                      <div className="text-xs font-semibold text-foreground truncate">
                        {stop.name}
                      </div>
                      <div className="text-[10px] text-muted-foreground line-clamp-1">
                        {stop.region || "Waypoint"}
                      </div>
                    </div>

                    {nextStop && (
                      <div className="flex flex-col items-center justify-center shrink-0 px-1 text-muted-foreground/50">
                        <span className="text-[10px] font-mono">transit</span>
                        <span className="text-xs">→</span>
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        )}
      </header>

      {/* SECTION 2: DAY-BY-DAY CALENDAR (REQ-ITN-02) */}
      {days.length === 0 ? (
        /* Empty State: Prompt to Auto-Generate Days */
        <div className="p-8 rounded-3xl border border-amber-500/30 bg-gradient-to-b from-surface to-amber-950/10 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center mx-auto">
            <Calendar className="w-6 h-6 text-amber-500" />
          </div>
          <h3 className="font-display text-xl text-foreground font-normal">
            Generate Expedition Timeline
          </h3>
          <p className="font-body text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
            Create day-by-day itinerary records aligned with your departure date (
            <strong className="text-foreground">
              {new Date(trip.startDate).toLocaleDateString()}
            </strong>
            ) and route waypoints.
          </p>

          <button
            onClick={handleGenerateDays}
            disabled={isGenerating}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-semibold text-xs font-sans tracking-wide transition-all shadow-md disabled:opacity-50"
          >
            {isGenerating ? (
              <>
                <div className="w-3.5 h-3.5 rounded-full border border-neutral-950 border-t-transparent animate-spin" />
                <span>Sequencing Calendar...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Auto-Generate Itinerary Days</span>
              </>
            )}
          </button>
        </div>
      ) : (
        /* Days Itinerary View */
        <div className="space-y-6">
          {/* Horizontal Day Switcher Ribbon */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 [scrollbar-width:none]">
            {days.map((day) => {
              const isSelected = day.dayIndex === selectedDayIndex;
              const completedCount = day.activities.filter((a) => a.status === "COMPLETED").length;
              const hasActivities = day.activities.length > 0;
              const isAllDone = hasActivities && completedCount === day.activities.length;

              return (
                <button
                  key={day.id}
                  onClick={() => setSelectedDayIndex(day.dayIndex)}
                  className={`p-3 rounded-2xl border text-left transition-all shrink-0 min-w-[130px] flex flex-col justify-between ${
                    isSelected
                      ? "bg-amber-500/15 border-amber-500/50 text-foreground ring-1 ring-amber-500/30 shadow-xs"
                      : "bg-surface border-muted text-muted-foreground hover:text-foreground hover:bg-surface-hover/60"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-mono font-bold uppercase text-amber-400">
                      Day 0{day.dayIndex}
                    </span>
                    {isAllDone ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    ) : (
                      <span className="text-[10px] font-mono text-muted-foreground">
                        {completedCount}/{day.activities.length}
                      </span>
                    )}
                  </div>

                  <div className="mt-1">
                    <div className="text-[11px] font-sans font-medium line-clamp-1 text-foreground">
                      {new Date(day.date).toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}
                    </div>
                    <div className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">
                      {day.title}
                    </div>
                  </div>
                </button>
              );
            })}

            {/* Quick Add Day Button */}
            <button
              onClick={handleAddExtraDay}
              className="p-3 rounded-2xl border border-dashed border-muted hover:border-amber-500/50 hover:bg-amber-500/5 text-muted-foreground hover:text-amber-400 transition-all shrink-0 flex flex-col items-center justify-center min-w-[100px] h-[78px] text-xs font-sans gap-1"
              title="Add another day"
            >
              <Plus className="w-4 h-4" />
              <span>Add Day</span>
            </button>
          </div>

          {/* ACTIVE DAY COMMAND CARD */}
          {currentDay && (
            <section className="rounded-3xl border border-muted bg-surface p-6 sm:p-7 space-y-6 shadow-soft">
              {/* Day Header Row */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-muted/60 pb-5">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono uppercase tracking-wider text-amber-400 font-bold">
                      Day 0{currentDay.dayIndex}
                    </span>
                    <span className="text-muted-foreground/40">•</span>
                    <span className="text-xs font-mono text-muted-foreground">
                      {new Date(currentDay.date).toLocaleDateString("en-US", {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  </div>

                  <h2 className="font-display text-2xl sm:text-3xl text-foreground font-normal tracking-tight">
                    {currentDay.title}
                  </h2>

                  {currentDay.description && (
                    <p className="font-body text-xs sm:text-sm text-muted-foreground mt-1 max-w-xl">
                      {currentDay.description}
                    </p>
                  )}

                  {/* Day Weather & Intensity Tags */}
                  <div className="flex flex-wrap items-center gap-2 mt-3">
                    {currentDay.weatherNote && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-background border border-muted text-[11px] font-sans text-cyan-400">
                        <CloudSun className="w-3.5 h-3.5 text-cyan-400" />
                        <span>{currentDay.weatherNote}</span>
                      </span>
                    )}

                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[10px] font-mono uppercase font-semibold ${
                        currentDay.intensity === "CHALLENGING"
                          ? "bg-rose-500/10 border-rose-500/30 text-rose-400"
                          : currentDay.intensity === "MODERATE"
                          ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                          : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                      }`}
                    >
                      <Flame className="w-3 h-3" />
                      <span>{currentDay.intensity || "MODERATE"} Intensity</span>
                    </span>
                  </div>
                </div>

                {/* Day Actions & Progress Meter */}
                <div className="flex flex-col sm:items-end gap-3 shrink-0">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenEditDay(currentDay)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-background border border-muted hover:border-foreground/30 text-xs font-sans text-foreground transition-colors"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-amber-500" />
                      <span>Edit Day</span>
                    </button>

                    <button
                      onClick={() => handleOpenAddActivity()}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-semibold text-xs font-sans transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Activity</span>
                    </button>

                    {days.length > 1 && (
                      <button
                        onClick={() => removeDay(currentDay.id)}
                        className="p-1.5 rounded-xl bg-background border border-muted hover:border-rose-500 text-muted-foreground hover:text-rose-400 transition-colors"
                        title="Delete Day"
                        aria-label="Delete Day"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Day Progress percentage */}
                  <div className="w-full sm:w-44 space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground">
                      <span>Day Completion</span>
                      <span className="text-foreground font-semibold">
                        {stats.currentDayPercentage}%
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-background border border-muted overflow-hidden">
                      <div
                        className="h-full bg-emerald-400 transition-all duration-300"
                        style={{ width: `${stats.currentDayPercentage}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 3 & 4: HOURLY ACTIVITY TIMELINE BLOCKS (REQ-ITN-03 & REQ-ITN-04) */}
              <div className="space-y-6">
                {TIME_SLOTS.map((slot) => {
                  const slotActivities = currentDay.activities.filter(
                    (a) => a.timeSlot === slot.id
                  );

                  return (
                    <div key={slot.id} className="space-y-3">
                      {/* Slot Header */}
                      <div className="flex items-center justify-between border-b border-muted/40 pb-1.5">
                        <div className="flex items-center gap-2">
                          {slot.icon}
                          <span className="text-xs font-sans font-semibold text-foreground tracking-wide uppercase">
                            {slot.label}
                          </span>
                          <span className="text-[10px] font-mono text-muted-foreground">
                            ({slotActivities.length})
                          </span>
                        </div>

                        <button
                          onClick={() => handleOpenAddActivity(slot.id)}
                          className="inline-flex items-center gap-1 text-[11px] font-sans text-amber-500 hover:text-amber-400 transition-colors py-0.5 px-2 rounded-lg hover:bg-amber-500/10"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Add</span>
                        </button>
                      </div>

                      {/* Slot Activities List */}
                      {slotActivities.length === 0 ? (
                        <div className="py-3 px-4 rounded-xl border border-muted/40 border-dashed bg-background/40 text-[11px] font-sans text-muted-foreground/60 flex items-center justify-between">
                          <span>No activities scheduled for {slot.label.toLowerCase()}.</span>
                          <button
                            onClick={() => handleOpenAddActivity(slot.id)}
                            className="text-amber-500/80 hover:text-amber-400 underline underline-offset-2"
                          >
                            + schedule
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {slotActivities.map((act) => {
                            const isCompleted = act.status === "COMPLETED";
                            const isInProgress = act.status === "IN_PROGRESS";
                            const isSkipped = act.status === "SKIPPED";

                            return (
                              <div
                                key={act.id}
                                className={`p-3.5 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                                  isCompleted
                                    ? "bg-background/80 border-emerald-500/30 opacity-90"
                                    : isInProgress
                                    ? "bg-amber-500/10 border-amber-500/40 ring-1 ring-amber-500/30"
                                    : isSkipped
                                    ? "bg-surface/40 border-muted opacity-50"
                                    : "bg-background border-muted hover:border-foreground/20"
                                }`}
                              >
                                {/* Left Side: Status Toggle + Details */}
                                <div className="flex items-start gap-3 flex-1 min-w-0">
                                  {/* 1-Tap Status Checkbox */}
                                  <button
                                    onClick={() =>
                                      toggleActivityStatus(
                                        currentDay.id,
                                        act.id,
                                        isCompleted ? "PLANNED" : "COMPLETED"
                                      )
                                    }
                                    className={`mt-0.5 w-5 h-5 rounded-lg border flex items-center justify-center transition-colors shrink-0 ${
                                      isCompleted
                                        ? "bg-emerald-500 border-emerald-500 text-neutral-950"
                                        : "border-muted hover:border-amber-500 text-transparent"
                                    }`}
                                    title={isCompleted ? "Mark Planned" : "Mark Completed"}
                                    aria-label="Toggle completed"
                                  >
                                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                                  </button>

                                  <div className="flex-1 min-w-0 space-y-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      {/* Time badge */}
                                      {act.startTime && (
                                        <span className="inline-flex items-center gap-1 text-[10px] font-mono text-muted-foreground bg-surface px-2 py-0.5 rounded border border-muted">
                                          <Clock className="w-3 h-3 text-accent" />
                                          <span>
                                            {act.startTime}
                                            {act.endTime ? ` – ${act.endTime}` : ""}
                                          </span>
                                        </span>
                                      )}

                                      {/* Status pill */}
                                      <select
                                        value={act.status}
                                        onChange={(e) =>
                                          toggleActivityStatus(
                                            currentDay.id,
                                            act.id,
                                            e.target.value as ActivityStatus
                                          )
                                        }
                                        className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded border cursor-pointer focus:outline-hidden ${
                                          isCompleted
                                            ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                                            : isInProgress
                                            ? "bg-amber-500/20 border-amber-500/40 text-amber-400 font-semibold"
                                            : isSkipped
                                            ? "bg-muted border-muted text-muted-foreground"
                                            : "bg-surface border-muted text-foreground"
                                        }`}
                                      >
                                        <option value="PLANNED">Planned</option>
                                        <option value="IN_PROGRESS">In Progress</option>
                                        <option value="COMPLETED">Completed</option>
                                        <option value="SKIPPED">Skipped</option>
                                      </select>
                                    </div>

                                    {/* Activity Title */}
                                    <div
                                      className={`text-sm font-sans font-medium text-foreground ${
                                        isCompleted ? "line-through text-muted-foreground" : ""
                                      }`}
                                    >
                                      {act.title}
                                    </div>

                                    {/* Location & Cost Row */}
                                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                                      {act.location && (
                                        <span className="flex items-center gap-1">
                                          <MapPin className="w-3 h-3 text-amber-500 shrink-0" />
                                          <span>{act.location}</span>
                                        </span>
                                      )}
                                      {act.estimatedCost && act.estimatedCost > 0 ? (
                                        <span className="font-mono text-foreground font-medium">
                                          {trip.currency} {act.estimatedCost.toLocaleString()}
                                        </span>
                                      ) : null}
                                    </div>

                                    {/* Notes */}
                                    {act.notes && (
                                      <p className="text-[11px] text-muted-foreground/80 italic mt-0.5">
                                        &ldquo;{act.notes}&rdquo;
                                      </p>
                                    )}
                                  </div>
                                </div>

                                {/* Right Side: Edit & Delete buttons */}
                                <div className="flex items-center gap-1 self-end sm:self-center shrink-0">
                                  <button
                                    onClick={() => handleOpenEditActivity(act)}
                                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface transition-colors"
                                    title="Edit activity"
                                    aria-label="Edit activity"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => deleteActivity(currentDay.id, act.id)}
                                    className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-400 hover:bg-surface transition-colors"
                                    title="Delete activity"
                                    aria-label="Delete activity"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      )}

      {/* MODAL: ADD / EDIT ACTIVITY */}
      {showAddActivityModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
        >
          <div className="max-w-md w-full p-6 rounded-2xl border border-muted bg-surface shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-muted pb-3">
              <h3 className="font-display text-lg text-foreground font-normal">
                {editingActivity ? "Edit Activity" : "Schedule New Activity"}
              </h3>
              <button
                onClick={() => setShowAddActivityModal(false)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveActivity} className="space-y-4">
              {/* Slot selector */}
              <div className="space-y-1">
                <label className="text-xs font-sans font-medium text-foreground">Time Slot</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {TIME_SLOTS.map((s) => (
                    <button
                      type="button"
                      key={s.id}
                      onClick={() => setActSlot(s.id)}
                      className={`py-2 px-1.5 rounded-xl border text-center transition-all ${
                        actSlot === s.id
                          ? "bg-amber-500/15 border-amber-500/50 text-amber-400 font-semibold"
                          : "bg-background border-muted text-muted-foreground"
                      }`}
                    >
                      <div className="flex justify-center mb-1">{s.icon}</div>
                      <div className="text-[10px] font-sans">{s.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Title */}
              <div className="space-y-1">
                <label className="text-xs font-sans font-medium text-foreground">
                  Activity Title *
                </label>
                <input
                  type="text"
                  value={actTitle}
                  onChange={(e) => setActTitle(e.target.value)}
                  placeholder="e.g. Ascent across Baralacha La Pass"
                  className="w-full px-3 py-2 rounded-xl bg-background border border-muted focus:border-amber-500 focus:outline-hidden text-xs text-foreground"
                  required
                  autoFocus
                />
              </div>

              {/* Times Row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-sans font-medium text-foreground">Start Time</label>
                  <input
                    type="time"
                    value={actStartTime}
                    onChange={(e) => setActStartTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-background border border-muted focus:border-amber-500 focus:outline-hidden text-xs font-mono text-foreground [color-scheme:dark]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-sans font-medium text-foreground">End Time</label>
                  <input
                    type="time"
                    value={actEndTime}
                    onChange={(e) => setActEndTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-background border border-muted focus:border-amber-500 focus:outline-hidden text-xs font-mono text-foreground [color-scheme:dark]"
                  />
                </div>
              </div>

              {/* Location & Cost */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-sans font-medium text-foreground">Location / Landmark</label>
                  <input
                    type="text"
                    value={actLocation}
                    onChange={(e) => setActLocation(e.target.value)}
                    placeholder="e.g. Baralacha La (4,890m)"
                    className="w-full px-3 py-2 rounded-xl bg-background border border-muted focus:border-amber-500 focus:outline-hidden text-xs text-foreground"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-sans font-medium text-foreground">
                    Estimated Cost ({trip.currency})
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={actCost}
                    onChange={(e) => setActCost(parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className="w-full px-3 py-2 rounded-xl bg-background border border-muted focus:border-amber-500 focus:outline-hidden text-xs font-mono text-foreground"
                  />
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <label className="text-xs font-sans font-medium text-foreground">Notes / Reminders</label>
                <textarea
                  rows={2}
                  value={actNotes}
                  onChange={(e) => setActNotes(e.target.value)}
                  placeholder="e.g. Check road condition before crossing. Bring oxygen canister."
                  className="w-full px-3 py-2 rounded-xl bg-background border border-muted focus:border-amber-500 focus:outline-hidden text-xs text-foreground resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-muted">
                <button
                  type="button"
                  onClick={() => setShowAddActivityModal(false)}
                  className="px-3.5 py-2 rounded-xl border border-muted text-xs font-sans text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingActivity}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-semibold text-xs font-sans transition-colors"
                >
                  {isSubmittingActivity ? "Saving..." : editingActivity ? "Update" : "Schedule"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT DAY DETAILS */}
      {showEditDayModal && currentDay && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
        >
          <div className="max-w-md w-full p-6 rounded-2xl border border-muted bg-surface shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-muted pb-3">
              <h3 className="font-display text-lg text-foreground font-normal">
                Edit Day 0{currentDay.dayIndex} Details
              </h3>
              <button
                onClick={() => setShowEditDayModal(false)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveDayDetails} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-sans font-medium text-foreground">Day Theme / Title *</label>
                <input
                  type="text"
                  value={dayTitle}
                  onChange={(e) => setDayTitle(e.target.value)}
                  placeholder="e.g. Day 2 - Manali to Jispa via Atal Tunnel"
                  className="w-full px-3 py-2 rounded-xl bg-background border border-muted focus:border-amber-500 focus:outline-hidden text-xs text-foreground"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-sans font-medium text-foreground">Day Overview Description</label>
                <textarea
                  rows={2}
                  value={dayDescription}
                  onChange={(e) => setDayDescription(e.target.value)}
                  placeholder="Route details, road milestones, scenic highlights..."
                  className="w-full px-3 py-2 rounded-xl bg-background border border-muted focus:border-amber-500 focus:outline-hidden text-xs text-foreground resize-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-sans font-medium text-foreground">Weather Note</label>
                <input
                  type="text"
                  value={dayWeather}
                  onChange={(e) => setDayWeather(e.target.value)}
                  placeholder="e.g. Sunny 14°C at valley, sub-zero winds above 4,000m"
                  className="w-full px-3 py-2 rounded-xl bg-background border border-muted focus:border-amber-500 focus:outline-hidden text-xs text-foreground"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-sans font-medium text-foreground">Physical Intensity Rating</label>
                <div className="grid grid-cols-3 gap-2">
                  {(["RELAXED", "MODERATE", "CHALLENGING"] as const).map((lvl) => (
                    <button
                      type="button"
                      key={lvl}
                      onClick={() => setDayIntensity(lvl)}
                      className={`py-2 rounded-xl border text-center transition-all ${
                        dayIntensity === lvl
                          ? "bg-amber-500/15 border-amber-500/50 text-amber-400 font-semibold"
                          : "bg-background border-muted text-muted-foreground"
                      }`}
                    >
                      <span className="text-[10px] font-mono uppercase">{lvl}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-muted">
                <button
                  type="button"
                  onClick={() => setShowEditDayModal(false)}
                  className="px-3.5 py-2 rounded-xl border border-muted text-xs font-sans text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingDay}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-semibold text-xs font-sans transition-colors"
                >
                  {isSubmittingDay ? "Saving..." : "Save Day"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
