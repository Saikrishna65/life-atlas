"use client";

import React, { useState, useRef } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Trophy,
  Camera,
  Star,
  Plus,
  Trash2,
  Globe,
  Sparkles,
  Calendar,
  MapPin,
  Check,
  X,
  ZoomIn,
  RotateCcw,
  Compass,
  AlertTriangle,
  Heart,
  ImageIcon,
} from "lucide-react";
import { useMemories } from "@/lib/vault/useMemories";
import { TripMemoryRecord } from "@/lib/vault/types";
import { useLockBodyScroll } from "@/lib/vault/useLockBodyScroll";

export default function MemoriesPage() {
  const params = useParams();
  const router = useRouter();
  const tripId = typeof params?.tripId === "string" ? params.tripId : "";

  const {
    trip,
    memories,
    dossierStats,
    isLoading,
    error,
    addMemory,
    removeMemory,
    toggleHighlight,
    markTripCompleted,
    reopenTripStatus,
    exportToPublicJournal,
  } = useMemories(tripId);

  // Filter State
  const [highlightsOnly, setHighlightsOnly] = useState(false);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [activeLightbox, setActiveLightbox] = useState<TripMemoryRecord | null>(null);
  const [memoryToDelete, setMemoryToDelete] = useState<TripMemoryRecord | null>(null);

  // Lock body scroll when any modal is open
  useLockBodyScroll(showAddModal || showExportModal || !!activeLightbox || !!memoryToDelete);

  // Toast / Status
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportResult, setExportResult] = useState<{
    slug: string;
    publicUrl: string;
    memoryCount: number;
  } | null>(null);

  // Add Memory Form State
  const [formTitle, setFormTitle] = useState("");
  const [formDate, setFormDate] = useState("");
  const [formLocation, setFormLocation] = useState("");
  const [formCaption, setFormCaption] = useState("");
  const [formRating, setFormRating] = useState(5);
  const [formIsHighlight, setFormIsHighlight] = useState(false);
  const [formImageDataUrl, setFormImageDataUrl] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Export selection state
  const [selectedMemoryIds, setSelectedMemoryIds] = useState<string[]>([]);

  const showToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 3500);
  };

  // Open Add Memory Modal
  const handleOpenAddModal = () => {
    setFormTitle("");
    const todayIso = new Date().toISOString().slice(0, 10);
    setFormDate(todayIso);
    setFormLocation(trip?.destination || "");
    setFormCaption("");
    setFormRating(5);
    setFormIsHighlight(false);
    setFormImageDataUrl("");
    setShowAddModal(true);
  };

  // Handle Image File Upload (convert to Data URL)
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setActionError("Please select a valid image file (JPEG, PNG, WebP).");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setFormImageDataUrl(result);
    };
    reader.readAsDataURL(file);
  };

  // Submit Add Memory
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) return;

    try {
      setIsSubmitting(true);
      await addMemory({
        title: formTitle.trim(),
        date: formDate ? new Date(formDate).toISOString() : new Date().toISOString(),
        location: formLocation.trim() || undefined,
        caption: formCaption.trim() || undefined,
        imageDataUrl: formImageDataUrl || undefined,
        isHighlight: formIsHighlight,
        rating: formRating,
      });

      setShowAddModal(false);
      showToast("Memory saved to expedition reflection wall!");
    } catch (err) {
      console.error("Failed adding memory:", err);
      setActionError("Failed to save memory.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle Trip Status (Milestone)
  const handleToggleTripCompletion = async () => {
    try {
      if (dossierStats.isCompleted) {
        await reopenTripStatus();
        showToast("Expedition reopened to active status.");
      } else {
        await markTripCompleted();
        showToast("🎉 Congratulations! Expedition marked as COMPLETED!");
      }
    } catch (err) {
      console.error("Failed to toggle completion:", err);
    }
  };

  // Open Export Modal
  const handleOpenExportModal = () => {
    setSelectedMemoryIds(memories.map((m) => m.id));
    setExportResult(null);
    setActionError(null);
    setShowExportModal(true);
  };

  // Toggle selected memory for export
  const toggleSelectMemory = (id: string) => {
    setSelectedMemoryIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // Execute Export to Public Journal (REQ-MEM-03)
  const handleExecuteExport = async () => {
    try {
      setIsExporting(true);
      setActionError(null);
      const res = await exportToPublicJournal(selectedMemoryIds);
      setExportResult({
        slug: res.slug,
        publicUrl: res.publicUrl,
        memoryCount: res.memoryCount,
      });
      showToast("Chronicle successfully exported to public Life Atlas journal!");
    } catch (err: unknown) {
      console.error("Export to public failed:", err);
      const msg = err instanceof Error ? err.message : "Network or database offline";
      setActionError(msg);
    } finally {
      setIsExporting(false);
    }
  };

  const filteredMemories = memories.filter((m) => {
    if (highlightsOnly) return m.isHighlight;
    return true;
  });

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto py-24 text-center text-xs font-mono text-muted-foreground flex items-center justify-center gap-2">
        <div className="w-4 h-4 rounded-full border border-muted border-t-amber-500 animate-spin" />
        <span>Loading expedition archives and memories...</span>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-7 pb-28">
      {/* 1. Header Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-muted pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground mb-1">
            <Link
              href={`/secret/vault/${tripId}`}
              className="hover:text-foreground flex items-center gap-1 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{trip?.title || "Expedition"}</span>
            </Link>
            <span>/</span>
            <span className="text-accent font-medium">Memories</span>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl text-foreground font-normal tracking-tight">
            Memories & Expedition Archives
          </h1>
          <p className="font-body text-xs text-muted-foreground mt-0.5">
            Completed expedition dossier, photo reflection wall, and 1-tap export to public journal.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleOpenExportModal}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-surface border border-muted hover:border-accent text-foreground font-medium text-xs transition-colors shadow-xs"
            title="Export to public journal"
          >
            <Globe className="w-3.5 h-3.5 text-accent" />
            <span>Publish Journal</span>
          </button>

          <button
            onClick={handleOpenAddModal}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-accent hover:bg-accent/90 text-accent-foreground font-medium text-xs transition-colors shadow-xs"
          >
            <Camera className="w-4 h-4" />
            <span>Add Memory</span>
          </button>
        </div>
      </div>

      {successToast && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-mono flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0 text-emerald-700" />
          <span>{successToast}</span>
        </div>
      )}

      {(error || actionError) && (
        <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2 font-mono">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{actionError || error}</span>
        </div>
      )}

      {/* 2. REQ-MEM-01: COMPLETED TRIP DOSSIER CELEBRATION CARD */}
      <section className="p-5 sm:p-6 rounded-3xl border border-muted bg-surface shadow-soft transition-all">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-muted">
          <div className="flex items-start gap-3.5">
            <div className={`p-3 rounded-2xl border shrink-0 ${
              dossierStats.isCompleted
                ? "bg-amber-50 border-amber-200 text-amber-700"
                : "bg-surface border-muted text-muted-foreground"
            }`}>
              <Trophy className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-xl text-foreground font-normal tracking-tight">
                  {dossierStats.isCompleted
                    ? "Expedition Completed & Celebrated!"
                    : "Expedition Dossier & Milestones"}
                </h2>
                {dossierStats.isCompleted && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 font-semibold">
                    ARCHIVED
                  </span>
                )}
              </div>
              <p className="font-body text-xs text-muted-foreground mt-0.5 max-w-xl">
                {dossierStats.isCompleted
                  ? `Expedition marked complete${
                      dossierStats.completionDate
                        ? ` on ${new Date(dossierStats.completionDate).toLocaleDateString()}`
                        : ""
                    }. All telemetry, odometers, expenses, and reflection memories archived.`
                  : "Track expedition progress, road odometer distance, and archive the journey when complete."}
              </p>
            </div>
          </div>

          <button
            onClick={handleToggleTripCompletion}
            className={`px-4 py-2 rounded-xl text-xs font-medium transition-all flex items-center justify-center gap-1.5 shrink-0 shadow-xs ${
              dossierStats.isCompleted
                ? "bg-surface border border-muted text-foreground hover:bg-surface-hover"
                : "bg-accent hover:bg-accent/90 text-accent-foreground"
            }`}
          >
            {dossierStats.isCompleted ? (
              <>
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reopen Expedition</span>
              </>
            ) : (
              <>
                <Trophy className="w-3.5 h-3.5" />
                <span>Mark Expedition Complete</span>
              </>
            )}
          </button>
        </div>

        {/* METRICS DOSSIER GRID */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 pt-5">
          {/* 1. Duration on Road */}
          <div className="p-3.5 rounded-2xl bg-background border border-muted space-y-1">
            <div className="flex items-center gap-1.5 text-muted-foreground text-[10px] font-mono uppercase tracking-wider">
              <Calendar className="w-3.5 h-3.5 text-accent" />
              <span>Days on Road</span>
            </div>
            <div className="text-xl font-bold font-mono text-foreground">
              {dossierStats.daysOnRoad} <span className="text-xs font-normal text-muted-foreground">Days</span>
            </div>
            <p className="text-[10px] text-muted-foreground truncate">
              {trip?.startDate ? new Date(trip.startDate).toLocaleDateString([], { month: "short", day: "numeric" }) : ""}
              {trip?.endDate ? ` – ${new Date(trip.endDate).toLocaleDateString([], { month: "short", day: "numeric" })}` : ""}
            </p>
          </div>

          {/* 2. Total Distance Covered (Telemetry + Segments) */}
          <div className="p-3.5 rounded-2xl bg-background border border-muted space-y-1">
            <div className="flex items-center gap-1.5 text-muted-foreground text-[10px] font-mono uppercase tracking-wider">
              <Compass className="w-3.5 h-3.5 text-teal-700" />
              <span>Distance Covered</span>
            </div>
            <div className="text-xl font-bold font-mono text-foreground">
              {dossierStats.totalDistanceKm > 0 ? (
                <>
                  {dossierStats.totalDistanceKm.toLocaleString()}{" "}
                  <span className="text-xs font-normal text-muted-foreground">km</span>
                </>
              ) : (
                <span className="text-sm font-normal text-muted-foreground">No odometer log</span>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground truncate">
              {dossierStats.rentalDistanceKm > 0 ? `${dossierStats.rentalDistanceKm}km bike` : ""}
              {dossierStats.routeDistanceKm > 0 ? ` • ${dossierStats.routeDistanceKm}km mapped` : ""}
            </p>
          </div>

          {/* 3. Budget & Expenses Spend */}
          <div className="p-3.5 rounded-2xl bg-background border border-muted space-y-1">
            <div className="flex items-center gap-1.5 text-muted-foreground text-[10px] font-mono uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-rose-700" />
              <span>Financial Spend</span>
            </div>
            <div className="text-xl font-bold font-mono text-foreground">
              {trip?.currency || "₹"} {dossierStats.totalSpent.toLocaleString()}
            </div>
            <p className="text-[10px] text-muted-foreground truncate">
              Target: {trip?.currency} {dossierStats.totalBudget.toLocaleString()} (
              {dossierStats.budgetVariance >= 0 ? "Under budget" : "Over budget"})
            </p>
          </div>

          {/* 4. Memories Captured */}
          <div className="p-3.5 rounded-2xl bg-background border border-muted space-y-1">
            <div className="flex items-center gap-1.5 text-muted-foreground text-[10px] font-mono uppercase tracking-wider">
              <Heart className="w-3.5 h-3.5 text-amber-700" />
              <span>Memories & Wall</span>
            </div>
            <div className="text-xl font-bold font-mono text-foreground">
              {dossierStats.memoriesCount} <span className="text-xs font-normal text-muted-foreground">Photos</span>
            </div>
            <p className="text-[10px] text-amber-800 font-medium truncate">
              {dossierStats.highlightsCount} Highlighted Moments ★
            </p>
          </div>
        </div>

        {/* SUB-PROGRESS BARS (Activities, Food, Packing) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 mt-4 border-t border-muted">
          <div className="p-3 rounded-xl bg-background border border-muted text-xs space-y-1.5">
            <div className="flex justify-between text-[11px]">
              <span className="text-muted-foreground">Itinerary Activities</span>
              <span className="font-mono text-foreground font-medium">
                {dossierStats.activitiesCompleted}/{dossierStats.activitiesTotal} ({dossierStats.activityCompletionPct}%)
              </span>
            </div>
            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-accent transition-all duration-500 rounded-full"
                style={{ width: `${dossierStats.activityCompletionPct}%` }}
              />
            </div>
          </div>

          <div className="p-3 rounded-xl bg-background border border-muted text-xs space-y-1.5">
            <div className="flex justify-between text-[11px]">
              <span className="text-muted-foreground">Culinary Delicacies</span>
              <span className="font-mono text-foreground font-medium">
                {dossierStats.dishesTasted}/{dossierStats.dishesTotal} Tasted
              </span>
            </div>
            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-orange-600 transition-all duration-500 rounded-full"
                style={{
                  width: `${
                    dossierStats.dishesTotal > 0
                      ? Math.round((dossierStats.dishesTasted / dossierStats.dishesTotal) * 100)
                      : 0
                  }%`,
                }}
              />
            </div>
          </div>

          <div className="p-3 rounded-xl bg-background border border-muted text-xs space-y-1.5">
            <div className="flex justify-between text-[11px]">
              <span className="text-muted-foreground">Gear Checklist</span>
              <span className="font-mono text-foreground font-medium">
                {dossierStats.packingItemsPacked}/{dossierStats.packingItemsTotal} ({dossierStats.packingReadinessPct}%)
              </span>
            </div>
            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-600 transition-all duration-500 rounded-full"
                style={{ width: `${dossierStats.packingReadinessPct}%` }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* 3. REQ-MEM-02: PHOTO REFLECTION WALL */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl text-foreground font-normal tracking-tight">
              Photo Reflection Wall
            </h2>
            <p className="text-xs text-muted-foreground">
              Expedition milestones, landscape snapshots, and campfire reflections.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setHighlightsOnly(!highlightsOnly)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-sans transition-colors ${
                highlightsOnly
                  ? "bg-accent border-accent text-accent-foreground font-medium"
                  : "bg-surface border-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              <Star className="w-3.5 h-3.5 text-amber-500" />
              <span>Highlights Only</span>
            </button>

            <button
              onClick={handleOpenAddModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface hover:bg-surface-hover border border-muted text-xs font-sans text-foreground transition-colors shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Photo</span>
            </button>
          </div>
        </div>

        {memories.length === 0 ? (
          <div className="p-12 rounded-3xl bg-surface border border-muted text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center mx-auto">
              <Camera className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-display text-base text-foreground font-normal">
                Your Reflection Wall is Empty
              </h3>
              <p className="font-body text-xs text-muted-foreground max-w-sm mx-auto mt-1">
                Upload your favorite expedition photos, riding moments, and mountain pass memories.
              </p>
            </div>
            <button
              onClick={handleOpenAddModal}
              className="px-4 py-2 rounded-xl bg-accent hover:bg-accent/90 text-accent-foreground font-medium text-xs transition-colors shadow-xs"
            >
              Add First Memory
            </button>
          </div>
        ) : filteredMemories.length === 0 ? (
          <div className="p-8 rounded-2xl bg-surface border border-muted text-center text-xs text-muted-foreground font-body">
            No memories tagged as &quot;Highlights&quot;. Toggle &quot;Highlights Only&quot; off to view all photos.
          </div>
        ) : (
          /* MASONRY / DYNAMIC RESPONSIVE GRID */
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {filteredMemories.map((mem) => {
              const memDate = new Date(mem.date);
              return (
                <div
                  key={mem.id}
                  className="group rounded-3xl bg-surface border border-muted hover:border-amber-500/40 transition-all overflow-hidden shadow-xs flex flex-col"
                >
                  {/* Photo Thumbnail / Placeholder */}
                  <div className="relative aspect-4/3 w-full bg-background overflow-hidden">
                    {mem.imageDataUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={mem.imageDataUrl}
                        alt={mem.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground/40 gap-1">
                        <ImageIcon className="w-8 h-8" />
                        <span className="text-[10px] font-mono">No Image</span>
                      </div>
                    )}

                    {/* Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-between p-3">
                      <button
                        onClick={() => setActiveLightbox(mem)}
                        className="p-2 rounded-xl bg-black/60 backdrop-blur-xs text-white hover:text-amber-400 transition-colors"
                        title="View Fullscreen"
                      >
                        <ZoomIn className="w-4 h-4" />
                      </button>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => toggleHighlight(mem.id)}
                          className={`p-2 rounded-xl backdrop-blur-xs transition-colors ${
                            mem.isHighlight
                              ? "bg-amber-500 text-black"
                              : "bg-black/60 text-white hover:text-amber-400"
                          }`}
                          title="Toggle Highlight"
                        >
                          <Star className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setMemoryToDelete(mem)}
                          className="p-2 rounded-xl bg-black/60 backdrop-blur-xs text-white hover:text-rose-400 transition-colors"
                          title="Delete Memory"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Highlight Badge */}
                    {mem.isHighlight && (
                      <div className="absolute top-3 left-3 px-2 py-0.5 rounded-full bg-amber-500/90 text-black font-semibold text-[10px] flex items-center gap-1 shadow-xs">
                        <Star className="w-3 h-3 fill-current" />
                        <span>Highlight</span>
                      </div>
                    )}

                    {/* Rating Badge */}
                    {mem.rating && (
                      <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-xs text-amber-400 text-[10px] font-mono">
                        {"★".repeat(mem.rating)}
                      </div>
                    )}
                  </div>

                  {/* Card Content */}
                  <div className="p-4 space-y-2 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-sans font-semibold text-sm text-foreground line-clamp-1">
                          {mem.title}
                        </h3>
                      </div>

                      {mem.caption && (
                        <p className="font-body text-xs text-muted-foreground mt-1 line-clamp-2">
                          {mem.caption}
                        </p>
                      )}
                    </div>

                    <div className="pt-2 border-t border-muted/50 flex items-center justify-between text-[11px] font-mono text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-muted-foreground" />
                        <span>
                          {memDate.toLocaleDateString([], {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      </div>

                      {mem.location && (
                        <div className="flex items-center gap-1 truncate max-w-[140px] text-amber-400">
                          <MapPin className="w-3 h-3 shrink-0" />
                          <span className="truncate">{mem.location}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 4. REQ-MEM-03: EXPORT TO PUBLIC JOURNAL MODAL */}
      {showExportModal && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setShowExportModal(false)}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overscroll-contain animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl rounded-3xl bg-surface border border-muted p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-muted pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-accent/10 border border-accent/20 text-accent">
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-display text-xl text-foreground font-normal">
                    Export to Public Journal
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    Convert selected vault memories into public Life Atlas journal entries.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowExportModal(false)}
                className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-background transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {exportResult ? (
              /* Success State */
              <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
                  <Check className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-display text-lg text-emerald-950 font-normal">
                    Expedition Chronicle Published!
                  </h4>
                  <p className="font-body text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                    Successfully wrote trip, {exportResult.memoryCount} memories, timeline events, and photos to Prisma Postgres.
                  </p>
                </div>

                <div className="flex items-center justify-center gap-3 pt-2">
                  <a
                    href={exportResult.publicUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-2 rounded-xl bg-accent hover:bg-accent/90 text-accent-foreground font-medium text-xs transition-colors inline-flex items-center gap-1.5 shadow-xs"
                  >
                    <Globe className="w-3.5 h-3.5" />
                    <span>View Live Chronicle</span>
                  </a>
                  <button
                    onClick={() => setShowExportModal(false)}
                    className="px-4 py-2 rounded-xl border border-muted text-xs text-muted-foreground hover:text-foreground"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              /* Configuration & Selection */
              <div className="space-y-4">
                <div className="p-3.5 rounded-2xl bg-background border border-muted text-xs space-y-1 font-body">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Trip Title:</span>
                    <span className="font-medium text-foreground">{trip?.title}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Destination:</span>
                    <span className="font-medium text-foreground">{trip?.destination}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Dates:</span>
                    <span className="font-mono text-foreground">
                      {trip?.startDate ? new Date(trip.startDate).toLocaleDateString() : ""}
                      {trip?.endDate ? ` – ${new Date(trip.endDate).toLocaleDateString()}` : ""}
                    </span>
                  </div>
                </div>

                {/* Memories Selection Checklist */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono uppercase tracking-wider text-muted-foreground">
                      Select Memories to Include ({selectedMemoryIds.length}/{memories.length})
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedMemoryIds(
                          selectedMemoryIds.length === memories.length
                            ? []
                            : memories.map((m) => m.id)
                        )
                      }
                      className="text-accent hover:underline text-[11px] font-medium"
                    >
                      {selectedMemoryIds.length === memories.length ? "Deselect All" : "Select All"}
                    </button>
                  </div>

                  <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 [scrollbar-width:thin]">
                    {memories.map((m) => {
                      const isSelected = selectedMemoryIds.includes(m.id);
                      return (
                        <div
                          key={m.id}
                          onClick={() => toggleSelectMemory(m.id)}
                          className={`p-2.5 rounded-xl border text-xs cursor-pointer transition-colors flex items-center justify-between gap-2 ${
                            isSelected
                              ? "bg-accent/10 border-accent/40 text-foreground"
                              : "bg-background border-muted text-muted-foreground"
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              className="rounded border-muted text-accent focus:ring-accent shrink-0 pointer-events-none"
                            />
                            <span className="truncate font-medium">{m.title}</span>
                          </div>
                          {m.imageDataUrl && (
                            <span className="text-[10px] font-mono text-accent shrink-0 font-medium">
                              + Photo
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {actionError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-mono">
                    {actionError}
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-muted">
                  <button
                    type="button"
                    onClick={() => setShowExportModal(false)}
                    className="px-4 py-2 rounded-xl border border-muted text-xs font-sans text-muted-foreground hover:text-foreground"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleExecuteExport}
                    disabled={isExporting}
                    className="px-5 py-2 rounded-xl bg-accent hover:bg-accent/90 text-accent-foreground font-medium text-xs transition-colors flex items-center gap-1.5 disabled:opacity-50 shadow-xs"
                  >
                    {isExporting ? (
                      <>
                        <div className="w-3.5 h-3.5 rounded-full border border-white border-t-transparent animate-spin" />
                        <span>Publishing...</span>
                      </>
                    ) : (
                      <>
                        <Globe className="w-3.5 h-3.5" />
                        <span>Publish Public Journal</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5. MODAL: ADD MEMORY WITH PHOTO */}
      {showAddModal && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setShowAddModal(false)}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overscroll-contain animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-3xl bg-surface border border-muted p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-muted pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-accent/10 border border-accent/20 text-accent">
                  <Camera className="w-5 h-5" />
                </div>
                <h3 className="font-display text-xl text-foreground font-normal">
                  Capture Expedition Memory
                </h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-background transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-4">
              {/* Photo Upload / Preview */}
              <div>
                <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground block mb-1">
                  Photo Attachment
                </label>
                {formImageDataUrl ? (
                  <div className="relative aspect-16/9 rounded-2xl overflow-hidden bg-background border border-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={formImageDataUrl}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setFormImageDataUrl("")}
                      className="absolute top-2 right-2 p-1.5 rounded-xl bg-black/70 text-white hover:text-rose-400"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-muted hover:border-accent rounded-2xl p-6 text-center cursor-pointer transition-colors bg-background/50 hover:bg-background"
                  >
                    <Camera className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                    <span className="text-xs text-foreground font-medium block">
                      Choose Photo or Take Picture
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      JPEG, PNG, WebP supported
                    </span>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="hidden"
                    />
                  </div>
                )}
              </div>

              {/* Memory Title */}
              <div>
                <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground block mb-1">
                  Memory Title *
                </label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. Sunset at Kunzum Pass, Breakfast with Monks"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-muted text-sm font-sans text-foreground focus:outline-hidden focus:border-accent"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Date */}
                <div>
                  <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground block mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-background border border-muted text-xs font-mono text-foreground focus:outline-hidden focus:border-accent"
                  />
                </div>

                {/* Location */}
                <div>
                  <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground block mb-1">
                    Location
                  </label>
                  <input
                    type="text"
                    value={formLocation}
                    onChange={(e) => setFormLocation(e.target.value)}
                    placeholder="e.g. Spiti Valley"
                    className="w-full px-3.5 py-2 rounded-xl bg-background border border-muted text-xs font-sans text-foreground focus:outline-hidden focus:border-accent"
                  />
                </div>
              </div>

              {/* Caption / Journal Notes */}
              <div>
                <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground block mb-1">
                  Caption / Journal Notes
                </label>
                <textarea
                  rows={2}
                  value={formCaption}
                  onChange={(e) => setFormCaption(e.target.value)}
                  placeholder="Tell the story of this moment..."
                  className="w-full px-3.5 py-2 rounded-xl bg-background border border-muted text-xs font-sans text-foreground focus:outline-hidden focus:border-accent resize-none"
                />
              </div>

              {/* Star Rating & Highlight Toggle */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-background border border-muted">
                <div>
                  <label className="text-[11px] font-mono text-muted-foreground block mb-1">
                    Rating
                  </label>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setFormRating(s)}
                        className={`text-base transition-colors ${
                          s <= formRating ? "text-amber-500" : "text-muted-foreground/30"
                        }`}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                </div>

                <label className="flex items-center gap-2 cursor-pointer text-xs font-sans text-foreground">
                  <input
                    type="checkbox"
                    checked={formIsHighlight}
                    onChange={(e) => setFormIsHighlight(e.target.checked)}
                    className="rounded border-muted text-accent focus:ring-accent"
                  />
                  <span>Expedition Highlight ★</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-muted">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl border border-muted text-xs font-sans text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !formTitle.trim()}
                  className="px-5 py-2 rounded-xl bg-accent hover:bg-accent/90 text-accent-foreground font-medium text-xs transition-colors disabled:opacity-50 shadow-xs"
                >
                  {isSubmitting ? "Saving..." : "Save Memory"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. FULLSCREEN LIGHTBOX PREVIEW */}
      {activeLightbox && (
        <div
          onClick={() => setActiveLightbox(null)}
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex items-center justify-center p-4 overscroll-contain animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-3xl space-y-4 animate-in fade-in zoom-in-95 duration-200"
          >
            <div className="flex items-center justify-between text-white pb-2">
              <div className="truncate">
                <h3 className="font-display text-xl text-white font-normal truncate">
                  {activeLightbox.title}
                </h3>
                <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground mt-0.5">
                  <span>{new Date(activeLightbox.date).toLocaleDateString()}</span>
                  {activeLightbox.location && <span>• {activeLightbox.location}</span>}
                </div>
              </div>
              <button
                onClick={() => setActiveLightbox(null)}
                className="p-2 rounded-xl bg-surface/50 text-white hover:text-amber-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {activeLightbox.imageDataUrl && (
              <div className="relative max-h-[65vh] rounded-2xl overflow-hidden bg-black flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={activeLightbox.imageDataUrl}
                  alt={activeLightbox.title}
                  className="max-h-[65vh] w-auto object-contain rounded-2xl shadow-2xl"
                />
              </div>
            )}

            {activeLightbox.caption && (
              <div className="p-4 rounded-2xl bg-surface/80 border border-muted text-white text-xs font-body">
                {activeLightbox.caption}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 7. DELETE CONFIRMATION MODAL */}
      {memoryToDelete && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setMemoryToDelete(null)}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overscroll-contain animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-3xl bg-surface border border-muted p-5 space-y-4 shadow-2xl"
          >
            <div className="flex items-center gap-2 text-rose-600">
              <Trash2 className="w-5 h-5" />
              <h3 className="font-display text-lg text-foreground font-normal">
                Delete Memory?
              </h3>
            </div>
            <p className="text-xs text-muted-foreground">
              Are you sure you want to delete &quot;{memoryToDelete.title}&quot;? This cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-muted">
              <button
                onClick={() => setMemoryToDelete(null)}
                className="px-3 py-1.5 rounded-xl border border-muted text-xs font-sans text-muted-foreground hover:text-foreground"
              >
                Keep
              </button>
              <button
                onClick={async () => {
                  await removeMemory(memoryToDelete.id);
                  setMemoryToDelete(null);
                  showToast("Memory deleted.");
                }}
                className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-medium text-xs transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
