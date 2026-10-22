"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Utensils,
  Plus,
  Trash2,
  Edit3,
  Star,
  MapPin,
  Compass,
  CheckCircle2,
  Circle,
  Coffee,
  Sun,
  Moon,
  Sunrise,
  Sparkles,
  ExternalLink,
  Lock,
  Search,
  X,
  ChefHat,
  Heart,
  Info,
} from "lucide-react";
import { getTrip } from "@/lib/vault/storage";
import { useFoodPlanner } from "@/lib/vault/useFoodPlanner";
import {
  TripRecord,
  FoodPlannerRecord,
  FoodType,
  MealSlot,
  DietaryTag,
} from "@/lib/vault/types";
import { revokeSecretAccess } from "@/lib/deviceAuth";
import { useLockBodyScroll } from "@/lib/vault/useLockBodyScroll";
import { Select } from "@/components/ui/Select";

type ViewTab = "ALL" | "SPECIALTY_DISH" | "RESTAURANT";
type StatusFilter = "ALL" | "TO_TRY" | "VISITED" | "SKIPPED";
type MealFilter = "ALL" | MealSlot;
type DietaryFilter = "ALL" | DietaryTag;

export default function TripFoodPlannerPage() {
  const params = useParams();
  const router = useRouter();
  const tripId = params.tripId as string;

  const [trip, setTrip] = useState<TripRecord | null>(null);
  const [isTripLoading, setIsTripLoading] = useState(true);

  const {
    foodItems,
    stats,
    isLoading: isFoodLoading,
    addItem,
    updateItem,
    toggleStatus,
    rateItem,
    removeItem,
    seedRegionalPresets,
  } = useFoodPlanner(tripId);

  // Filters & Search
  const [activeTab, setActiveTab] = useState<ViewTab>("ALL");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [mealFilter, setMealFilter] = useState<MealFilter>("ALL");
  const [dietaryFilter, setDietaryFilter] = useState<DietaryFilter>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<FoodPlannerRecord | null>(null);
  const [reviewingItem, setReviewingItem] = useState<FoodPlannerRecord | null>(null);
  const [seedingNotice, setSeedingNotice] = useState<string | null>(null);

  // Lock body scroll when add/edit or review modal is open
  useLockBodyScroll(showAddModal || !!reviewingItem);

  // Add / Edit form state
  const [formType, setFormType] = useState<FoodType>("SPECIALTY_DISH");
  const [formName, setFormName] = useState("");
  const [formCuisine, setFormCuisine] = useState("");
  const [formLocation, setFormLocation] = useState("");
  const [formMealSlot, setFormMealSlot] = useState<MealSlot>("LUNCH");
  const [formPriceLevel, setFormPriceLevel] = useState<1 | 2 | 3 | 4>(2);
  const [formDietaryTags, setFormDietaryTags] = useState<DietaryTag[]>(["VEG"]);
  const [formMustOrder, setFormMustOrder] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formRating, setFormRating] = useState<number>(0);
  const [formStatus, setFormStatus] = useState<"TO_TRY" | "VISITED" | "SKIPPED">("TO_TRY");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Review modal state
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewNotes, setReviewNotes] = useState("");

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

  // Open Add modal with defaults
  const handleOpenAddModal = (presetType: FoodType = "SPECIALTY_DISH") => {
    setEditingItem(null);
    setFormType(presetType);
    setFormName("");
    setFormCuisine("");
    setFormLocation("");
    setFormMealSlot(presetType === "SPECIALTY_DISH" ? "LUNCH" : "DINNER");
    setFormPriceLevel(2);
    setFormDietaryTags(["VEG"]);
    setFormMustOrder("");
    setFormNotes("");
    setFormRating(0);
    setFormStatus("TO_TRY");
    setShowAddModal(true);
  };

  // Open Edit modal
  const handleOpenEditModal = (item: FoodPlannerRecord) => {
    setEditingItem(item);
    setFormType(item.type);
    setFormName(item.name);
    setFormCuisine(item.cuisine || "");
    setFormLocation(item.location || "");
    setFormMealSlot(item.mealSlot);
    setFormPriceLevel(item.priceLevel);
    setFormDietaryTags(item.dietaryTags);
    setFormMustOrder(item.mustOrderDish || "");
    setFormNotes(item.reviewNotes || "");
    setFormRating(item.rating || 0);
    setFormStatus(item.status);
    setShowAddModal(true);
  };

  // Open Review modal
  const handleOpenReviewModal = (item: FoodPlannerRecord) => {
    setReviewingItem(item);
    setReviewRating(item.rating || 5);
    setReviewNotes(item.reviewNotes || "");
  };

  // Handle Save (Add or Update)
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    setIsSubmitting(true);
    try {
      if (editingItem) {
        await updateItem({
          ...editingItem,
          name: formName.trim(),
          type: formType,
          cuisine: formCuisine.trim() || undefined,
          location: formLocation.trim() || undefined,
          mealSlot: formMealSlot,
          priceLevel: formPriceLevel,
          dietaryTags: formDietaryTags,
          mustOrderDish: formMustOrder.trim() || undefined,
          reviewNotes: formNotes.trim() || undefined,
          rating: formRating > 0 ? formRating : undefined,
          status: formStatus,
        });
      } else {
        await addItem({
          name: formName.trim(),
          type: formType,
          cuisine: formCuisine.trim() || undefined,
          location: formLocation.trim() || undefined,
          mealSlot: formMealSlot,
          priceLevel: formPriceLevel,
          dietaryTags: formDietaryTags,
          mustOrderDish: formMustOrder.trim() || undefined,
          reviewNotes: formNotes.trim() || undefined,
          rating: formRating > 0 ? formRating : undefined,
          status: formStatus,
        });
      }
      setShowAddModal(false);
      setEditingItem(null);
    } catch (err) {
      console.error("Failed saving food item:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Save Review
  const handleSaveReview = async () => {
    if (!reviewingItem) return;
    try {
      await rateItem(reviewingItem.id, reviewRating, reviewNotes.trim() || undefined);
      setReviewingItem(null);
    } catch (err) {
      console.error("Failed rating food item:", err);
    }
  };

  // Toggle Dietary Tag in Form
  const toggleDietaryTag = (tag: DietaryTag) => {
    if (formDietaryTags.includes(tag)) {
      setFormDietaryTags(formDietaryTags.filter((t) => t !== tag));
    } else {
      setFormDietaryTags([...formDietaryTags, tag]);
    }
  };

  // Handle Seed Regional Presets
  const handleSeedPresets = async () => {
    if (!trip) return;
    try {
      const count = await seedRegionalPresets(trip.destination);
      if (count > 0) {
        setSeedingNotice(`Added ${count} authentic regional dishes to your food roadmap!`);
      } else {
        setSeedingNotice("All curated regional dishes for this destination are already in your roadmap.");
      }
      setTimeout(() => setSeedingNotice(null), 3500);
    } catch (err) {
      console.error("Failed seeding regional presets:", err);
    }
  };

  // Filtered Items
  const filteredItems = useMemo(() => {
    return foodItems.filter((item) => {
      // Type Tab filter
      if (activeTab !== "ALL" && item.type !== activeTab) return false;

      // Status filter
      if (statusFilter !== "ALL" && item.status !== statusFilter) return false;

      // Meal slot filter
      if (mealFilter !== "ALL" && item.mealSlot !== mealFilter) return false;

      // Dietary tag filter
      if (dietaryFilter !== "ALL" && !item.dietaryTags.includes(dietaryFilter)) return false;

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesName = item.name.toLowerCase().includes(query);
        const matchesCuisine = item.cuisine?.toLowerCase().includes(query);
        const matchesLocation = item.location?.toLowerCase().includes(query);
        const matchesMustOrder = item.mustOrderDish?.toLowerCase().includes(query);
        if (!matchesName && !matchesCuisine && !matchesLocation && !matchesMustOrder) {
          return false;
        }
      }

      return true;
    });
  }, [foodItems, activeTab, statusFilter, mealFilter, dietaryFilter, searchQuery]);

  // Meal slot helper
  const getMealSlotDetails = (slot: MealSlot) => {
    switch (slot) {
      case "BREAKFAST":
        return { label: "Breakfast", icon: <Sunrise className="w-3.5 h-3.5 text-amber-400" />, badge: "bg-amber-500/10 text-amber-400 border-amber-500/20" };
      case "LUNCH":
        return { label: "Lunch", icon: <Sun className="w-3.5 h-3.5 text-orange-400" />, badge: "bg-orange-500/10 text-orange-400 border-orange-500/20" };
      case "DINNER":
        return { label: "Dinner", icon: <Moon className="w-3.5 h-3.5 text-indigo-400" />, badge: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20" };
      case "CAFE_CHAI":
        return { label: "Cafe & Chai", icon: <Coffee className="w-3.5 h-3.5 text-amber-500" />, badge: "bg-amber-600/10 text-amber-500 border-amber-600/20" };
      case "SNACK":
        return { label: "Street Snack", icon: <Sparkles className="w-3.5 h-3.5 text-teal-400" />, badge: "bg-teal-500/10 text-teal-400 border-teal-500/20" };
    }
  };

  // Dietary tag badge helper
  const getDietaryBadge = (tag: DietaryTag) => {
    switch (tag) {
      case "VEG":
        return <span key={tag} className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">VEG</span>;
      case "NON_VEG":
        return <span key={tag} className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-rose-500/15 border border-rose-500/30 text-rose-400">NON-VEG</span>;
      case "VEGAN":
        return <span key={tag} className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-teal-500/15 border border-teal-500/30 text-teal-400">VEGAN</span>;
      case "JAIN":
        return <span key={tag} className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-amber-500/15 border border-amber-500/30 text-amber-400">JAIN</span>;
      case "EGG":
        return <span key={tag} className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-yellow-500/15 border border-yellow-500/30 text-yellow-400">EGG</span>;
    }
  };

  // Price tier string helper
  const formatPriceLevel = (level: 1 | 2 | 3 | 4) => {
    const symbol = "₹".repeat(level);
    const label =
      level === 1 ? "Budget" : level === 2 ? "Moderate" : level === 3 ? "Upscale" : "Fine Dine";
    return { symbol, label };
  };

  // External Maps link for restaurants
  const getMapsUrl = (name: string, location?: string) => {
    const q = encodeURIComponent(`${name} ${location || trip?.destination || ""}`.trim());
    return `https://www.google.com/maps/search/?api=1&query=${q}`;
  };

  if (isTripLoading || isFoodLoading) {
    return (
      <div className="max-w-4xl mx-auto py-24 text-center text-xs font-mono text-muted-foreground flex items-center justify-center gap-2">
        <div className="w-4 h-4 rounded-full border border-muted border-t-amber-500 animate-spin" />
        <span>Loading offline culinary roadmap...</span>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="max-w-md mx-auto py-20 text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center mx-auto">
          <Utensils className="w-6 h-6 text-amber-500" />
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
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-[11px] font-mono tracking-wider text-orange-400 font-semibold uppercase">
            <Utensils className="w-3 h-3 text-orange-500" />
            <span>Pillar 05 • Food</span>
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

      {/* CULINARY COMPASS / HERO BANNER */}
      <section className="relative rounded-3xl border border-orange-500/30 bg-surface/80 overflow-hidden shadow-soft p-6 sm:p-8 backdrop-blur-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-[10px] font-mono text-orange-400 uppercase tracking-widest">
              <ChefHat className="w-3 h-3 text-orange-400" />
              <span>Gastronomic Roadmap</span>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl text-foreground font-normal tracking-tight">
              Culinary & Food Roadmap
            </h1>
            <p className="font-body text-xs text-muted-foreground max-w-xl leading-relaxed">
              Curate regional delicacies to taste, roadside dhabas, artisanal mountain cafes, and authentic local spots in{" "}
              <span className="text-foreground font-medium">{trip.destination}</span>.
            </p>
          </div>

          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 shrink-0">
            <button
              onClick={() => handleOpenAddModal("SPECIALTY_DISH")}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-black font-semibold text-xs font-sans transition-all shadow-md active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Add Dish / Place</span>
            </button>

            <button
              onClick={handleSeedPresets}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-surface border border-muted hover:border-orange-500/40 text-xs font-sans text-foreground transition-colors shadow-xs"
              title="Load authentic regional delicacies for this destination"
            >
              <Sparkles className="w-3.5 h-3.5 text-orange-400" />
              <span>Regional Presets</span>
            </button>
          </div>
        </div>

        {/* Seeding Toast Notice */}
        {seedingNotice && (
          <div className="mt-4 p-3 rounded-xl bg-orange-500/10 border border-orange-500/30 text-xs font-sans text-orange-300 flex items-center gap-2 animate-fade-in">
            <Sparkles className="w-4 h-4 text-orange-400 shrink-0" />
            <span>{seedingNotice}</span>
          </div>
        )}

        {/* CULINARY STATS METRICS RIBBON */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-muted/60">
          {/* Metric 1: Specialties Tasted */}
          <div className="p-3.5 rounded-2xl bg-background/80 border border-muted/60">
            <span className="text-[10px] font-mono uppercase text-muted-foreground tracking-wider block">
              Specialties Tasted
            </span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-bold font-mono text-orange-400">
                {stats.specialtiesTried}
              </span>
              <span className="text-xs font-mono text-muted-foreground">
                / {stats.specialtiesCount} dishes
              </span>
            </div>
            <span className="text-[10px] text-muted-foreground block mt-0.5">
              Regional checklist
            </span>
          </div>

          {/* Metric 2: Eateries Visited */}
          <div className="p-3.5 rounded-2xl bg-background/80 border border-muted/60">
            <span className="text-[10px] font-mono uppercase text-muted-foreground tracking-wider block">
              Eateries Visited
            </span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-bold font-mono text-foreground">
                {stats.restaurantsVisited}
              </span>
              <span className="text-xs font-mono text-muted-foreground">
                / {stats.restaurantsCount} spots
              </span>
            </div>
            <span className="text-[10px] text-muted-foreground block mt-0.5">
              Cafes & restaurants
            </span>
          </div>

          {/* Metric 3: Exploration Progress */}
          <div className="p-3.5 rounded-2xl bg-background/80 border border-muted/60">
            <span className="text-[10px] font-mono uppercase text-muted-foreground tracking-wider block">
              Taste Exploration
            </span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-bold font-mono text-emerald-400">
                {stats.triedPercentage}%
              </span>
              <span className="text-xs font-mono text-muted-foreground">
                completed
              </span>
            </div>
            {/* Progress bar */}
            <div className="w-full bg-muted/60 h-1.5 rounded-full overflow-hidden mt-1.5">
              <div
                className="bg-emerald-400 h-full rounded-full transition-all duration-500"
                style={{ width: `${stats.triedPercentage}%` }}
              />
            </div>
          </div>

          {/* Metric 4: Average Score */}
          <div className="p-3.5 rounded-2xl bg-background/80 border border-muted/60">
            <span className="text-[10px] font-mono uppercase text-muted-foreground tracking-wider block">
              Taster&apos;s Rating
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
              <span className="text-xl font-bold font-mono text-amber-400">
                {stats.avgRating > 0 ? stats.avgRating : "—"}
              </span>
              <span className="text-[10px] font-mono text-muted-foreground">
                ({stats.ratedCount} reviews)
              </span>
            </div>
            <span className="text-[10px] text-muted-foreground block mt-0.5">
              Personal critique
            </span>
          </div>
        </div>
      </section>

      {/* CONTROLS: TABS, FILTERS & SEARCH */}
      <section className="space-y-3">
        {/* Top bar: Tabs & Search */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Segmented View Tabs */}
          <div className="flex items-center p-1 rounded-2xl bg-surface border border-muted text-xs font-sans">
            <button
              onClick={() => setActiveTab("ALL")}
              className={`px-3 py-1.5 rounded-xl transition-all ${
                activeTab === "ALL"
                  ? "bg-orange-500 text-black font-semibold shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              All Tastes ({foodItems.length})
            </button>
            <button
              onClick={() => setActiveTab("SPECIALTY_DISH")}
              className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 ${
                activeTab === "SPECIALTY_DISH"
                  ? "bg-orange-500 text-black font-semibold shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <ChefHat className="w-3.5 h-3.5" />
              <span>Dishes to Taste ({stats.specialtiesCount})</span>
            </button>
            <button
              onClick={() => setActiveTab("RESTAURANT")}
              className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 ${
                activeTab === "RESTAURANT"
                  ? "bg-orange-500 text-black font-semibold shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Utensils className="w-3.5 h-3.5" />
              <span>Cafes & Eateries ({stats.restaurantsCount})</span>
            </button>
          </div>

          {/* Search Input */}
          <div className="relative min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search dishes, cuisine, spots..."
              className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-surface border border-muted focus:border-orange-500 focus:outline-hidden text-xs text-foreground placeholder:text-muted-foreground/60"
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

        {/* Secondary Filter Pills: Meal Slot, Dietary, Status */}
        <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] font-sans">
          {/* Status Pills */}
          <div className="flex items-center gap-1 bg-surface/50 border border-muted p-1 rounded-xl">
            {(["ALL", "TO_TRY", "VISITED", "SKIPPED"] as StatusFilter[]).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2 py-0.5 rounded-lg transition-colors ${
                  statusFilter === st
                    ? "bg-background text-foreground font-semibold shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {st === "ALL" ? "All Status" : st === "TO_TRY" ? "To Taste" : st === "VISITED" ? "Tasted / Visited" : "Skipped"}
              </button>
            ))}
          </div>

          {/* Meal Slot Pills */}
          <div className="flex items-center gap-1 bg-surface/50 border border-muted p-1 rounded-xl">
            {(["ALL", "BREAKFAST", "LUNCH", "DINNER", "CAFE_CHAI", "SNACK"] as MealFilter[]).map((slot) => (
              <button
                key={slot}
                onClick={() => setMealFilter(slot)}
                className={`px-2 py-0.5 rounded-lg transition-colors ${
                  mealFilter === slot
                    ? "bg-background text-orange-400 font-semibold shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {slot === "ALL" ? "All Slots" : slot === "CAFE_CHAI" ? "Cafe" : slot}
              </button>
            ))}
          </div>

          {/* Dietary Filter */}
          <div className="flex items-center gap-1 bg-surface/50 border border-muted p-1 rounded-xl">
            {(["ALL", "VEG", "NON_VEG", "VEGAN", "JAIN"] as DietaryFilter[]).map((d) => (
              <button
                key={d}
                onClick={() => setDietaryFilter(d)}
                className={`px-2 py-0.5 rounded-lg transition-colors ${
                  dietaryFilter === d
                    ? "bg-background text-foreground font-semibold shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {d === "ALL" ? "All Diet" : d === "NON_VEG" ? "Non-Veg" : d}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* FOOD ITEMS LIST */}
      <section className="space-y-3">
        {filteredItems.length === 0 ? (
          <div className="p-12 text-center rounded-2xl border border-muted bg-surface/40 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-orange-500 flex items-center justify-center mx-auto">
              <ChefHat className="w-6 h-6 text-orange-400" />
            </div>
            <h3 className="font-display text-base text-foreground font-normal">
              No Culinary Items Match Your Filter
            </h3>
            <p className="font-body text-xs text-muted-foreground max-w-sm mx-auto">
              Add a regional dish or restaurant wishlist item, or click &ldquo;Regional Presets&rdquo; to load authentic local recommendations.
            </p>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => handleOpenAddModal("SPECIALTY_DISH")}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-500 text-black text-xs font-semibold"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Dish</span>
              </button>
              <button
                onClick={handleSeedPresets}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface border border-muted text-xs font-sans text-foreground"
              >
                <Sparkles className="w-3.5 h-3.5 text-orange-400" />
                <span>Seed Suggestions</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {filteredItems.map((item) => {
              const meal = getMealSlotDetails(item.mealSlot);
              const price = formatPriceLevel(item.priceLevel);
              const isTried = item.status === "VISITED";
              const isSkipped = item.status === "SKIPPED";

              return (
                <div
                  key={item.id}
                  className={`group relative rounded-2xl border transition-all duration-200 p-4 sm:p-5 shadow-soft ${
                    isTried
                      ? "border-emerald-500/30 bg-surface/90"
                      : isSkipped
                      ? "border-muted bg-surface/30 opacity-60"
                      : "border-muted hover:border-orange-500/40 bg-surface"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    {/* Left: Checkbox / Status toggle, Title, Tags */}
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      {/* 1-Tap Status Checkbox button */}
                      <button
                        onClick={() => toggleStatus(item.id)}
                        className={`mt-0.5 shrink-0 transition-transform active:scale-90 ${
                          isTried
                            ? "text-emerald-400"
                            : isSkipped
                            ? "text-muted-foreground"
                            : "text-muted-foreground hover:text-orange-400"
                        }`}
                        title={
                          isTried
                            ? "Marked as Tasted / Visited. Tap to change status."
                            : "Tap to mark as Tasted"
                        }
                      >
                        {isTried ? (
                          <CheckCircle2 className="w-5 h-5 fill-emerald-500/20 text-emerald-400" />
                        ) : (
                          <Circle className="w-5 h-5" />
                        )}
                      </button>

                      <div className="space-y-2 flex-1 min-w-0">
                        {/* Badges row */}
                        <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                          {/* Item Type Pill */}
                          <span
                            className={`px-2 py-0.5 rounded-md font-mono uppercase font-semibold border ${
                              item.type === "SPECIALTY_DISH"
                                ? "bg-orange-500/10 text-orange-400 border-orange-500/20"
                                : "bg-cyan-500/10 text-cyan-400 border-cyan-500/20"
                            }`}
                          >
                            {item.type === "SPECIALTY_DISH" ? "Specialty Dish" : "Eatery / Spot"}
                          </span>

                          {/* Meal Slot Badge */}
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-sans border ${meal.badge}`}>
                            {meal.icon}
                            <span>{meal.label}</span>
                          </span>

                          {/* Price level */}
                          <span
                            className="px-2 py-0.5 rounded-md bg-background border border-muted font-mono text-muted-foreground"
                            title={price.label}
                          >
                            {price.symbol}
                          </span>

                          {/* Dietary tags */}
                          {item.dietaryTags.map((tag) => getDietaryBadge(tag))}

                          {/* Cuisine Tag */}
                          {item.cuisine && (
                            <span className="px-2 py-0.5 rounded-md bg-background border border-muted font-sans text-muted-foreground">
                              {item.cuisine}
                            </span>
                          )}

                          {/* Status Tag */}
                          <span
                            className={`px-2 py-0.5 rounded-md font-mono text-[9px] uppercase tracking-wider font-semibold border ${
                              isTried
                                ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"
                                : isSkipped
                                ? "bg-muted border-muted text-muted-foreground"
                                : "bg-amber-500/10 border-amber-500/20 text-amber-400"
                            }`}
                          >
                            {item.status === "TO_TRY" ? "To Taste" : item.status}
                          </span>
                        </div>

                        {/* Title & Location */}
                        <div>
                          <h4
                            className={`font-display text-base sm:text-lg tracking-tight font-normal transition-colors ${
                              isTried ? "text-foreground line-clamp-1" : "text-foreground font-medium"
                            }`}
                          >
                            {item.name}
                          </h4>

                          {item.location && (
                            <div className="flex items-center gap-1 text-xs font-sans text-muted-foreground mt-0.5">
                              <MapPin className="w-3 h-3 text-orange-400 shrink-0" />
                              <span className="truncate">{item.location}</span>
                            </div>
                          )}
                        </div>

                        {/* Must Order Spotlight */}
                        {item.mustOrderDish && (
                          <div className="p-2.5 rounded-xl bg-orange-500/5 border border-orange-500/20 flex items-start gap-2">
                            <Heart className="w-3.5 h-3.5 text-orange-400 mt-0.5 shrink-0" />
                            <div className="text-xs font-sans">
                              <span className="font-semibold text-orange-400 mr-1">Must Order:</span>
                              <span className="text-foreground/90">{item.mustOrderDish}</span>
                            </div>
                          </div>
                        )}

                        {/* Review Notes / Tasting verdict */}
                        {item.reviewNotes && (
                          <div className="p-2.5 rounded-xl bg-background/60 border border-muted text-xs font-sans text-muted-foreground leading-relaxed flex items-start gap-2">
                            <Info className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                            <p className="italic">&ldquo;{item.reviewNotes}&rdquo;</p>
                          </div>
                        )}

                        {/* Star Rating Bar */}
                        <div className="flex items-center gap-2 pt-1">
                          <div className="flex items-center gap-1">
                            {[1, 2, 3, 4, 5].map((starVal) => {
                              const filled = (item.rating || 0) >= starVal;
                              return (
                                <button
                                  key={starVal}
                                  onClick={() => rateItem(item.id, starVal)}
                                  className="transition-transform hover:scale-125 focus:outline-hidden"
                                  title={`Rate ${starVal} Stars`}
                                >
                                  <Star
                                    className={`w-3.5 h-3.5 ${
                                      filled
                                        ? "fill-amber-400 text-amber-400"
                                        : "text-muted-foreground/40 hover:text-amber-400/80"
                                    }`}
                                  />
                                </button>
                              );
                            })}
                          </div>

                          {item.rating ? (
                            <span className="text-xs font-mono font-semibold text-amber-400">
                              {item.rating}.0 / 5.0
                            </span>
                          ) : (
                            <button
                              onClick={() => handleOpenReviewModal(item)}
                              className="text-[11px] font-sans text-muted-foreground hover:text-amber-400 transition-colors underline underline-offset-2"
                            >
                              Add Rating & Critique
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right / Actions */}
                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-muted/50 shrink-0">
                      {/* Directions Button for Restaurants / Spots */}
                      {item.type === "RESTAURANT" && (
                        <a
                          href={getMapsUrl(item.name, item.location)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-background border border-muted hover:border-orange-500/40 text-xs font-sans text-foreground transition-colors shadow-xs"
                          title="Open in Google Maps / Navigation"
                        >
                          <Compass className="w-3 h-3 text-orange-400" />
                          <span>Directions</span>
                          <ExternalLink className="w-2.5 h-2.5 text-muted-foreground" />
                        </a>
                      )}

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenReviewModal(item)}
                          className="p-1.5 rounded-lg border border-muted hover:border-foreground/30 text-muted-foreground hover:text-amber-400 transition-colors"
                          title="Review & Star Rating"
                        >
                          <Star className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => handleOpenEditModal(item)}
                          className="p-1.5 rounded-lg border border-muted hover:border-foreground/30 text-muted-foreground hover:text-foreground transition-colors"
                          title="Edit Details"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => removeItem(item.id)}
                          className="p-1.5 rounded-lg border border-muted hover:border-rose-500/40 text-muted-foreground hover:text-rose-400 transition-colors"
                          title="Delete from roadmap"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ADD / EDIT MODAL */}
      {showAddModal && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setShowAddModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in overscroll-contain"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 rounded-2xl border border-muted bg-surface shadow-2xl space-y-5"
          >
            <div className="flex items-center justify-between border-b border-muted pb-3">
              <div className="flex items-center gap-2">
                <ChefHat className="w-5 h-5 text-accent" />
                <h3 className="font-display text-xl text-foreground font-normal">
                  {editingItem ? "Edit Culinary Item" : "Add to Food Roadmap"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="space-y-4">
              {/* Type Switcher */}
              <div className="space-y-1.5">
                <label className="text-xs font-sans font-medium text-foreground">Item Category *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormType("SPECIALTY_DISH")}
                    className={`py-2 px-3 rounded-xl border text-xs font-sans font-medium flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      formType === "SPECIALTY_DISH"
                        ? "bg-accent/10 border-accent text-accent font-semibold"
                        : "bg-background border-muted text-muted-foreground hover:border-foreground/30"
                    }`}
                  >
                    <ChefHat className="w-3.5 h-3.5" />
                    <span>Regional Dish to Taste</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormType("RESTAURANT")}
                    className={`py-2 px-3 rounded-xl border text-xs font-sans font-medium flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      formType === "RESTAURANT"
                        ? "bg-accent/10 border-accent text-accent font-semibold"
                        : "bg-background border-muted text-muted-foreground hover:border-foreground/30"
                    }`}
                  >
                    <Utensils className="w-3.5 h-3.5" />
                    <span>Restaurant / Cafe / Dhaba</span>
                  </button>
                </div>
              </div>

              {/* Name */}
              <div className="space-y-1">
                <label className="text-xs font-sans font-medium text-foreground">
                  {formType === "SPECIALTY_DISH" ? "Dish Name *" : "Restaurant / Eatery Name *"}
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder={
                    formType === "SPECIALTY_DISH"
                      ? "e.g. Siddu with Desi Ghee, Thukpa, Laal Maas"
                      : "e.g. Lassiwala MI Road, Cafe 1947, Zomsa Tibetan"
                  }
                  className="w-full px-3 py-2 rounded-xl bg-background border border-muted focus:border-accent focus:outline-hidden text-sm text-foreground placeholder:text-muted-foreground/50"
                  required
                />
              </div>

              {/* Cuisine & Meal Slot */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-sans font-medium text-foreground">Cuisine / Tradition</label>
                  <input
                    type="text"
                    value={formCuisine}
                    onChange={(e) => setFormCuisine(e.target.value)}
                    placeholder="e.g. Ladakhi, Rajasthani, Pahadi, Tibetan"
                    className="w-full px-3 py-2 rounded-xl bg-background border border-muted focus:border-accent focus:outline-hidden text-xs text-foreground placeholder:text-muted-foreground/50"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-sans font-medium text-foreground">Meal Slot *</label>
                  <Select
                    value={formMealSlot}
                    onChange={(e) => setFormMealSlot(e.target.value as MealSlot)}
                  >
                    <option value="BREAKFAST">Breakfast</option>
                    <option value="LUNCH">Lunch</option>
                    <option value="DINNER">Dinner</option>
                    <option value="CAFE_CHAI">Cafe & Chai</option>
                    <option value="SNACK">Street Snack</option>
                  </Select>
                </div>
              </div>

              {/* Location & Price Level */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-sans font-medium text-foreground">
                    Location / Landmark
                  </label>
                  <input
                    type="text"
                    value={formLocation}
                    onChange={(e) => setFormLocation(e.target.value)}
                    placeholder="e.g. Old Leh Main Bazaar, Mall Road Manali"
                    className="w-full px-3 py-2 rounded-xl bg-background border border-muted focus:border-accent focus:outline-hidden text-xs text-foreground placeholder:text-muted-foreground/50"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-sans font-medium text-foreground">Price Tier</label>
                  <Select
                    value={formPriceLevel}
                    onChange={(e) => setFormPriceLevel(Number(e.target.value) as 1 | 2 | 3 | 4)}
                  >
                    <option value={1}>₹ (Budget / Street Food)</option>
                    <option value={2}>₹₹ (Moderate Dhaba / Cafe)</option>
                    <option value={3}>₹₹₹ (Upscale Dining)</option>
                    <option value={4}>₹₹₹₹ (Fine Dine / Luxury)</option>
                  </Select>
                </div>
              </div>

              {/* Dietary Tags Multi-select */}
              <div className="space-y-1.5">
                <label className="text-xs font-sans font-medium text-foreground">Dietary Classifications</label>
                <div className="flex flex-wrap gap-2">
                  {(["VEG", "NON_VEG", "VEGAN", "JAIN", "EGG"] as DietaryTag[]).map((tag) => {
                    const active = formDietaryTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleDietaryTag(tag)}
                        className={`px-3 py-1 rounded-xl border text-xs font-mono font-medium transition-colors cursor-pointer ${
                          active
                            ? "bg-accent/10 border-accent text-accent font-semibold"
                            : "bg-background border-muted text-muted-foreground hover:border-foreground/30"
                        }`}
                      >
                        {tag === "NON_VEG" ? "NON-VEG" : tag}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Must-Order Dish */}
              <div className="space-y-1">
                <label className="text-xs font-sans font-medium text-foreground">
                  Must-Order Dish / Signature Recommendation
                </label>
                <input
                  type="text"
                  value={formMustOrder}
                  onChange={(e) => setFormMustOrder(e.target.value)}
                  placeholder="e.g. Mutton Rogan Josh, Honey Lemon Ginger Tea, Apple Pie"
                  className="w-full px-3 py-2 rounded-xl bg-background border border-muted focus:border-accent focus:outline-hidden text-xs text-foreground placeholder:text-muted-foreground/50"
                />
              </div>

              {/* Notes / Tips */}
              <div className="space-y-1">
                <label className="text-xs font-sans font-medium text-foreground">
                  Tasting Notes / Tips / Best Time to Visit
                </label>
                <textarea
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  rows={2}
                  placeholder="e.g. Gets crowded by 1 PM; ask for extra walnut ghee dip."
                  className="w-full px-3 py-2 rounded-xl bg-background border border-muted focus:border-accent focus:outline-hidden text-xs text-foreground placeholder:text-muted-foreground/50 resize-none"
                />
              </div>

              {/* Status */}
              <div className="space-y-1">
                <label className="text-xs font-sans font-medium text-foreground">Exploration Status</label>
                <Select
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value as "TO_TRY" | "VISITED" | "SKIPPED")}
                >
                  <option value="TO_TRY">To Taste (On Wishlist)</option>
                  <option value="VISITED">Tasted / Visited</option>
                  <option value="SKIPPED">Skipped</option>
                </Select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-muted">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl border border-muted text-xs font-sans text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-accent hover:bg-accent/90 disabled:opacity-50 text-white font-medium text-xs font-sans transition-all cursor-pointer shadow-xs"
                >
                  {isSubmitting ? "Saving..." : editingItem ? "Update Item" : "Save to Roadmap"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REVIEW & RATE MODAL */}
      {reviewingItem && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setReviewingItem(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in overscroll-contain"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-w-md w-full p-6 rounded-2xl border border-muted bg-surface shadow-2xl space-y-5"
          >
            <div className="flex items-center justify-between border-b border-muted pb-3">
              <div className="flex items-center gap-2">
                <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
                <h3 className="font-display text-lg text-foreground font-normal">
                  Rate & Critique: {reviewingItem.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setReviewingItem(null)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="text-center space-y-2 py-2">
                <span className="text-xs font-mono uppercase text-muted-foreground">Select Star Rating</span>
                <div className="flex items-center justify-center gap-2">
                  {[1, 2, 3, 4, 5].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setReviewRating(val)}
                      className="p-1 transition-transform hover:scale-125 focus:outline-hidden cursor-pointer"
                    >
                      <Star
                        className={`w-7 h-7 ${
                          reviewRating >= val
                            ? "fill-amber-500 text-amber-500"
                            : "text-muted-foreground/30 hover:text-amber-500/80"
                        }`}
                      />
                    </button>
                  ))}
                </div>
                <span className="text-sm font-mono font-bold text-amber-800 block">
                  {reviewRating} of 5 Stars
                </span>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-sans font-medium text-foreground">
                  Personal Tasting Review & Flavor Verdict
                </label>
                <textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  rows={3}
                  placeholder="e.g. Crispy texture, authentic wooden stove smokiness, incredible chutney!"
                  className="w-full px-3 py-2 rounded-xl bg-background border border-muted focus:border-accent focus:outline-hidden text-xs text-foreground placeholder:text-muted-foreground/50 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-muted">
                <button
                  type="button"
                  onClick={() => setReviewingItem(null)}
                  className="px-4 py-2 rounded-xl border border-muted text-xs font-sans text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveReview}
                  className="px-5 py-2 rounded-xl bg-accent hover:bg-accent/90 text-white font-medium text-xs font-sans transition-all cursor-pointer shadow-xs"
                >
                  Submit Critique
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
