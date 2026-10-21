"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Sparkles,
  Bike,
  Backpack,
  Car,
  Footprints,
  Compass,
  Check,
  Plus,
  Trash2,
  DollarSign,
  Users,
  FileText,
  Image as ImageIcon,
  ChevronRight,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";
import { useTripVault } from "@/lib/vault/useTripVault";
import { TravelStyle, TripStatus, DestinationStop } from "@/lib/vault/types";

// Curated atmospheric adventure cover presets
const COVER_PRESETS = [
  {
    id: "himalayan-pass",
    label: "High Pass Ride",
    url: "https://images.unsplash.com/photo-1581793745862-99fde7fa73d2?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "mountain-roadtrip",
    label: "Alpine Highway",
    url: "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "backpack-trail",
    label: "Wilderness Trail",
    url: "https://images.unsplash.com/photo-1501555088652-021faa106b9b?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "coastal-expedition",
    label: "Ocean Route",
    url: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "desert-dunes",
    label: "Golden Dunes",
    url: "https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "snowy-peaks",
    label: "Glacier Summit",
    url: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=80",
  },
];

const TRAVEL_STYLES: { id: TravelStyle; label: string; icon: React.ReactNode; desc: string }[] = [
  {
    id: "MOTORCYCLE",
    label: "Motorcycle",
    icon: <Bike className="w-5 h-5 text-amber-500" />,
    desc: "Pass-storming, remote fuel stops & riding gear",
  },
  {
    id: "BACKPACKING",
    label: "Backpacking",
    icon: <Backpack className="w-5 h-5 text-emerald-500" />,
    desc: "Hostels, trains, walking trails & ultralight gear",
  },
  {
    id: "ROADTRIP",
    label: "Road Trip",
    icon: <Car className="w-5 h-5 text-cyan-500" />,
    desc: "Self-drive 4x4, highway milestones & scenic halts",
  },
  {
    id: "TREKKING",
    label: "Trekking",
    icon: <Footprints className="w-5 h-5 text-orange-500" />,
    desc: "Mountain basecamps, passes & physical trails",
  },
  {
    id: "LEISURE",
    label: "Leisure",
    icon: <Compass className="w-5 h-5 text-indigo-500" />,
    desc: "Heritage stays, local cuisines & gentle pacing",
  },
];

const CURRENCIES = [
  { code: "INR", symbol: "₹", name: "Indian Rupee" },
  { code: "USD", symbol: "$", name: "US Dollar" },
  { code: "EUR", symbol: "€", name: "Euro" },
  { code: "GBP", symbol: "£", name: "British Pound" },
  { code: "AED", symbol: "AED", name: "UAE Dirham" },
  { code: "THB", symbol: "฿", name: "Thai Baht" },
  { code: "JPY", symbol: "¥", name: "Japanese Yen" },
];

export default function NewTripPage() {
  const router = useRouter();
  const { createTrip } = useTripVault();

  // Multi-step progress: 1 = Identity, 2 = Route & Dates, 3 = Budget & Logistics
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Step 1: Identity
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [destination, setDestination] = useState("");
  const [travelStyle, setTravelStyle] = useState<TravelStyle>("MOTORCYCLE");
  const [coverImage, setCoverImage] = useState<string>(COVER_PRESETS[0].url);
  const [customCoverUrl, setCustomCoverUrl] = useState("");

  // Step 2: Route & Dates
  const [startDate, setStartDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => {
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    return nextWeek.toISOString().split("T")[0];
  });
  const [stops, setStops] = useState<{ id: string; name: string; stayNights: number }[]>([
    { id: "stop-1", name: "", stayNights: 1 },
  ]);

  // Step 3: Budget & Logistics
  const [budgetTotal, setBudgetTotal] = useState<number>(35000);
  const [currency, setCurrency] = useState("INR");
  const [status, setStatus] = useState<TripStatus>("PLANNING");
  const [companionInput, setCompanionInput] = useState("");
  const [companions, setCompanions] = useState<string[]>([]);
  const [notes, setNotes] = useState("");

  // Stop handlers
  const handleAddStop = () => {
    setStops((prev) => [
      ...prev,
      { id: `stop-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`, name: "", stayNights: 1 },
    ]);
  };

  const handleUpdateStop = (id: string, name: string, stayNights: number) => {
    setStops((prev) =>
      prev.map((s) => (s.id === id ? { ...s, name, stayNights: Math.max(1, stayNights) } : s))
    );
  };

  const handleRemoveStop = (id: string) => {
    if (stops.length <= 1) return;
    setStops((prev) => prev.filter((s) => s.id !== id));
  };

  // Companion handlers
  const handleAddCompanion = () => {
    const trimmed = companionInput.trim();
    if (!trimmed) return;
    if (!companions.includes(trimmed)) {
      setCompanions((prev) => [...prev, trimmed]);
    }
    setCompanionInput("");
  };

  const handleRemoveCompanion = (name: string) => {
    setCompanions((prev) => prev.filter((c) => c !== name));
  };

  // Step Validation & Navigation
  const validateStep1 = () => {
    if (!title.trim()) {
      setFormError("Please enter an expedition title.");
      return false;
    }
    if (!destination.trim()) {
      setFormError("Please specify the primary destination.");
      return false;
    }
    setFormError(null);
    return true;
  };

  const validateStep2 = () => {
    if (!startDate) {
      setFormError("Please specify a departure start date.");
      return false;
    }
    if (endDate && new Date(endDate).getTime() < new Date(startDate).getTime()) {
      setFormError("Return date cannot be earlier than departure date.");
      return false;
    }
    setFormError(null);
    return true;
  };

  const handleNext = () => {
    if (currentStep === 1) {
      if (validateStep1()) setCurrentStep(2);
    } else if (currentStep === 2) {
      if (validateStep2()) setCurrentStep(3);
    }
  };

  const handlePrev = () => {
    setFormError(null);
    if (currentStep === 3) setCurrentStep(2);
    else if (currentStep === 2) setCurrentStep(1);
  };

  // Final Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep1() || !validateStep2()) return;

    try {
      setIsSubmitting(true);
      setFormError(null);

      // Clean destination stops
      const formattedStops: DestinationStop[] = stops
        .filter((s) => s.name.trim().length > 0)
        .map((s, idx) => ({
          id: s.id,
          name: s.name.trim(),
          stayNights: s.stayNights,
          orderIndex: idx,
        }));

      // If stops are empty, add primary destination as single stop
      if (formattedStops.length === 0 && destination.trim()) {
        formattedStops.push({
          id: `stop-${Date.now()}`,
          name: destination.trim(),
          stayNights: 1,
          orderIndex: 0,
        });
      }

      const selectedCover = customCoverUrl.trim() || coverImage;

      const created = await createTrip({
        title: title.trim(),
        subtitle: subtitle.trim() || undefined,
        destination: destination.trim(),
        destinations: formattedStops,
        startDate: new Date(startDate).toISOString(),
        endDate: endDate ? new Date(endDate).toISOString() : undefined,
        status,
        travelStyle,
        coverImage: selectedCover,
        budgetTotal: Number(budgetTotal) || 0,
        currency,
        companions: companions.length > 0 ? companions : undefined,
        notes: notes.trim() || undefined,
      });

      // Navigate straight to the new trip's command center
      router.push(`/secret/vault/${created.id}`);
    } catch (err) {
      console.error("Failed to create trip in vault:", err);
      setFormError("Failed to store expedition in local database. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-fade-in pt-2 sm:pt-4 pb-20">
      {/* Top Header */}
      <nav className="flex items-center justify-between border-b border-muted pb-4">
        <Link
          href="/secret/vault"
          className="group inline-flex items-center gap-2 text-xs font-sans tracking-wide text-muted-foreground hover:text-foreground transition-colors py-1.5"
        >
          <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" />
          <span>Trip Vault</span>
        </Link>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-[11px] font-mono tracking-wider text-amber-400 font-semibold uppercase">
          <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />
          <span>New Expedition</span>
        </div>
      </nav>

      {/* Title & Stepper Header */}
      <div>
        <h1 className="font-display text-3xl sm:text-4xl text-foreground font-normal tracking-tight">
          Plan New Expedition
        </h1>
        <p className="font-body text-xs sm:text-sm text-muted-foreground mt-1">
          Stored directly on your device. Zero internet required to access tickets, itineraries, and maps.
        </p>

        {/* 3-Step Progress Bar */}
        <div className="grid grid-cols-3 gap-2 mt-6">
          {[
            { step: 1, label: "Identity" },
            { step: 2, label: "Route & Dates" },
            { step: 3, label: "Logistics" },
          ].map((item) => (
            <div
              key={item.step}
              className={`p-2.5 rounded-xl border text-center transition-all ${
                currentStep === item.step
                  ? "bg-amber-500/15 border-amber-500/40 text-amber-400 font-semibold shadow-xs"
                  : currentStep > item.step
                  ? "bg-surface border-muted text-foreground"
                  : "bg-surface/30 border-muted/50 text-muted-foreground/60"
              }`}
            >
              <div className="text-[10px] font-mono uppercase tracking-wider">Step 0{item.step}</div>
              <div className="text-xs font-sans mt-0.5">{item.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Validation Alert */}
      {formError && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2.5 animate-shake">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{formError}</span>
        </div>
      )}

      {/* Form Content */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* STEP 1: IDENTITY */}
        {currentStep === 1 && (
          <div className="space-y-6 animate-fade-in">
            {/* Title */}
            <div className="space-y-1.5">
              <label className="text-xs font-sans font-medium text-foreground tracking-wide flex items-center justify-between">
                <span>Expedition Title *</span>
                <span className="text-[10px] font-mono text-muted-foreground">Required</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Trans-Himalayan Traverse 2026"
                className="w-full px-4 py-2.5 rounded-xl bg-surface border border-muted focus:border-amber-500 focus:outline-hidden text-sm text-foreground placeholder:text-muted-foreground/50 transition-colors"
                autoFocus
              />
            </div>

            {/* Subtitle */}
            <div className="space-y-1.5">
              <label className="text-xs font-sans font-medium text-foreground tracking-wide">
                Subtitle or Tagline
              </label>
              <input
                type="text"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                placeholder="e.g. Manali to Leh via Umling La & Zanskar Valley"
                className="w-full px-4 py-2.5 rounded-xl bg-surface border border-muted focus:border-amber-500 focus:outline-hidden text-sm text-foreground placeholder:text-muted-foreground/50 transition-colors"
              />
            </div>

            {/* Destination */}
            <div className="space-y-1.5">
              <label className="text-xs font-sans font-medium text-foreground tracking-wide flex items-center justify-between">
                <span>Primary Destination Region *</span>
                <span className="text-[10px] font-mono text-muted-foreground">Required</span>
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-amber-500 absolute left-3.5 top-3 pointer-events-none" />
                <input
                  type="text"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder="e.g. Ladakh & Spiti, Himachal Pradesh"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-surface border border-muted focus:border-amber-500 focus:outline-hidden text-sm text-foreground placeholder:text-muted-foreground/50 transition-colors"
                />
              </div>
            </div>

            {/* Travel Style Selector */}
            <div className="space-y-2">
              <label className="text-xs font-sans font-medium text-foreground tracking-wide">
                Travel Style & Mode
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {TRAVEL_STYLES.map((style) => (
                  <button
                    type="button"
                    key={style.id}
                    onClick={() => setTravelStyle(style.id)}
                    className={`p-3 rounded-xl border text-left transition-all flex items-start gap-3 ${
                      travelStyle === style.id
                        ? "bg-amber-500/10 border-amber-500/50 text-foreground ring-1 ring-amber-500/30"
                        : "bg-surface border-muted text-muted-foreground hover:text-foreground hover:bg-surface-hover/70"
                    }`}
                  >
                    <div className="mt-0.5">{style.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-sans font-semibold text-foreground flex items-center justify-between">
                        <span>{style.label}</span>
                        {travelStyle === style.id && <Check className="w-3.5 h-3.5 text-amber-500" />}
                      </div>
                      <div className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                        {style.desc}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Cover Photo Selection */}
            <div className="space-y-2">
              <label className="text-xs font-sans font-medium text-foreground tracking-wide flex items-center justify-between">
                <span>Expedition Visual Atmosphere</span>
                <span className="text-[10px] font-mono text-muted-foreground">Preset / Custom</span>
              </label>

              {/* Presets Grid */}
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {COVER_PRESETS.map((preset) => (
                  <button
                    type="button"
                    key={preset.id}
                    onClick={() => {
                      setCoverImage(preset.url);
                      setCustomCoverUrl("");
                    }}
                    className={`relative rounded-xl overflow-hidden aspect-video border transition-all ${
                      coverImage === preset.url && !customCoverUrl
                        ? "border-amber-500 ring-2 ring-amber-500/50 scale-[1.02]"
                        : "border-muted opacity-70 hover:opacity-100"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={preset.url}
                      alt={preset.label}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/40 flex items-end p-1">
                      <span className="text-[9px] font-sans font-medium text-white truncate">
                        {preset.label}
                      </span>
                    </div>
                  </button>
                ))}
              </div>

              {/* Custom Image URL fallback */}
              <div className="relative mt-2">
                <ImageIcon className="w-4 h-4 text-muted-foreground absolute left-3.5 top-3 pointer-events-none" />
                <input
                  type="url"
                  value={customCoverUrl}
                  onChange={(e) => setCustomCoverUrl(e.target.value)}
                  placeholder="Or paste a custom image URL (optional)"
                  className="w-full pl-10 pr-4 py-2 rounded-xl bg-surface border border-muted focus:border-amber-500 focus:outline-hidden text-xs text-foreground placeholder:text-muted-foreground/50 transition-colors"
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: ROUTE & CALENDAR */}
        {currentStep === 2 && (
          <div className="space-y-6 animate-fade-in">
            {/* Dates Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-sans font-medium text-foreground tracking-wide flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-amber-500" />
                  <span>Departure Date *</span>
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-surface border border-muted focus:border-amber-500 focus:outline-hidden text-sm text-foreground transition-colors [color-scheme:dark]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-sans font-medium text-foreground tracking-wide flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-accent" />
                  <span>Return Date (Optional)</span>
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-surface border border-muted focus:border-amber-500 focus:outline-hidden text-sm text-foreground transition-colors [color-scheme:dark]"
                />
              </div>
            </div>

            {/* Multi-Destination Route Sequencing */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-xs font-sans font-medium text-foreground tracking-wide flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-amber-500" />
                    <span>Destination Route Sequencing</span>
                  </label>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Chronological stops along your expedition with stay durations.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleAddStop}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-surface border border-muted hover:border-amber-500 text-xs font-sans text-amber-400 hover:text-amber-300 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Stop</span>
                </button>
              </div>

              {/* Stops list */}
              <div className="space-y-2.5">
                {stops.map((stop, index) => (
                  <div
                    key={stop.id}
                    className="p-3 rounded-xl bg-surface border border-muted flex items-center gap-3 transition-colors"
                  >
                    <span className="w-6 h-6 rounded-full bg-background border border-muted flex items-center justify-center text-[10px] font-mono text-muted-foreground shrink-0 font-semibold">
                      {index + 1}
                    </span>

                    <input
                      type="text"
                      value={stop.name}
                      onChange={(e) => handleUpdateStop(stop.id, e.target.value, stop.stayNights)}
                      placeholder={index === 0 ? "e.g. Manali (Basecamp)" : `Stop ${index + 1} name`}
                      className="flex-1 px-3 py-1.5 rounded-lg bg-background border border-muted/80 focus:border-amber-500 focus:outline-hidden text-xs text-foreground placeholder:text-muted-foreground/50 transition-colors"
                    />

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[10px] font-mono text-muted-foreground">Nights:</span>
                      <input
                        type="number"
                        min="1"
                        max="90"
                        value={stop.stayNights}
                        onChange={(e) =>
                          handleUpdateStop(stop.id, stop.name, parseInt(e.target.value) || 1)
                        }
                        className="w-14 px-2 py-1.5 rounded-lg bg-background border border-muted/80 focus:border-amber-500 focus:outline-hidden text-xs text-center font-mono text-foreground"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveStop(stop.id)}
                      disabled={stops.length <= 1}
                      className="p-1.5 text-muted-foreground hover:text-rose-400 disabled:opacity-30 disabled:hover:text-muted-foreground transition-colors shrink-0"
                      aria-label="Remove stop"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: LOGISTICS & BUDGET */}
        {currentStep === 3 && (
          <div className="space-y-6 animate-fade-in">
            {/* Budget & Currency */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2 space-y-1.5">
                <label className="text-xs font-sans font-medium text-foreground tracking-wide flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Target Budget Allocated</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="500"
                    value={budgetTotal}
                    onChange={(e) => setBudgetTotal(Math.max(0, parseFloat(e.target.value) || 0))}
                    placeholder="35000"
                    className="w-full px-4 py-2.5 rounded-xl bg-surface border border-muted focus:border-amber-500 focus:outline-hidden text-sm font-mono text-foreground placeholder:text-muted-foreground/50 transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-sans font-medium text-foreground tracking-wide">
                  Base Currency
                </label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-surface border border-muted focus:border-amber-500 focus:outline-hidden text-xs font-mono text-foreground transition-colors"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} ({c.symbol})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Initial Lifecycle Status */}
            <div className="space-y-1.5">
              <label className="text-xs font-sans font-medium text-foreground tracking-wide">
                Initial Expedition Status
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "PLANNING", label: "Planning", desc: "Building itinerary & gear" },
                  { id: "ACTIVE", label: "Active", desc: "Currently on the road" },
                  { id: "DRAFT", label: "Draft", desc: "Rough idea / wishlist" },
                ].map((s) => (
                  <button
                    type="button"
                    key={s.id}
                    onClick={() => setStatus(s.id as TripStatus)}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      status === s.id
                        ? "bg-amber-500/10 border-amber-500/50 text-foreground ring-1 ring-amber-500/30"
                        : "bg-surface border-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <div className="text-xs font-sans font-semibold text-foreground flex items-center justify-between">
                      <span>{s.label}</span>
                      {status === s.id && <Check className="w-3.5 h-3.5 text-amber-500" />}
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">
                      {s.desc}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Travel Companions */}
            <div className="space-y-2">
              <label className="text-xs font-sans font-medium text-foreground tracking-wide flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-accent" />
                <span>Travel Companions (Optional)</span>
              </label>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={companionInput}
                  onChange={(e) => setCompanionInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddCompanion();
                    }
                  }}
                  placeholder="Companion name (e.g. Vikram)"
                  className="flex-1 px-4 py-2 rounded-xl bg-surface border border-muted focus:border-amber-500 focus:outline-hidden text-xs text-foreground placeholder:text-muted-foreground/50 transition-colors"
                />
                <button
                  type="button"
                  onClick={handleAddCompanion}
                  className="px-3.5 py-2 rounded-xl bg-surface border border-muted hover:border-foreground/30 text-xs font-sans text-foreground transition-colors"
                >
                  Add
                </button>
              </div>

              {/* Companions tags */}
              {companions.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {companions.map((comp) => (
                    <span
                      key={comp}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-background border border-muted text-xs font-sans text-foreground"
                    >
                      <span>{comp}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveCompanion(comp)}
                        className="text-muted-foreground hover:text-rose-400"
                        aria-label={`Remove ${comp}`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Expedition Notes */}
            <div className="space-y-1.5">
              <label className="text-xs font-sans font-medium text-foreground tracking-wide flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                <span>Expedition Briefing & Notes</span>
              </label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Permits needed (Inner Line Permit), cold weather gear requirements, high altitude acclimatization guidelines..."
                className="w-full px-4 py-2.5 rounded-xl bg-surface border border-muted focus:border-amber-500 focus:outline-hidden text-xs text-foreground placeholder:text-muted-foreground/50 transition-colors resize-none"
              />
            </div>
          </div>
        )}

        {/* Footer Navigation Buttons */}
        <div className="pt-4 border-t border-muted/80 flex items-center justify-between gap-3">
          {currentStep > 1 ? (
            <button
              type="button"
              onClick={handlePrev}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl border border-muted hover:border-foreground/30 text-xs font-sans text-muted-foreground hover:text-foreground transition-colors"
            >
              Previous Step
            </button>
          ) : (
            <Link
              href="/secret/vault"
              className="px-4 py-2.5 rounded-xl border border-muted hover:border-foreground/30 text-xs font-sans text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </Link>
          )}

          {currentStep < 3 ? (
            <button
              type="button"
              onClick={handleNext}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-medium text-xs font-sans tracking-wide transition-all active:scale-[0.98]"
            >
              <span>Continue</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-neutral-950 font-semibold text-xs font-sans tracking-wide shadow-[0_0_20px_rgba(245,158,11,0.3)] transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 rounded-full border border-neutral-950 border-t-transparent animate-spin" />
                  <span>Storing Expedition...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Launch Expedition Vault</span>
                </>
              )}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
