"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  PackingItemRecord,
  PackingCategory,
  TripRecord,
  ID,
} from "./types";
import {
  getPackingItemsForTrip,
  savePackingItem,
  togglePackingItem,
  deletePackingItem,
  getTrip,
  isIndexedDBAvailable,
} from "./storage";
import { notifyVaultChange } from "./useTripVault";

export const ALL_PACKING_CATEGORIES: PackingCategory[] = [
  "DOCUMENTS",
  "CLOTHING",
  "RIDING_GEAR",
  "ELECTRONICS",
  "TOILETRIES",
  "FIRST_AID",
  "CAMPING",
  "MISC",
];

export interface CategoryPackingProgress {
  category: PackingCategory;
  total: number;
  packed: number;
  percent: number;
}

export interface PackingStats {
  totalItems: number;
  packedItems: number;
  unpackedItems: number;
  percentPacked: number;
  totalEssential: number;
  packedEssential: number;
  unpackedEssential: number;
  hasUnpackedEssentials: boolean;
  unpackedEssentialItems: PackingItemRecord[];
  byCategory: Record<PackingCategory, CategoryPackingProgress>;
}

export type PackingPresetId = "HIMALAYAN_RIDE" | "WEEKEND_ROADTRIP" | "MONSOON_EXPEDITION";

interface PresetItemDef {
  name: string;
  category: PackingCategory;
  quantity: number;
  isEssential: boolean;
  notes?: string;
}

export const PACKING_PRESETS: Record<
  PackingPresetId,
  { title: string; subtitle: string; items: PresetItemDef[] }
> = {
  HIMALAYAN_RIDE: {
    title: "Himalayan High-Altitude Ride",
    subtitle: "High passes, mountain safety, cold weather & motorcycle maintenance",
    items: [
      { name: "Original Driving License & Digital Copy", category: "DOCUMENTS", quantity: 1, isEssential: true, notes: "Keep physical card in waterproof pouch" },
      { name: "Bike Registration (RC) & Insurance Policy", category: "DOCUMENTS", quantity: 1, isEssential: true, notes: "Verify valid pollution certificate" },
      { name: "Inner Line Permits / Tourist Passes", category: "DOCUMENTS", quantity: 4, isEssential: true, notes: "Print 4 hard copies for military checkposts" },
      { name: "Aadhaar Card / Government Photo ID", category: "DOCUMENTS", quantity: 1, isEssential: true, notes: "Original + photocopies" },
      { name: "Armored Riding Jacket with Thermal Liner", category: "RIDING_GEAR", quantity: 1, isEssential: true, notes: "Level 2 armor recommended" },
      { name: "Riding Pants / Knee Guards", category: "RIDING_GEAR", quantity: 1, isEssential: true },
      { name: "Waterproof Winter Riding Boots", category: "RIDING_GEAR", quantity: 1, isEssential: true },
      { name: "Full-Face ECE / DOT Helmet", category: "RIDING_GEAR", quantity: 1, isEssential: true, notes: "With anti-fog pinlock visor" },
      { name: "Thermal Inner Gloves & Waterproof Riding Gloves", category: "RIDING_GEAR", quantity: 2, isEssential: true },
      { name: "Windproof Balaclava & Neck Buff", category: "RIDING_GEAR", quantity: 2, isEssential: false },
      { name: "Diamox (Acetazolamide) for AMS", category: "FIRST_AID", quantity: 10, isEssential: true, notes: "Consult physician before starting at 8000+ ft" },
      { name: "Emergency First Aid Kit & Antiseptic Cream", category: "FIRST_AID", quantity: 1, isEssential: true },
      { name: "ORS Electral Sachets & Pain Relievers", category: "FIRST_AID", quantity: 6, isEssential: true },
      { name: "Water Purification Tablets", category: "FIRST_AID", quantity: 10, isEssential: false },
      { name: "Heavy-Duty 20,000mAh Power Bank", category: "ELECTRONICS", quantity: 1, isEssential: true, notes: "Batteries drain faster in cold temperatures" },
      { name: "Action Camera & Extra Mounts/Batteries", category: "ELECTRONICS", quantity: 2, isEssential: false },
      { name: "Type-C / Lightning Fast-Charging Cables", category: "ELECTRONICS", quantity: 3, isEssential: true },
      { name: "Vibration-Dampened Mobile Handlebar Mount", category: "ELECTRONICS", quantity: 1, isEssential: false },
      { name: "Merino Wool Thermal Base Layers", category: "CLOTHING", quantity: 2, isEssential: true },
      { name: "Down Jacket / Heavy Fleece", category: "CLOTHING", quantity: 1, isEssential: true },
      { name: "Merino Wool Socks (Heavy Trekking)", category: "CLOTHING", quantity: 3, isEssential: true },
      { name: "Quick-Dry Moisture-Wicking T-Shirts", category: "CLOTHING", quantity: 4, isEssential: false },
      { name: "Tubeless Puncture Repair Kit & Mini 12V Inflator", category: "MISC", quantity: 1, isEssential: true, notes: "Test pump before departure" },
      { name: "Heavy-Duty Bungee Cords & Cargo Net", category: "MISC", quantity: 4, isEssential: true },
      { name: "O-Ring Chain Lube & Cleaner Spray", category: "MISC", quantity: 1, isEssential: true },
      { name: "Multi-tool with Pliers & Zip Ties", category: "MISC", quantity: 1, isEssential: true },
      { name: "SPF 50+ Sunscreen & High-Altitude Lip Butter", category: "TOILETRIES", quantity: 1, isEssential: true, notes: "Severe UV radiation at altitude" },
      { name: "Biodegradable Wet Wipes & Pocket Sanitizer", category: "TOILETRIES", quantity: 2, isEssential: false },
    ],
  },
  WEEKEND_ROADTRIP: {
    title: "Weekend Getaway & Road Trip",
    subtitle: "Lightweight essentials for short breaks and scenic highway drives",
    items: [
      { name: "Driver's License & Vehicle Registration", category: "DOCUMENTS", quantity: 1, isEssential: true },
      { name: "FASTag & Toll Pass Balance", category: "DOCUMENTS", quantity: 1, isEssential: true },
      { name: "Casual Clothes & T-shirts", category: "CLOTHING", quantity: 3, isEssential: false },
      { name: "Light Windbreaker / Sweatshirt", category: "CLOTHING", quantity: 1, isEssential: false },
      { name: "Comfortable Walking Shoes", category: "CLOTHING", quantity: 1, isEssential: false },
      { name: "Car 12V Charger & Dual Cable", category: "ELECTRONICS", quantity: 1, isEssential: true },
      { name: "Compact Bluetooth Speaker", category: "ELECTRONICS", quantity: 1, isEssential: false },
      { name: "Travel Toothbrush & Toiletries Pouch", category: "TOILETRIES", quantity: 1, isEssential: true },
      { name: "Basic First-Aid & Motion Sickness Pills", category: "FIRST_AID", quantity: 1, isEssential: true },
      { name: "Reusable Insulated Water Bottle", category: "MISC", quantity: 1, isEssential: false },
      { name: "Polarized Sunglasses & Case", category: "MISC", quantity: 1, isEssential: false },
    ],
  },
  MONSOON_EXPEDITION: {
    title: "Monsoon & Coastal Odyssey",
    subtitle: "Waterproofing, rain gear, insect defense, and dry bags",
    items: [
      { name: "IDs & Vehicle Papers Sealed in Zip-Lock", category: "DOCUMENTS", quantity: 1, isEssential: true },
      { name: "Heavy-Duty Motorcycle Raincoat / Poncho", category: "RIDING_GEAR", quantity: 1, isEssential: true },
      { name: "Waterproof Boot Covers & Visor Rain Repellent", category: "RIDING_GEAR", quantity: 1, isEssential: true },
      { name: "Waterproof Dry Bags (30L / 40L)", category: "MISC", quantity: 2, isEssential: true },
      { name: "Silica Gel Packets for Electronics", category: "ELECTRONICS", quantity: 6, isEssential: false },
      { name: "Quick-Dry Synthetic Clothing", category: "CLOTHING", quantity: 4, isEssential: false },
      { name: "Neoprene Water Sandals / Slippers", category: "CLOTHING", quantity: 1, isEssential: false },
      { name: "Odomos Mosquito / Leech Repellent Cream", category: "FIRST_AID", quantity: 1, isEssential: true },
      { name: "Waterproof Band-Aids & Antifungal Powder", category: "FIRST_AID", quantity: 1, isEssential: true },
      { name: "Compact Microfiber Quick-Dry Towel", category: "TOILETRIES", quantity: 2, isEssential: false },
    ],
  },
};

export function usePackingList(tripId: string) {
  const [trip, setTrip] = useState<TripRecord | null>(null);
  const [items, setItems] = useState<PackingItemRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!tripId || !isIndexedDBAvailable()) {
      setIsLoading(false);
      return;
    }

    try {
      setError(null);
      const [tripData, itemList] = await Promise.all([
        getTrip(tripId),
        getPackingItemsForTrip(tripId),
      ]);
      setTrip(tripData);
      setItems(itemList);
    } catch (err) {
      console.error("Failed loading packing list from vault:", err);
      setError("Unable to load packing items.");
    } finally {
      setIsLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    let mounted = true;
    if (!tripId) return;

    (async () => {
      try {
        const [tripData, itemList] = await Promise.all([
          getTrip(tripId),
          getPackingItemsForTrip(tripId),
        ]);
        if (mounted) {
          setTrip(tripData);
          setItems(itemList);
        }
      } catch (err) {
        if (mounted) {
          console.error("Failed initial packing load:", err);
          setError("Unable to load packing items.");
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    })();

    const handleVaultSync = () => {
      loadData();
    };

    window.addEventListener("life_atlas_vault_change", handleVaultSync);
    return () => {
      mounted = false;
      window.removeEventListener("life_atlas_vault_change", handleVaultSync);
    };
  }, [loadData, tripId]);

  // Statistics calculation
  const stats: PackingStats = useMemo(() => {
    const totalItems = items.length;
    const packedItems = items.filter((i) => i.isPacked).length;
    const unpackedItems = totalItems - packedItems;
    const percentPacked = totalItems > 0 ? Math.round((packedItems / totalItems) * 100) : 0;

    const essentialList = items.filter((i) => i.isEssential);
    const totalEssential = essentialList.length;
    const packedEssential = essentialList.filter((i) => i.isPacked).length;
    const unpackedEssential = totalEssential - packedEssential;
    const unpackedEssentialItems = essentialList.filter((i) => !i.isPacked);
    const hasUnpackedEssentials = unpackedEssential > 0;

    const byCategory = ALL_PACKING_CATEGORIES.reduce((acc, cat) => {
      const catItems = items.filter((i) => i.category === cat);
      const catTotal = catItems.length;
      const catPacked = catItems.filter((i) => i.isPacked).length;
      const catPercent = catTotal > 0 ? Math.round((catPacked / catTotal) * 100) : 0;

      acc[cat] = {
        category: cat,
        total: catTotal,
        packed: catPacked,
        percent: catPercent,
      };
      return acc;
    }, {} as Record<PackingCategory, CategoryPackingProgress>);

    return {
      totalItems,
      packedItems,
      unpackedItems,
      percentPacked,
      totalEssential,
      packedEssential,
      unpackedEssential,
      hasUnpackedEssentials,
      unpackedEssentialItems,
      byCategory,
    };
  }, [items]);

  // Action: Add Item
  const addItem = useCallback(
    async (
      item: Omit<PackingItemRecord, "id" | "tripId" | "createdAt" | "updatedAt">
    ): Promise<PackingItemRecord> => {
      const id = "pck_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
      const now = new Date().toISOString();

      const newRecord: PackingItemRecord = {
        ...item,
        id,
        tripId,
        createdAt: now,
        updatedAt: now,
      };

      const saved = await savePackingItem(newRecord);
      setItems((prev) => [...prev, saved]);
      notifyVaultChange();
      return saved;
    },
    [tripId]
  );

  // Action: Update Item
  const updateItem = useCallback(
    async (item: PackingItemRecord): Promise<PackingItemRecord> => {
      const saved = await savePackingItem(item);
      setItems((prev) => prev.map((i) => (i.id === item.id ? saved : i)));
      notifyVaultChange();
      return saved;
    },
    []
  );

  // Action: Toggle Packed Status
  const togglePacked = useCallback(
    async (id: ID, isPacked: boolean): Promise<PackingItemRecord> => {
      // Optimistic update
      setItems((prev) =>
        prev.map((i) => (i.id === id ? { ...i, isPacked, updatedAt: new Date().toISOString() } : i))
      );

      try {
        const updated = await togglePackingItem(id, isPacked);
        notifyVaultChange();
        return updated;
      } catch (err) {
        // Rollback on error
        await loadData();
        throw err;
      }
    },
    [loadData]
  );

  // Action: Update Quantity
  const updateQuantity = useCallback(
    async (id: ID, delta: number): Promise<PackingItemRecord | null> => {
      const target = items.find((i) => i.id === id);
      if (!target) return null;

      const newQty = Math.max(1, target.quantity + delta);
      if (newQty === target.quantity) return target;

      const updated: PackingItemRecord = {
        ...target,
        quantity: newQty,
        updatedAt: new Date().toISOString(),
      };

      setItems((prev) => prev.map((i) => (i.id === id ? updated : i)));
      const saved = await savePackingItem(updated);
      notifyVaultChange();
      return saved;
    },
    [items]
  );

  // Action: Remove Item
  const removeItem = useCallback(
    async (id: ID): Promise<boolean> => {
      setItems((prev) => prev.filter((i) => i.id !== id));
      const deleted = await deletePackingItem(id);
      notifyVaultChange();
      return deleted;
    },
    []
  );

  // Action: Bulk toggle packed (e.g., mark all packed / mark all unpacked)
  const bulkSetPacked = useCallback(
    async (isPacked: boolean, category?: PackingCategory): Promise<void> => {
      const targetItems = items.filter((i) => !category || i.category === category);
      if (targetItems.length === 0) return;

      const now = new Date().toISOString();
      const updatedList = items.map((i) => {
        if (!category || i.category === category) {
          return { ...i, isPacked, updatedAt: now };
        }
        return i;
      });

      setItems(updatedList);

      await Promise.all(
        targetItems.map((item) =>
          savePackingItem({ ...item, isPacked, updatedAt: now })
        )
      );

      notifyVaultChange();
    },
    [items]
  );

  // Action: Clear Category Items
  const clearCategory = useCallback(
    async (category: PackingCategory): Promise<void> => {
      const targetItems = items.filter((i) => i.category === category);
      if (targetItems.length === 0) return;

      setItems((prev) => prev.filter((i) => i.category !== category));

      await Promise.all(targetItems.map((i) => deletePackingItem(i.id)));
      notifyVaultChange();
    },
    [items]
  );

  // Action: Seed Preset
  const seedPreset = useCallback(
    async (presetId: PackingPresetId): Promise<number> => {
      const preset = PACKING_PRESETS[presetId];
      if (!preset) return 0;

      const now = new Date().toISOString();
      const newItems: PackingItemRecord[] = [];

      for (let i = 0; i < preset.items.length; i++) {
        const itemDef = preset.items[i];
        // Skip duplicate names in the same category
        const exists = items.some(
          (existing) =>
            existing.category === itemDef.category &&
            existing.name.toLowerCase() === itemDef.name.toLowerCase()
        );

        if (!exists) {
          const id = `pck_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`;
          newItems.push({
            id,
            tripId,
            category: itemDef.category,
            name: itemDef.name,
            quantity: itemDef.quantity,
            isEssential: itemDef.isEssential,
            isPacked: false,
            notes: itemDef.notes,
            createdAt: now,
            updatedAt: now,
          });
        }
      }

      if (newItems.length > 0) {
        await Promise.all(newItems.map((item) => savePackingItem(item)));
        setItems((prev) => [...prev, ...newItems]);
        notifyVaultChange();
      }

      return newItems.length;
    },
    [items, tripId]
  );

  return {
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
    clearCategory,
    seedPreset,
    refresh: loadData,
  };
}
