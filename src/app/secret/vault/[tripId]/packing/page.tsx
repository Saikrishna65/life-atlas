"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckSquare,
  Square,
  Plus,
  Trash2,
  Edit3,
  AlertTriangle,
  Search,
  X,
  FileText,
  Shirt,
  Bike,
  Zap,
  HeartPulse,
  Tent,
  Briefcase,
  Sparkles,
  Layers,
  ShieldAlert,
  ShieldCheck,
  RotateCcw,
  Check,
} from "lucide-react";
import {
  usePackingList,
  ALL_PACKING_CATEGORIES,
  PACKING_PRESETS,
  PackingPresetId,
} from "@/lib/vault/usePackingList";
import { PackingCategory, PackingItemRecord } from "@/lib/vault/types";
import { Select } from "@/components/ui/Select";
import { useLockBodyScroll } from "@/lib/vault/useLockBodyScroll";

const CATEGORY_META: Record<
  PackingCategory,
  { label: string; icon: React.ReactNode; color: string; badgeBg: string }
> = {
  DOCUMENTS: {
    label: "Documents & Passes",
    icon: <FileText className="w-4 h-4 text-cyan-700" />,
    color: "text-cyan-700",
    badgeBg: "bg-cyan-50 border-cyan-200 text-cyan-800",
  },
  RIDING_GEAR: {
    label: "Riding Gear",
    icon: <Bike className="w-4 h-4 text-amber-700" />,
    color: "text-amber-700",
    badgeBg: "bg-amber-50 border-amber-200 text-amber-800",
  },
  ELECTRONICS: {
    label: "Electronics & Tech",
    icon: <Zap className="w-4 h-4 text-indigo-700" />,
    color: "text-indigo-700",
    badgeBg: "bg-indigo-50 border-indigo-200 text-indigo-800",
  },
  FIRST_AID: {
    label: "First Aid & Meds",
    icon: <HeartPulse className="w-4 h-4 text-rose-700" />,
    color: "text-rose-700",
    badgeBg: "bg-rose-50 border-rose-200 text-rose-800",
  },
  CLOTHING: {
    label: "Clothing & Layers",
    icon: <Shirt className="w-4 h-4 text-emerald-700" />,
    color: "text-emerald-700",
    badgeBg: "bg-emerald-50 border-emerald-200 text-emerald-800",
  },
  TOILETRIES: {
    label: "Toiletries & Hygiene",
    icon: <Sparkles className="w-4 h-4 text-purple-700" />,
    color: "text-purple-700",
    badgeBg: "bg-purple-50 border-purple-200 text-purple-800",
  },
  CAMPING: {
    label: "Camping & Shelter",
    icon: <Tent className="w-4 h-4 text-amber-800" />,
    color: "text-amber-800",
    badgeBg: "bg-amber-50 border-amber-200 text-amber-800",
  },
  MISC: {
    label: "Spares & Tools",
    icon: <Briefcase className="w-4 h-4 text-zinc-700" />,
    color: "text-zinc-700",
    badgeBg: "bg-zinc-100 border-zinc-300 text-zinc-800",
  },
};

export default function PackingPage() {
  const params = useParams();
  const router = useRouter();
  const tripId = typeof params?.tripId === "string" ? params.tripId : "";

  const {
    trip,
    items,
    stats,
    isLoading,
    error,
    addItem,
    updateItem,
    togglePacked,
    updateQuantity,
    removeItem,
    bulkSetPacked,
    seedPreset,
  } = usePackingList(tripId);

  // Filter & Search states
  const [selectedCategory, setSelectedCategory] = useState<PackingCategory | "ALL">("ALL");
  const [essentialOnly, setEssentialOnly] = useState<boolean>(false);
  const [hidePacked, setHidePacked] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Modals state
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [showPresetModal, setShowPresetModal] = useState<boolean>(false);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [itemToDelete, setItemToDelete] = useState<PackingItemRecord | null>(null);
  const [itemToEdit, setItemToEdit] = useState<PackingItemRecord | null>(null);
  const [seedingPreset, setSeedingPreset] = useState<boolean>(false);
  const [presetSuccessMsg, setPresetSuccessMsg] = useState<string | null>(null);

  // Lock body scroll when any modal is open
  useLockBodyScroll(showAddModal || showEditModal || showPresetModal || showDeleteModal);

  // Form State for Add / Edit
  const [formName, setFormName] = useState<string>("");
  const [formCategory, setFormCategory] = useState<PackingCategory>("DOCUMENTS");
  const [formQuantity, setFormQuantity] = useState<number>(1);
  const [formIsEssential, setFormIsEssential] = useState<boolean>(false);
  const [formNotes, setFormNotes] = useState<string>("");
  const [formSubmitting, setFormSubmitting] = useState<boolean>(false);

  // Open Add Modal
  const handleOpenAddModal = (defaultCategory?: PackingCategory) => {
    setFormName("");
    setFormCategory(defaultCategory || (selectedCategory !== "ALL" ? selectedCategory : "DOCUMENTS"));
    setFormQuantity(1);
    setFormIsEssential(false);
    setFormNotes("");
    setShowAddModal(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (item: PackingItemRecord) => {
    setItemToEdit(item);
    setFormName(item.name);
    setFormCategory(item.category);
    setFormQuantity(item.quantity);
    setFormIsEssential(item.isEssential);
    setFormNotes(item.notes || "");
    setShowEditModal(true);
  };

  // Handle Add Item Submit
  const handleAddItemSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    try {
      setFormSubmitting(true);
      await addItem({
        name: formName.trim(),
        category: formCategory,
        quantity: Math.max(1, formQuantity),
        isEssential: formIsEssential,
        isPacked: false,
        notes: formNotes.trim() || undefined,
      });
      setShowAddModal(false);
    } catch (err) {
      console.error("Failed to add packing item:", err);
    } finally {
      setFormSubmitting(false);
    }
  };

  // Handle Edit Item Submit
  const handleEditItemSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemToEdit || !formName.trim()) return;

    try {
      setFormSubmitting(true);
      await updateItem({
        ...itemToEdit,
        name: formName.trim(),
        category: formCategory,
        quantity: Math.max(1, formQuantity),
        isEssential: formIsEssential,
        notes: formNotes.trim() || undefined,
      });
      setShowEditModal(false);
      setItemToEdit(null);
    } catch (err) {
      console.error("Failed to update packing item:", err);
    } finally {
      setFormSubmitting(false);
    }
  };

  // Handle Delete Item
  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    try {
      await removeItem(itemToDelete.id);
      setShowDeleteModal(false);
      setItemToDelete(null);
    } catch (err) {
      console.error("Failed to delete item:", err);
    }
  };

  // Handle Seed Preset
  const handleSeedPreset = async (presetId: PackingPresetId) => {
    try {
      setSeedingPreset(true);
      const count = await seedPreset(presetId);
      setPresetSuccessMsg(`Added ${count} items from ${PACKING_PRESETS[presetId].title}`);
      setTimeout(() => {
        setPresetSuccessMsg(null);
        setShowPresetModal(false);
      }, 1500);
    } catch (err) {
      console.error("Failed to seed preset:", err);
    } finally {
      setSeedingPreset(false);
    }
  };

  // Filtered Items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Category filter
      if (selectedCategory !== "ALL" && item.category !== selectedCategory) {
        return false;
      }
      // Essential filter
      if (essentialOnly && !item.isEssential) {
        return false;
      }
      // Hide packed filter
      if (hidePacked && item.isPacked) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesName = item.name.toLowerCase().includes(query);
        const matchesNotes = item.notes?.toLowerCase().includes(query);
        const matchesCategory = item.category.toLowerCase().includes(query);
        return matchesName || matchesNotes || matchesCategory;
      }
      return true;
    });
  }, [items, selectedCategory, essentialOnly, hidePacked, searchQuery]);

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto py-24 text-center text-xs font-mono text-muted-foreground flex items-center justify-center gap-2">
        <div className="w-4 h-4 rounded-full border border-muted border-t-emerald-500 animate-spin" />
        <span>Loading packing gear vault...</span>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-24">
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
            <span className="text-accent font-medium">Checklist</span>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl text-foreground font-normal tracking-tight">
            Gear & Packing Checklists
          </h1>
          <p className="font-body text-xs text-muted-foreground mt-0.5">
            100% offline checklist with essential items alerts, quantity counters, and category quotas.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowPresetModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface border border-muted text-xs font-sans text-foreground hover:border-accent transition-colors shadow-xs"
            title="Import expedition gear presets"
          >
            <Sparkles className="w-3.5 h-3.5 text-accent" />
            <span className="hidden sm:inline">Expedition</span> Presets
          </button>

          <button
            onClick={() => handleOpenAddModal()}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-accent hover:bg-accent/90 text-accent-foreground font-medium text-xs transition-all shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Add Item</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2 font-mono">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* 2. Packing Telemetry & Overall Progress Bar (REQ-PCK-01) */}
      <div className="p-4 sm:p-5 rounded-2xl bg-surface border border-muted space-y-4 shadow-soft">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground block">
              Expedition Readiness
            </span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-2xl sm:text-3xl font-mono font-bold text-foreground">
                {stats.percentPacked}%
              </span>
              <span className="text-xs text-muted-foreground font-mono">
                ({stats.packedItems} of {stats.totalItems} items packed)
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => bulkSetPacked(true, selectedCategory === "ALL" ? undefined : selectedCategory)}
              disabled={items.length === 0}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-surface border border-muted text-[11px] font-sans text-muted-foreground hover:text-emerald-700 hover:border-emerald-300 transition-colors disabled:opacity-40 shadow-xs"
              title="Mark all items in view as packed"
            >
              <Check className="w-3 h-3 text-emerald-700" />
              <span>Pack All</span>
            </button>
            <button
              onClick={() => bulkSetPacked(false, selectedCategory === "ALL" ? undefined : selectedCategory)}
              disabled={items.length === 0}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-surface border border-muted text-[11px] font-sans text-muted-foreground hover:text-amber-800 hover:border-amber-300 transition-colors disabled:opacity-40 shadow-xs"
              title="Reset all items in view to unpacked"
            >
              <RotateCcw className="w-3 h-3 text-amber-700" />
              <span>Reset All</span>
            </button>
          </div>
        </div>

        {/* Dynamic Progress Bar */}
        <div className="space-y-1.5">
          <div className="w-full h-2.5 bg-background rounded-full overflow-hidden border border-muted p-0.5">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                stats.percentPacked === 100
                  ? "bg-emerald-600 shadow-[0_0_12px_rgba(16,185,129,0.3)]"
                  : stats.percentPacked > 50
                  ? "bg-emerald-600"
                  : "bg-amber-500"
              }`}
              style={{ width: `${Math.min(100, stats.percentPacked)}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
            <span>{stats.unpackedItems} items left to pack</span>
            <span>
              {stats.packedEssential} of {stats.totalEssential} essentials secured
            </span>
          </div>
        </div>
      </div>

      {/* 3. CRITICAL UNPACKED ESSENTIALS ALERT BANNER (REQ-PCK-02) */}
      {stats.hasUnpackedEssentials ? (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 space-y-3 shadow-soft">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-amber-100 text-amber-800 border border-amber-300 shrink-0">
                <ShieldAlert className="w-4 h-4 text-amber-800" />
              </div>
              <div>
                <h3 className="font-sans font-semibold text-sm text-amber-900">
                  {stats.unpackedEssential} Critical Item{stats.unpackedEssential > 1 ? "s" : ""} Still Unpacked!
                </h3>
                <p className="text-[11px] text-amber-800/90 mt-0.5">
                  Missing vital travel documentation, safety permits, or life-support medical supplies.
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                setEssentialOnly(true);
                setSelectedCategory("ALL");
              }}
              className="px-2.5 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 border border-amber-300 text-[11px] font-medium text-amber-900 shrink-0 transition-colors"
            >
              Filter Essentials
            </button>
          </div>

          <div className="flex flex-wrap gap-2 pt-1 border-t border-amber-200">
            {stats.unpackedEssentialItems.map((item) => (
              <button
                key={item.id}
                onClick={() => togglePacked(item.id, true)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-surface hover:bg-surface-hover border border-amber-300 text-xs font-sans text-amber-900 hover:text-emerald-800 hover:border-emerald-300 transition-all group shadow-xs"
                title="Tap to mark packed"
              >
                <Square className="w-3.5 h-3.5 text-amber-700 group-hover:text-emerald-700" />
                <span>{item.name}</span>
                {item.quantity > 1 && (
                  <span className="text-[10px] font-mono text-muted-foreground">×{item.quantity}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      ) : stats.totalEssential > 0 ? (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>
              <strong className="text-emerald-950">All {stats.totalEssential} Critical Essentials Packed!</strong> Driving license, permits, protective gear, and medical kits are secured.
            </span>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300 shrink-0 font-medium">
            100% READY
          </span>
        </div>
      ) : null}

      {/* 4. Filter Toolbar & Search */}
      <div className="space-y-3">
        {/* Search bar & toggles */}
        <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search gear, spares, notes..."
              className="w-full pl-9 pr-8 py-2 rounded-xl bg-surface border border-muted text-xs font-sans text-foreground placeholder:text-muted-foreground/60 focus:outline-hidden focus:border-accent"
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

          <div className="flex items-center gap-2 shrink-0">
            {/* Essential Only Toggle */}
            <button
              onClick={() => setEssentialOnly(!essentialOnly)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-sans transition-colors ${
                essentialOnly
                  ? "bg-accent border-accent text-accent-foreground font-medium"
                  : "bg-surface border-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5 text-amber-700" />
              <span>Essentials ({stats.totalEssential})</span>
            </button>

            {/* Hide Packed Toggle */}
            <button
              onClick={() => setHidePacked(!hidePacked)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-sans transition-colors ${
                hidePacked
                  ? "bg-accent border-accent text-accent-foreground font-medium"
                  : "bg-surface border-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              <CheckSquare className="w-3.5 h-3.5 text-emerald-700" />
              <span>Hide Packed</span>
            </button>
          </div>
        </div>

        {/* Category Pills (REQ-PCK-01) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
          <button
            onClick={() => setSelectedCategory("ALL")}
            className={`px-3 py-1.5 rounded-xl text-xs font-sans whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 ${
              selectedCategory === "ALL"
                ? "bg-accent border border-accent text-accent-foreground font-medium"
                : "bg-surface border border-muted text-muted-foreground hover:text-foreground hover:bg-surface-hover"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>All Gear ({items.length})</span>
          </button>

          {ALL_PACKING_CATEGORIES.map((cat) => {
            const meta = CATEGORY_META[cat];
            const catProgress = stats.byCategory[cat];
            const isSelected = selectedCategory === cat;

            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-sans whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 ${
                  isSelected
                    ? "bg-accent border border-accent text-accent-foreground font-medium shadow-xs"
                    : "bg-surface border border-muted text-muted-foreground hover:text-foreground hover:bg-surface-hover"
                }`}
              >
                {meta.icon}
                <span>{meta.label}</span>
                <span className="text-[10px] font-mono opacity-80">
                  ({catProgress?.packed || 0}/{catProgress?.total || 0})
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 5. Checklist Items Directory (REQ-PCK-01, REQ-PCK-03) */}
      {filteredItems.length === 0 ? (
        <div className="p-10 rounded-2xl bg-surface/40 border border-muted text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-muted/30 border border-muted flex items-center justify-center mx-auto text-muted-foreground">
            <CheckSquare className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-display text-lg text-foreground font-normal">
              No Checklist Items Found
            </h3>
            <p className="font-body text-xs text-muted-foreground max-w-sm mx-auto mt-1">
              {searchQuery || essentialOnly || hidePacked
                ? "No gear matches your current filters. Try resetting the search or filter options."
                : "Your packing checklist is empty for this category. Start adding custom items or import a high-altitude expedition preset."}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
            <button
              onClick={() => handleOpenAddModal(selectedCategory !== "ALL" ? selectedCategory : undefined)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Custom Item</span>
            </button>
            <button
              onClick={() => setShowPresetModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-background border border-muted text-xs font-sans text-muted-foreground hover:text-foreground hover:border-amber-500/40 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Seed Expedition Preset</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredItems.map((item) => {
            const meta = CATEGORY_META[item.category] || CATEGORY_META.MISC;

            return (
              <div
                key={item.id}
                className={`group p-3.5 sm:p-4 rounded-2xl border transition-all duration-200 flex items-start sm:items-center justify-between gap-3 ${
                  item.isPacked
                    ? "bg-surface/30 border-muted/60 opacity-70"
                    : "bg-surface/70 border-muted hover:border-muted-foreground/30 shadow-xs"
                }`}
              >
                {/* Left side: Checkbox + Name + Badges */}
                <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                  {/* Checkbox */}
                  <button
                    onClick={() => togglePacked(item.id, !item.isPacked)}
                    className="mt-0.5 sm:mt-0 text-muted-foreground hover:text-emerald-400 transition-colors shrink-0"
                    title={item.isPacked ? "Mark unpacked" : "Mark packed"}
                  >
                    {item.isPacked ? (
                      <CheckSquare className="w-5 h-5 text-emerald-400" />
                    ) : (
                      <Square className="w-5 h-5 text-muted-foreground/70 group-hover:text-foreground" />
                    )}
                  </button>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`text-sm font-sans font-medium transition-colors ${
                          item.isPacked
                            ? "line-through text-muted-foreground"
                            : "text-foreground"
                        }`}
                      >
                        {item.name}
                      </span>

                      {/* Essential Shield Badge */}
                      {item.isEssential && (
                        <span
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-[10px] font-mono text-amber-400 font-semibold shrink-0"
                          title="Critical essential item"
                        >
                          <ShieldAlert className="w-3 h-3 text-amber-400" />
                          <span>ESSENTIAL</span>
                        </span>
                      )}

                      {/* Category Badge */}
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-md border shrink-0 ${meta.badgeBg}`}
                      >
                        {meta.label}
                      </span>
                    </div>

                    {/* Notes Subtext */}
                    {item.notes && (
                      <p className="text-[11px] font-body text-muted-foreground mt-0.5 line-clamp-1">
                        {item.notes}
                      </p>
                    )}
                  </div>
                </div>

                {/* Right side: Quantity Stepper + Actions */}
                <div className="flex items-center gap-2 shrink-0 self-center">
                  {/* Quantity Stepper (REQ-PCK-03) */}
                  <div className="flex items-center rounded-xl bg-background border border-muted p-0.5">
                    <button
                      onClick={() => updateQuantity(item.id, -1)}
                      disabled={item.quantity <= 1}
                      className="w-6 h-6 rounded-lg text-muted-foreground hover:text-foreground flex items-center justify-center text-xs disabled:opacity-30 disabled:cursor-not-allowed hover:bg-surface transition-colors"
                      title="Decrease quantity"
                    >
                      -
                    </button>
                    <span className="w-7 text-center font-mono text-xs font-semibold text-foreground">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.id, 1)}
                      className="w-6 h-6 rounded-lg text-muted-foreground hover:text-foreground flex items-center justify-center text-xs hover:bg-surface transition-colors"
                      title="Increase quantity"
                    >
                      +
                    </button>
                  </div>

                  {/* Edit button */}
                  <button
                    onClick={() => handleOpenEditModal(item)}
                    className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-background border border-transparent hover:border-muted transition-colors"
                    title="Edit item"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>

                  {/* Delete button */}
                  <button
                    onClick={() => {
                      setItemToDelete(item);
                      setShowDeleteModal(true);
                    }}
                    className="p-1.5 rounded-xl text-muted-foreground hover:text-rose-400 hover:bg-background border border-transparent hover:border-rose-500/30 transition-colors"
                    title="Delete item"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL 1: ADD CUSTOM ITEM (REQ-PCK-03) */}
      {showAddModal && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setShowAddModal(false)}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overscroll-contain animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-3xl bg-surface border border-muted p-6 space-y-5 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-muted pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700">
                  <CheckSquare className="w-5 h-5" />
                </div>
                <h3 className="font-display text-xl text-foreground font-normal">
                  Add Checklist Item
                </h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-background transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddItemSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground block mb-1">
                  Item Description *
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g., Rain Cover for Tank Bag, Thermal Gloves, Diamox"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-muted text-sm font-sans text-foreground placeholder:text-muted-foreground/50 focus:outline-hidden focus:border-accent"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground block mb-1">
                    Gear Category
                  </label>
                  <Select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as PackingCategory)}
                    options={ALL_PACKING_CATEGORIES.map((cat) => ({
                      value: cat,
                      label: CATEGORY_META[cat].label,
                    }))}
                  />
                </div>

                <div>
                  <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground block mb-1">
                    Quantity
                  </label>
                  <div className="flex items-center rounded-xl bg-background border border-muted p-1">
                    <button
                      type="button"
                      onClick={() => setFormQuantity(Math.max(1, formQuantity - 1))}
                      className="w-7 h-7 rounded-lg text-muted-foreground hover:text-foreground flex items-center justify-center text-sm hover:bg-surface transition-colors"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min="1"
                      value={formQuantity}
                      onChange={(e) => setFormQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                      className="flex-1 text-center font-mono text-xs font-semibold text-foreground bg-transparent focus:outline-hidden"
                    />
                    <button
                      type="button"
                      onClick={() => setFormQuantity(formQuantity + 1)}
                      className="w-7 h-7 rounded-lg text-muted-foreground hover:text-foreground flex items-center justify-center text-sm hover:bg-surface transition-colors"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              {/* Critical Essential Toggle (REQ-PCK-02) */}
              <div className="p-3.5 rounded-2xl bg-background border border-muted flex items-start gap-3 cursor-pointer select-none" onClick={() => setFormIsEssential(!formIsEssential)}>
                <input
                  type="checkbox"
                  checked={formIsEssential}
                  onChange={(e) => setFormIsEssential(e.target.checked)}
                  className="mt-0.5 rounded border-muted text-accent focus:ring-0 focus:ring-offset-0 cursor-pointer"
                />
                <div className="text-xs">
                  <span className="font-semibold text-foreground flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-700" />
                    <span>Critical / Essential Gear</span>
                  </span>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Flag as non-negotiable for departure (triggers pre-trip warning alerts if unpacked).
                  </p>
                </div>
              </div>

              <div>
                <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground block mb-1">
                  Location / Notes (Optional)
                </label>
                <input
                  type="text"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="e.g., Inside tank bag waterproof pouch, Under pillion seat"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-muted text-xs font-sans text-foreground placeholder:text-muted-foreground/50 focus:outline-hidden focus:border-accent"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-muted">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl border border-muted text-xs font-sans text-muted-foreground hover:text-foreground hover:bg-background transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting || !formName.trim()}
                  className="px-5 py-2 rounded-xl bg-accent hover:bg-accent/90 text-accent-foreground font-medium text-xs transition-colors disabled:opacity-50"
                >
                  {formSubmitting ? "Saving..." : "Add to Checklist"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: EDIT CUSTOM ITEM (REQ-PCK-03) */}
      {showEditModal && itemToEdit && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => {
            setShowEditModal(false);
            setItemToEdit(null);
          }}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overscroll-contain animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-3xl bg-surface border border-muted p-6 space-y-5 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-muted pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-700">
                  <Edit3 className="w-5 h-5" />
                </div>
                <h3 className="font-display text-xl text-foreground font-normal">
                  Edit Checklist Item
                </h3>
              </div>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setItemToEdit(null);
                }}
                className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-background transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditItemSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground block mb-1">
                  Item Description *
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-muted text-sm font-sans text-foreground focus:outline-hidden focus:border-accent"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground block mb-1">
                    Gear Category
                  </label>
                  <Select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as PackingCategory)}
                    options={ALL_PACKING_CATEGORIES.map((cat) => ({
                      value: cat,
                      label: CATEGORY_META[cat].label,
                    }))}
                  />
                </div>

                <div>
                  <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground block mb-1">
                    Quantity
                  </label>
                  <div className="flex items-center rounded-xl bg-background border border-muted p-1">
                    <button
                      type="button"
                      onClick={() => setFormQuantity(Math.max(1, formQuantity - 1))}
                      className="w-7 h-7 rounded-lg text-muted-foreground hover:text-foreground flex items-center justify-center text-sm hover:bg-surface transition-colors"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min="1"
                      value={formQuantity}
                      onChange={(e) => setFormQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                      className="flex-1 text-center font-mono text-xs font-semibold text-foreground bg-transparent focus:outline-hidden"
                    />
                    <button
                      type="button"
                      onClick={() => setFormQuantity(formQuantity + 1)}
                      className="w-7 h-7 rounded-lg text-muted-foreground hover:text-foreground flex items-center justify-center text-sm hover:bg-surface transition-colors"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              {/* Critical Essential Toggle */}
              <div className="p-3.5 rounded-2xl bg-background border border-muted flex items-start gap-3 cursor-pointer select-none" onClick={() => setFormIsEssential(!formIsEssential)}>
                <input
                  type="checkbox"
                  checked={formIsEssential}
                  onChange={(e) => setFormIsEssential(e.target.checked)}
                  className="mt-0.5 rounded border-muted text-accent focus:ring-0 focus:ring-offset-0 cursor-pointer"
                />
                <div className="text-xs">
                  <span className="font-semibold text-foreground flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-700" />
                    <span>Critical / Essential Gear</span>
                  </span>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Flag as non-negotiable for departure.
                  </p>
                </div>
              </div>

              <div>
                <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground block mb-1">
                  Location / Notes (Optional)
                </label>
                <input
                  type="text"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-muted text-xs font-sans text-foreground focus:outline-hidden focus:border-accent"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-muted">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setItemToEdit(null);
                  }}
                  className="px-4 py-2 rounded-xl border border-muted text-xs font-sans text-muted-foreground hover:text-foreground hover:bg-background transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting || !formName.trim()}
                  className="px-5 py-2 rounded-xl bg-accent hover:bg-accent/90 text-accent-foreground font-medium text-xs transition-colors disabled:opacity-50"
                >
                  {formSubmitting ? "Updating..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: EXPEDITION PRESETS SEEDER */}
      {showPresetModal && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setShowPresetModal(false)}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overscroll-contain animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl rounded-3xl bg-surface border border-muted p-6 space-y-5 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-muted pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-accent/10 border border-accent/20 text-accent">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-display text-xl text-foreground font-normal">
                    Expedition Checklist Presets
                  </h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Pre-curated packing blueprints crafted for extreme terrains, road trips, and solo riders.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowPresetModal(false)}
                className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-background transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {presetSuccessMsg && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-mono flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-700" />
                <span>{presetSuccessMsg}</span>
              </div>
            )}

            <div className="space-y-3">
              {(
                Object.keys(PACKING_PRESETS) as PackingPresetId[]
              ).map((presetId) => {
                const preset = PACKING_PRESETS[presetId];
                return (
                  <div
                    key={presetId}
                    className="p-4 rounded-2xl bg-background border border-muted hover:border-accent transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-display text-base text-foreground font-normal group-hover:text-accent transition-colors">
                          {preset.title}
                        </h4>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-accent/10 text-accent border border-accent/20 font-medium">
                          {preset.items.length} items
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {preset.subtitle}
                      </p>
                    </div>

                    <button
                      onClick={() => handleSeedPreset(presetId)}
                      disabled={seedingPreset}
                      className="px-3.5 py-1.5 rounded-xl bg-surface hover:bg-surface-hover border border-muted hover:border-accent text-xs font-medium text-foreground transition-all shrink-0 flex items-center gap-1.5 disabled:opacity-50 shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5 text-accent" />
                      <span>Import Blueprint</span>
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="pt-3 border-t border-muted text-[11px] text-muted-foreground flex items-center justify-between">
              <span>* Safe import: Existing items will not be duplicated.</span>
              <button
                onClick={() => setShowPresetModal(false)}
                className="px-3 py-1 rounded-lg text-xs hover:text-foreground transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: DELETE CONFIRMATION */}
      {showDeleteModal && itemToDelete && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => {
            setShowDeleteModal(false);
            setItemToDelete(null);
          }}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overscroll-contain animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-3xl bg-surface border border-muted p-5 space-y-4 shadow-2xl"
          >
            <div className="flex items-center gap-2 text-rose-600">
              <Trash2 className="w-5 h-5" />
              <h3 className="font-display text-lg text-foreground font-normal">
                Delete Gear Item?
              </h3>
            </div>
            <p className="text-xs text-muted-foreground">
              Are you sure you want to remove &quot;{itemToDelete.name}&quot; from your checklist? This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-muted">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setItemToDelete(null);
                }}
                className="px-3 py-1.5 rounded-xl border border-muted text-xs font-sans text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
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
