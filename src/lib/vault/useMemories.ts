"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  TripRecord,
  TripMemoryRecord,
  ItineraryDayRecord,
  ExpenseRecord,
  VehicleRentalRecord,
  FoodPlannerRecord,
  PackingItemRecord,
  ID,
} from "./types";
import {
  getTrip,
  getMemoriesForTrip,
  saveMemory,
  deleteMemory,
  completeTripAndArchive,
  reopenTrip,
  getItinerariesForTrip,
  getExpensesForTrip,
  getRentalsForTrip,
  getFoodItemsForTrip,
  getPackingItemsForTrip,
  isIndexedDBAvailable,
} from "./storage";
import { notifyVaultChange } from "./useTripVault";

export interface ExpeditionDossierStats {
  isCompleted: boolean;
  completionDate?: string;
  daysOnRoad: number;
  totalDistanceKm: number;
  rentalDistanceKm: number;
  routeDistanceKm: number;
  totalBudget: number;
  totalSpent: number;
  budgetVariance: number;
  depositPendingRefund: number;
  activitiesTotal: number;
  activitiesCompleted: number;
  activityCompletionPct: number;
  dishesTotal: number;
  dishesTasted: number;
  packingItemsTotal: number;
  packingItemsPacked: number;
  packingReadinessPct: number;
  memoriesCount: number;
  highlightsCount: number;
}

export function useMemories(tripId: string) {
  const [trip, setTrip] = useState<TripRecord | null>(null);
  const [memories, setMemories] = useState<TripMemoryRecord[]>([]);
  const [itineraries, setItineraries] = useState<ItineraryDayRecord[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [rentals, setRentals] = useState<VehicleRentalRecord[]>([]);
  const [foodItems, setFoodItems] = useState<FoodPlannerRecord[]>([]);
  const [packingItems, setPackingItems] = useState<PackingItemRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!tripId || !isIndexedDBAvailable()) {
      setIsLoading(false);
      return;
    }

    try {
      setError(null);
      const [
        tripData,
        memoryList,
        itinList,
        expenseList,
        rentalList,
        foodList,
        packingList,
      ] = await Promise.all([
        getTrip(tripId),
        getMemoriesForTrip(tripId),
        getItinerariesForTrip(tripId),
        getExpensesForTrip(tripId),
        getRentalsForTrip(tripId),
        getFoodItemsForTrip(tripId),
        getPackingItemsForTrip(tripId),
      ]);

      setTrip(tripData);
      setMemories(memoryList);
      setItineraries(itinList);
      setExpenses(expenseList);
      setRentals(rentalList);
      setFoodItems(foodList);
      setPackingItems(packingList);
    } catch (err) {
      console.error("Failed loading memories & dossier from vault:", err);
      setError("Unable to load trip memories and dossier.");
    } finally {
      setIsLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    let mounted = true;
    if (!tripId) return;

    (async () => {
      try {
        const [
          tripData,
          memoryList,
          itinList,
          expenseList,
          rentalList,
          foodList,
          packingList,
        ] = await Promise.all([
          getTrip(tripId),
          getMemoriesForTrip(tripId),
          getItinerariesForTrip(tripId),
          getExpensesForTrip(tripId),
          getRentalsForTrip(tripId),
          getFoodItemsForTrip(tripId),
          getPackingItemsForTrip(tripId),
        ]);
        if (mounted) {
          setTrip(tripData);
          setMemories(memoryList);
          setItineraries(itinList);
          setExpenses(expenseList);
          setRentals(rentalList);
          setFoodItems(foodList);
          setPackingItems(packingList);
        }
      } catch (err) {
        if (mounted) {
          console.error("Failed initial memories load:", err);
          setError("Unable to load memories.");
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

  // Derived: Expedition Dossier Summary Stats (REQ-MEM-01)
  const dossierStats: ExpeditionDossierStats = useMemo(() => {
    if (!trip) {
      return {
        isCompleted: false,
        daysOnRoad: 0,
        totalDistanceKm: 0,
        rentalDistanceKm: 0,
        routeDistanceKm: 0,
        totalBudget: 0,
        totalSpent: 0,
        budgetVariance: 0,
        depositPendingRefund: 0,
        activitiesTotal: 0,
        activitiesCompleted: 0,
        activityCompletionPct: 0,
        dishesTotal: 0,
        dishesTasted: 0,
        packingItemsTotal: 0,
        packingItemsPacked: 0,
        packingReadinessPct: 0,
        memoriesCount: 0,
        highlightsCount: 0,
      };
    }

    // Days on road
    let daysOnRoad = 1;
    if (trip.startDate) {
      const startMs = new Date(trip.startDate).getTime();
      const endMs = trip.endDate
        ? new Date(trip.endDate).getTime()
        : trip.completedAt
        ? new Date(trip.completedAt).getTime()
        : trip.updatedAt
        ? new Date(trip.updatedAt).getTime()
        : startMs;
      const diff = Math.max(1, Math.ceil((endMs - startMs) / (1000 * 60 * 60 * 24)));
      daysOnRoad = diff;
    }

    // Distance computation (Rental Odometers + Route Segments)
    let rentalDistanceKm = 0;
    rentals.forEach((r) => {
      if (r.endOdometerKm && r.endOdometerKm > r.startOdometerKm) {
        rentalDistanceKm += r.endOdometerKm - r.startOdometerKm;
      }
    });

    let routeDistanceKm = 0;
    (trip.routeSegments || []).forEach((seg) => {
      routeDistanceKm += seg.distanceKm || 0;
    });

    const totalDistanceKm = rentalDistanceKm + routeDistanceKm;

    // Expenses computation
    let totalSpent = 0;
    let depositPendingRefund = 0;
    expenses.forEach((e) => {
      if (!e.isDeposit) {
        totalSpent += e.amount || 0;
      } else {
        if (e.depositRefundStatus === "PENDING") {
          depositPendingRefund += e.amount || 0;
        }
      }
    });

    const totalBudget = trip.budgetTotal || 0;
    const budgetVariance = totalBudget - totalSpent;

    // Activities computation
    let activitiesTotal = 0;
    let activitiesCompleted = 0;
    itineraries.forEach((day) => {
      (day.activities || []).forEach((act) => {
        activitiesTotal++;
        if (act.status === "COMPLETED") activitiesCompleted++;
      });
    });
    const activityCompletionPct =
      activitiesTotal > 0 ? Math.round((activitiesCompleted / activitiesTotal) * 100) : 0;

    // Food computation
    const dishesTotal = foodItems.length;
    const dishesTasted = foodItems.filter((f) => f.status === "VISITED").length;

    // Packing computation
    const packingItemsTotal = packingItems.length;
    const packingItemsPacked = packingItems.filter((p) => p.isPacked).length;
    const packingReadinessPct =
      packingItemsTotal > 0 ? Math.round((packingItemsPacked / packingItemsTotal) * 100) : 0;

    // Memories computation
    const memoriesCount = memories.length;
    const highlightsCount = memories.filter((m) => m.isHighlight).length;

    return {
      isCompleted: trip.status === "COMPLETED",
      completionDate: trip.completedAt,
      daysOnRoad,
      totalDistanceKm,
      rentalDistanceKm,
      routeDistanceKm,
      totalBudget,
      totalSpent,
      budgetVariance,
      depositPendingRefund,
      activitiesTotal,
      activitiesCompleted,
      activityCompletionPct,
      dishesTotal,
      dishesTasted,
      packingItemsTotal,
      packingItemsPacked,
      packingReadinessPct,
      memoriesCount,
      highlightsCount,
    };
  }, [trip, rentals, expenses, itineraries, foodItems, packingItems, memories]);

  // Action: Add Memory (REQ-MEM-02)
  const addMemory = useCallback(
    async (params: {
      title: string;
      date?: string;
      location?: string;
      caption?: string;
      imageDataUrl?: string;
      isHighlight?: boolean;
      rating?: number;
    }): Promise<TripMemoryRecord> => {
      const id = "mem_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6);
      const now = new Date().toISOString();

      const newRecord: TripMemoryRecord = {
        id,
        tripId,
        title: params.title.trim(),
        date: params.date || now,
        location: params.location?.trim() || undefined,
        caption: params.caption?.trim() || undefined,
        imageDataUrl: params.imageDataUrl || undefined,
        isHighlight: !!params.isHighlight,
        rating: params.rating || 5,
        createdAt: now,
      };

      const saved = await saveMemory(tripId, newRecord);
      setMemories((prev) => [saved, ...prev]);
      notifyVaultChange();
      return saved;
    },
    [tripId]
  );

  // Action: Remove Memory
  const removeMemory = useCallback(
    async (memoryId: ID): Promise<boolean> => {
      const success = await deleteMemory(tripId, memoryId);
      if (success) {
        setMemories((prev) => prev.filter((m) => m.id !== memoryId));
        notifyVaultChange();
      }
      return success;
    },
    [tripId]
  );

  // Action: Toggle Highlight
  const toggleHighlight = useCallback(
    async (memoryId: ID): Promise<void> => {
      const target = memories.find((m) => m.id === memoryId);
      if (!target) return;
      const updated: TripMemoryRecord = {
        ...target,
        isHighlight: !target.isHighlight,
      };
      await saveMemory(tripId, updated);
      setMemories((prev) => prev.map((m) => (m.id === memoryId ? updated : m)));
      notifyVaultChange();
    },
    [tripId, memories]
  );

  // Action: Complete Trip Milestone (REQ-MEM-01)
  const markTripCompleted = useCallback(async (): Promise<TripRecord> => {
    const updated = await completeTripAndArchive(tripId);
    setTrip(updated);
    notifyVaultChange();
    return updated;
  }, [tripId]);

  // Action: Reopen Trip
  const reopenTripStatus = useCallback(async (): Promise<TripRecord> => {
    const updated = await reopenTrip(tripId);
    setTrip(updated);
    notifyVaultChange();
    return updated;
  }, [tripId]);

  // Action: Export to Public Journal (REQ-MEM-03)
  const exportToPublicJournal = useCallback(
    async (selectedMemoryIds?: string[]) => {
      if (!trip) throw new Error("No trip available to export.");

      const memoriesToExport = selectedMemoryIds?.length
        ? memories.filter((m) => selectedMemoryIds.includes(m.id))
        : memories;

      const payload = {
        tripId: trip.id,
        title: trip.title,
        destination: trip.destination,
        startDate: trip.startDate,
        endDate: trip.endDate || trip.completedAt,
        description: trip.notes || `Expedition across ${trip.destination}. Exported from Life Atlas Trip Vault.`,
        coverImage: trip.coverImage || memoriesToExport.find((m) => m.imageDataUrl)?.imageDataUrl,
        memories: memoriesToExport.map((m) => ({
          title: m.title,
          caption: m.caption,
          date: m.date,
          imageUrl: m.imageDataUrl,
        })),
        itineraryDays: itineraries.map((d) => ({
          dayIndex: d.dayIndex,
          date: d.date,
          title: d.title || `Day ${d.dayIndex + 1}`,
          description: d.description || d.activities?.map((a) => `${a.startTime || ""} ${a.title}`).join(", "),
        })),
      };

      const res = await fetch("/api/vault/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Server responded with status ${res.status}`);
      }

      return await res.json();
    },
    [trip, memories, itineraries]
  );

  return {
    trip,
    memories,
    dossierStats,
    itineraries,
    expenses,
    rentals,
    foodItems,
    packingItems,
    isLoading,
    error,
    addMemory,
    removeMemory,
    toggleHighlight,
    markTripCompleted,
    reopenTripStatus,
    exportToPublicJournal,
    refresh: loadData,
  };
}
