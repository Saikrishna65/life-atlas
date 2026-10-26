"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Sparkles,
  Ticket,
  Bot,
  MapPin,
  AlertTriangle,
  Check,
  Copy,
  Plus,
  Lock,
  ChevronRight,
  ShieldCheck,
  Zap,
  RotateCcw,
  WifiOff,
  Train,
  Plane,
  Bus,
  Home,
} from "lucide-react";
import { getTrip, saveBooking } from "@/lib/vault/storage";
import {
  TripRecord,
  TravelStyle,
  AIPendingPlan,
  PNRParseResult,
  BookingRecord,
  TransportType,
} from "@/lib/vault/types";
import {
  generateExpeditionItinerary,
  importPlanIntoVaultItinerary,
} from "@/lib/vault/aiItinerary";
import {
  parseBookingText,
  SAMPLE_CONFIRMATION_TEXTS,
} from "@/lib/vault/pnrParser";
import { notifyVaultChange } from "@/lib/vault/useTripVault";
import { revokeSecretAccess } from "@/lib/deviceAuth";
import { Select } from "@/components/ui/Select";
import { getTripDayCount } from "@/lib/vault/tripDuration";

type AssistantTab = "ITINERARY" | "PARSER";

export default function AssistantPage() {
  const params = useParams();
  const router = useRouter();
  const tripId = typeof params?.tripId === "string" ? params.tripId : "";

  const [trip, setTrip] = useState<TripRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<AssistantTab>("ITINERARY");

  // Itinerary Generator Form State
  const [destInput, setDestInput] = useState("");
  const [durationInput, setDurationInput] = useState(5);
  const [styleInput, setStyleInput] = useState<TravelStyle>("BACKPACKING");
  const [intensityInput, setIntensityInput] = useState<"RELAXED" | "MODERATE" | "CHALLENGING">("MODERATE");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedPlan, setGeneratedPlan] = useState<AIPendingPlan | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);

  // PNR Parser State
  const [rawPastedText, setRawPastedText] = useState("");
  const [parsedResult, setParsedResult] = useState<PNRParseResult | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [copiedPNR, setCopiedPNR] = useState(false);
  const [isAddingBooking, setIsAddingBooking] = useState(false);
  const [bookingAddedSuccess, setBookingAddedSuccess] = useState<string | null>(null);

  // Error & Status
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!tripId) return;
        const data = await getTrip(tripId);
        if (mounted && data) {
          setTrip(data);
          setDestInput(data.destination || "");
          setStyleInput(data.travelStyle || "BACKPACKING");
          if (data.startDate && data.endDate) {
            const count = getTripDayCount(data.startDate, data.endDate).calendarDays;
            setDurationInput(count);
          }
        }
      } catch (err) {
        console.error("Failed loading trip for assistant:", err);
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [tripId]);

  const handleLockVault = () => {
    revokeSecretAccess();

    router.push("/secret/vault");
  };

  // Generate Itinerary Action (REQ-AIX-01)
  const handleGenerateItinerary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!destInput.trim()) return;

    try {
      setIsGenerating(true);
      setErrorMsg(null);
      setImportSuccess(null);

      const plan = await generateExpeditionItinerary({
        destination: destInput.trim(),
        durationDays: durationInput,
        travelStyle: styleInput,
        intensity: intensityInput,
      });

      setGeneratedPlan(plan);
    } catch (err: unknown) {
      console.error("Failed generating itinerary:", err);
      const msg = err instanceof Error ? err.message : "Generation failed";
      setErrorMsg(msg);
    } finally {
      setIsGenerating(false);
    }
  };

  // Import Plan into Vault
  const handleImportPlan = async () => {
    if (!generatedPlan || !tripId) return;

    try {
      setIsImporting(true);
      const result = await importPlanIntoVaultItinerary(tripId, generatedPlan, trip?.startDate);
      setImportSuccess(`Successfully imported ${result.daysCreated} itinerary days and ${result.gearCreated} gear recommendations into your trip vault!`);
    } catch (err) {
      console.error("Failed importing plan:", err);
      setErrorMsg("Failed to write generated itinerary to IndexedDB.");
    } finally {
      setIsImporting(false);
    }
  };

  // Parse Raw Text Action (REQ-AIX-02)
  const handleParseText = () => {
    if (!rawPastedText.trim()) return;
    setIsParsing(true);
    setBookingAddedSuccess(null);

    try {
      const result = parseBookingText(rawPastedText);
      setParsedResult(result);
    } catch (err) {
      console.error("Failed parsing text:", err);
      setErrorMsg("Failed to parse confirmation text.");
    } finally {
      setIsParsing(false);
    }
  };

  // Load Sample Text
  const handleLoadSample = (sampleText: string) => {
    setRawPastedText(sampleText);
    const result = parseBookingText(sampleText);
    setParsedResult(result);
    setBookingAddedSuccess(null);
  };

  // Copy PNR
  const handleCopyPNR = (pnr: string) => {
    navigator.clipboard.writeText(pnr);
    setCopiedPNR(true);
    setTimeout(() => setCopiedPNR(false), 2000);
  };

  // 1-Click Auto-Fill & Add to Vault Bookings
  const handleAddBookingToVault = async () => {
    if (!parsedResult || !tripId) return;

    try {
      setIsAddingBooking(true);
      const now = new Date().toISOString();
      const bookingId = `bkg_parse_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

      let depTimeIso = trip?.startDate || now;
      if (parsedResult.departureDate) {
        try {
          depTimeIso = new Date(parsedResult.departureDate).toISOString();
        } catch {
          depTimeIso = trip?.startDate || now;
        }
      }

      const newBooking: BookingRecord = {
        id: bookingId,
        tripId,
        category: parsedResult.category,
        type: (parsedResult.transportType || "TRAIN") as TransportType,
        title: `${parsedResult.carrier || "Transport"} ${parsedResult.trainOrFlightNumber || ""}`.trim() || "Expedition Booking",
        carrierOrVendor: parsedResult.carrier,
        pnrNumber: parsedResult.pnrNumber || undefined,
        seatOrRoomDetails: parsedResult.coachBerthDetails || parsedResult.seatNumbers || undefined,
        departureOrPropertyAddress: parsedResult.departureStation || undefined,
        arrivalAddress: parsedResult.arrivalStation || undefined,
        departureOrCheckInTime: depTimeIso,
        totalCost: parsedResult.totalFare || 0,
        currency: trip?.currency || "INR",
        depositPaid: 0,
        balanceDue: 0,
        status: "CONFIRMED",
        notes: `Parsed by AI Assistant from: ${parsedResult.rawText?.slice(0, 80)}...`,
        createdAt: now,
        updatedAt: now,
      };

      await saveBooking(newBooking);
      notifyVaultChange();
      setBookingAddedSuccess(`Booking "${newBooking.title}" with PNR ${parsedResult.pnrNumber || "N/A"} saved to Vault!`);
    } catch (err) {
      console.error("Failed adding parsed booking:", err);
      setErrorMsg("Failed to save booking to IndexedDB.");
    } finally {
      setIsAddingBooking(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto py-24 text-center text-xs font-mono text-muted-foreground flex items-center justify-center gap-2">
        <div className="w-4 h-4 rounded-full border border-muted border-t-amber-500 animate-spin" />
        <span>Initializing Expedition AI Assistant...</span>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-28">
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
            <span className="text-purple-700 font-medium">Pillar 13</span>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl text-foreground font-normal tracking-tight">
            AI Expedition Assistant & Smart Parser
          </h1>
          <p className="font-body text-xs text-muted-foreground mt-0.5">
            Neon AI Gateway powered itinerary generator & offline PNR confirmation ticket extractor.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleLockVault}
            className="p-2 rounded-xl bg-background border border-muted text-muted-foreground hover:text-foreground transition-colors"
            title="Lock Vault"
          >
            <Lock className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 2. TAB CONTROLS (Mobile Responsive Segmented Control) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-1.5 rounded-2xl bg-surface border border-muted shadow-soft">
        <button
          type="button"
          onClick={() => setActiveTab("ITINERARY")}
          className={`w-full flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl text-xs sm:text-sm font-medium transition-all cursor-pointer ${activeTab === "ITINERARY"
              ? "bg-purple-600 text-white shadow-md font-semibold"
              : "text-muted-foreground hover:text-foreground hover:bg-surface-hover"
            }`}
        >
          <Sparkles className="w-4 h-4 shrink-0 text-purple-200" />
          <span className="truncate">AI Itinerary Architect</span>
          <span className="text-[10px] opacity-80 font-mono px-1.5 py-0.5 rounded-md bg-purple-700/60 hidden md:inline">Pillar 13</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("PARSER")}
          className={`w-full flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl text-xs sm:text-sm font-medium transition-all cursor-pointer ${activeTab === "PARSER"
              ? "bg-cyan-600 text-white shadow-md font-semibold"
              : "text-muted-foreground hover:text-foreground hover:bg-surface-hover"
            }`}
        >
          <Ticket className="w-4 h-4 shrink-0 text-cyan-200" />
          <span className="truncate">Smart Ticket & PNR Parser</span>
          <span className="text-[10px] opacity-80 font-mono px-1.5 py-0.5 rounded-md bg-cyan-700/60 hidden md:inline">Offline</span>
        </button>
      </div>

      {errorMsg && (
        <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2 font-mono">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* 3. TAB 1: AI ITINERARY ARCHITECT */}
      {activeTab === "ITINERARY" && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Generation Parameters Card */}
          <div className="p-4 sm:p-6 rounded-3xl bg-surface border border-muted shadow-soft space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-muted/50">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-600 shrink-0">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-display text-lg sm:text-xl text-foreground font-normal">
                    Expedition Itinerary Architect
                  </h3>
                  <p className="font-body text-xs text-muted-foreground mt-0.5">
                    Generate day-by-day itineraries, pass crossing timelines, and essential gear suggestions.
                  </p>
                </div>
              </div>

              {/* Graceful Offline Indicator */}
              <div className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-1 rounded-full bg-background border border-muted text-[10px] font-mono text-muted-foreground">
                <Zap className="w-3 h-3 text-purple-600" />
                <span>Neon AI Gateway / Offline Engine</span>
              </div>
            </div>

            <form onSubmit={handleGenerateItinerary} className="space-y-4 pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                {/* Destination */}
                <div>
                  <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground block mb-1">
                    Destination *
                  </label>
                  <input
                    type="text"
                    required
                    value={destInput}
                    onChange={(e) => setDestInput(e.target.value)}
                    placeholder="e.g. Spiti Valley, Ladakh, Meghalaya"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-muted text-xs font-sans text-foreground focus:outline-hidden focus:border-purple-500/50"
                  />
                </div>

                {/* Duration */}
                <div>
                  <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground block mb-1">
                    Duration (Days)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={durationInput}
                    onChange={(e) => setDurationInput(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-muted text-xs font-mono text-foreground focus:outline-hidden"
                  />
                </div>

                {/* Travel Style */}
                <div>
                  <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground block mb-1">
                    Travel Style
                  </label>
                  <Select
                    value={styleInput}
                    onChange={(e) => setStyleInput(e.target.value as TravelStyle)}
                    className="w-full"
                  >
                    <option value="BACKPACKING">Backpacking & Public Transit</option>
                    <option value="ROADTRIP">Self-Drive 4x4 Roadtrip</option>
                    <option value="TREKKING">Alpine Trekking</option>
                    <option value="MOTORCYCLE">Motorcycle Expedition</option>
                    <option value="LEISURE">Leisure & Heritage</option>
                  </Select>
                </div>

                {/* Intensity */}
                <div>
                  <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground block mb-1">
                    Expedition Pace
                  </label>
                  <Select
                    value={intensityInput}
                    onChange={(e) => setIntensityInput(e.target.value as "RELAXED" | "MODERATE" | "CHALLENGING")}
                    className="w-full"
                  >
                    <option value="RELAXED">Relaxed (Slow Exploration)</option>
                    <option value="MODERATE">Moderate (Balanced Circuit)</option>
                    <option value="CHALLENGING">Challenging (High Passes & Hard Treks)</option>
                  </Select>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-muted/50">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-muted-foreground mr-1">Quick Presets:</span>
                  {["Spiti Valley", "Ladakh", "Meghalaya"].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        setDestInput(preset);
                        if (preset === "Spiti Valley") setDurationInput(8);
                        if (preset === "Ladakh") setDurationInput(6);
                        if (preset === "Meghalaya") setDurationInput(5);
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-background border border-muted hover:border-purple-400 text-[11px] font-mono text-purple-600 hover:text-purple-700 transition-colors cursor-pointer"
                    >
                      {preset}
                    </button>
                  ))}
                </div>

                <button
                  type="submit"
                  disabled={isGenerating || !destInput.trim()}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs transition-all flex items-center justify-center gap-2 shadow-xs disabled:opacity-50 cursor-pointer active:scale-[0.98]"
                >
                  {isGenerating ? (
                    <>
                      <div className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                      <span>Synthesizing Expedition Plan...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-purple-100" />
                      <span>Generate Itinerary Plan</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {importSuccess && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-mono flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>{importSuccess}</span>
              </div>
              <Link
                href={`/secret/vault/${tripId}/itinerary`}
                className="px-3 py-1.5 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-900 text-xs font-sans transition-colors inline-flex items-center gap-1 font-medium"
              >
                <span>View in Itinerary</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}

          {/* Rendered Plan Preview */}
          {generatedPlan && (
            <div className="p-4 sm:p-6 rounded-3xl bg-surface border border-muted space-y-5 shadow-soft animate-in fade-in duration-300">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-muted">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-display text-lg sm:text-xl text-foreground font-normal">
                      {generatedPlan.destination} Expedition Blueprint
                    </h3>
                    {generatedPlan.isOfflineFallback && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-600 flex items-center gap-1 font-medium">
                        <WifiOff className="w-3 h-3 text-amber-600" />
                        <span>Curated Offline Plan</span>
                      </span>
                    )}
                  </div>
                  <p className="font-body text-xs text-muted-foreground mt-0.5">
                    {generatedPlan.durationDays} Days • {generatedPlan.travelStyle} • Est. Budget: ₹{generatedPlan.budgetEstimate.toLocaleString()}
                  </p>
                </div>

                <button
                  onClick={handleImportPlan}
                  disabled={isImporting}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-2 shrink-0 shadow-xs disabled:opacity-50 cursor-pointer active:scale-[0.98]"
                >
                  {isImporting ? (
                    <>
                      <div className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                      <span>Writing to Vault...</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      <span>Accept & Import to Vault Itinerary</span>
                    </>
                  )}
                </button>
              </div>

              {/* Day-by-Day Timeline */}
              <div className="space-y-3">
                <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground block">
                  Day-by-Day Route & Activities
                </span>
                <div className="space-y-3">
                  {generatedPlan.generatedDays.map((d) => (
                    <div
                      key={d.dayNumber}
                      className="p-4 rounded-2xl bg-background border border-muted hover:border-purple-500/30 transition-all space-y-2.5"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-purple-500/15 text-purple-600 border border-purple-500/30 text-xs font-mono font-bold flex items-center justify-center shrink-0">
                            {d.dayNumber}
                          </span>
                          <span className="font-sans font-semibold text-sm text-foreground">
                            {d.title}
                          </span>
                        </div>
                        {d.suggestedStayArea && (
                          <div className="flex items-center gap-1 text-[11px] font-mono text-muted-foreground self-start sm:self-auto pl-8 sm:pl-0">
                            <MapPin className="w-3 h-3 text-amber-600 shrink-0" />
                            <span>Stay: {d.suggestedStayArea}</span>
                          </div>
                        )}
                      </div>

                      {/* Highlights */}
                      {d.highlights && d.highlights.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {d.highlights.map((h, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 rounded-md bg-surface border border-muted text-[10px] text-muted-foreground font-body"
                            >
                              • {h}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Activities */}
                      {d.activities && d.activities.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1">
                          {d.activities.map((act, idx) => (
                            <div
                              key={idx}
                              className="p-2.5 rounded-xl bg-surface/50 border border-muted/50 text-xs space-y-1"
                            >
                              <div className="flex items-center justify-between text-[10px] font-mono text-purple-600 font-medium">
                                <span>{act.timeSlot}</span>
                                {act.startTime && <span>{act.startTime}</span>}
                              </div>
                              <p className="font-medium text-foreground text-xs line-clamp-2">
                                {act.title}
                              </p>
                              {act.notes && (
                                <p className="text-[10px] text-muted-foreground line-clamp-1">
                                  {act.notes}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Recommended Gear & Advisories Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                {/* Gear */}
                <div className="p-4 rounded-2xl bg-background border border-muted space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider text-muted-foreground">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>Recommended Expedition Gear</span>
                  </div>
                  <ul className="space-y-1 text-xs text-muted-foreground font-body">
                    {generatedPlan.suggestedGear.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <span className="text-emerald-600 font-bold">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Advisories */}
                <div className="p-4 rounded-2xl bg-background border border-muted space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider text-muted-foreground">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span>Route & Terrain Advisories</span>
                  </div>
                  <ul className="space-y-1 text-xs text-muted-foreground font-body">
                    {generatedPlan.localAdvisories.map((adv, idx) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <span className="text-amber-600 font-bold">•</span>
                        <span>{adv}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 4. TAB 2: SMART TICKET & PNR PARSER */}
      {activeTab === "PARSER" && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="p-4 sm:p-6 rounded-3xl bg-surface border border-muted shadow-soft space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-muted/50">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-600 shrink-0">
                  <Ticket className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-display text-lg sm:text-xl text-foreground font-normal">
                    Smart PNR & Confirmation Parser
                  </h3>
                  <p className="font-body text-xs text-muted-foreground mt-0.5">
                    Paste raw SMS, WhatsApp, or email ticket confirmations. Extracts PNR, berth, time, and fare 100% offline.
                  </p>
                </div>
              </div>

              <div className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-1 rounded-full bg-background border border-cyan-500/30 text-[10px] font-mono text-cyan-600 font-medium">
                <ShieldCheck className="w-3 h-3 text-cyan-600" />
                <span>Zero-Cloud Local Parser</span>
              </div>
            </div>

            {/* Quick Sample Buttons */}
            <div className="space-y-1.5 pt-1">
              <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground block">
                Load Test Ticket Samples:
              </span>
              <div className="flex flex-wrap gap-2">
                {SAMPLE_CONFIRMATION_TEXTS.map((sample) => (
                  <button
                    key={sample.id}
                    type="button"
                    onClick={() => handleLoadSample(sample.text)}
                    className="px-3 py-1.5 rounded-xl bg-background border border-muted hover:border-cyan-400 text-xs font-sans text-cyan-700 hover:text-cyan-900 transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>{sample.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Textarea Input */}
            <div className="space-y-2">
              <textarea
                rows={4}
                value={rawPastedText}
                onChange={(e) => setRawPastedText(e.target.value)}
                placeholder="Paste your IRCTC Train SMS, IndiGo/Air India email confirmation, Zingbus booking SMS, or hotel stay voucher here..."
                className="w-full px-4 py-3 rounded-2xl bg-background border border-muted text-xs sm:text-sm font-mono text-foreground focus:outline-hidden focus:border-cyan-500/50 resize-none"
              />

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setRawPastedText("");
                    setParsedResult(null);
                    setBookingAddedSuccess(null);
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 self-start sm:self-auto cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Clear Input</span>
                </button>

                <button
                  type="button"
                  onClick={handleParseText}
                  disabled={isParsing || !rawPastedText.trim()}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-50 cursor-pointer active:scale-[0.98]"
                >
                  {isParsing ? (
                    <>
                      <div className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                      <span>Parsing...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-3.5 h-3.5" />
                      <span>Parse Ticket Data</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {bookingAddedSuccess && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-mono flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>{bookingAddedSuccess}</span>
              </div>
              <Link
                href={`/secret/vault/${tripId}/bookings`}
                className="px-3 py-1.5 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-900 text-xs font-sans transition-colors inline-flex items-center gap-1 font-medium shrink-0"
              >
                <span>View Bookings</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}

          {/* Parsed Result Display */}
          {parsedResult && (
            <div className="p-4 sm:p-6 rounded-3xl bg-surface border border-muted space-y-5 shadow-soft animate-in fade-in duration-300">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-muted">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-600 shrink-0">
                    {parsedResult.transportType === "FLIGHT" ? (
                      <Plane className="w-5 h-5" />
                    ) : parsedResult.transportType === "BUS" ? (
                      <Bus className="w-5 h-5" />
                    ) : parsedResult.category === "ACCOMMODATION" ? (
                      <Home className="w-5 h-5" />
                    ) : (
                      <Train className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-display text-lg sm:text-xl text-foreground font-normal">
                      {parsedResult.carrier || "Extracted Booking Record"}
                    </h3>
                    <p className="font-body text-xs text-muted-foreground mt-0.5">
                      {parsedResult.trainOrFlightNumber || parsedResult.category} • Category: {parsedResult.category}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 font-medium text-center">
                    {Math.round((parsedResult.confidenceScore || 0) * 100)}% Confidence
                  </span>

                  <button
                    onClick={handleAddBookingToVault}
                    disabled={isAddingBooking}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-50 cursor-pointer active:scale-[0.98]"
                  >
                    {isAddingBooking ? (
                      <>
                        <div className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        <span>Auto-Fill & Add to Bookings</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Extracted Fields Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {/* PNR / Booking Ref */}
                <div className="p-3.5 rounded-2xl bg-background border border-muted/80 space-y-1">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground block">
                    PNR / Ticket Ref
                  </span>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-mono font-bold text-foreground">
                      {parsedResult.pnrNumber || "Not found"}
                    </span>
                    {parsedResult.pnrNumber && (
                      <button
                        onClick={() => handleCopyPNR(parsedResult.pnrNumber)}
                        className="p-1 rounded-md text-muted-foreground hover:text-cyan-700"
                        title="Copy PNR"
                      >
                        {copiedPNR ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>
                </div>

                {/* Train / Flight Number */}
                <div className="p-3.5 rounded-2xl bg-background border border-muted/80 space-y-1">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground block">
                    Train / Flight Number
                  </span>
                  <span className="text-sm font-sans font-medium text-foreground block truncate">
                    {parsedResult.trainOrFlightNumber || "N/A"}
                  </span>
                </div>

                {/* Coach / Berth / Seat */}
                <div className="p-3.5 rounded-2xl bg-background border border-muted/80 space-y-1">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground block">
                    Coach / Seat / Berth
                  </span>
                  <span className="text-sm font-sans font-medium text-cyan-800 block truncate">
                    {parsedResult.coachBerthDetails || parsedResult.seatNumbers || "N/A"}
                  </span>
                </div>

                {/* Origin / Departure */}
                <div className="p-3.5 rounded-2xl bg-background border border-muted/80 space-y-1">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground block">
                    Origin / Boarding Station
                  </span>
                  <span className="text-sm font-sans font-medium text-foreground block truncate">
                    {parsedResult.departureStation || "N/A"}
                  </span>
                </div>

                {/* Destination / Arrival */}
                <div className="p-3.5 rounded-2xl bg-background border border-muted/80 space-y-1">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground block">
                    Destination Station
                  </span>
                  <span className="text-sm font-sans font-medium text-foreground block truncate">
                    {parsedResult.arrivalStation || "N/A"}
                  </span>
                </div>

                {/* Date & Time */}
                <div className="p-3.5 rounded-2xl bg-background border border-muted/80 space-y-1">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground block">
                    Scheduled Date & Time
                  </span>
                  <span className="text-sm font-mono text-foreground block truncate">
                    {parsedResult.departureDate || "N/A"} {parsedResult.departureTime ? `at ${parsedResult.departureTime}` : ""}
                  </span>
                </div>

                {/* Total Fare */}
                <div className="p-3.5 rounded-2xl bg-background border border-muted/80 space-y-1">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground block">
                    Total Fare / Amount
                  </span>
                  <span className="text-sm font-mono font-bold text-foreground block">
                    {parsedResult.totalFare ? `₹ ${parsedResult.totalFare.toLocaleString()}` : "N/A"}
                  </span>
                </div>

                {/* Passenger Names */}
                <div className="p-3.5 rounded-2xl bg-background border border-muted/80 space-y-1 col-span-1 sm:col-span-2">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground block">
                    Passengers
                  </span>
                  <span className="text-xs font-sans text-foreground block truncate">
                    {parsedResult.passengers && parsedResult.passengers.length > 0
                      ? parsedResult.passengers.join(", ")
                      : "Not specified"}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
