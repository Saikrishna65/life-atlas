"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  TripRecord,
  TripStatus,
  ID,
} from "./types";
import {
  getAllTrips,
  getTrip,
  saveTrip,
  deleteTripCascade,
  isIndexedDBAvailable,
} from "./storage";

const VAULT_CHANGE_EVENT = "life_atlas_vault_change";

/**
 * Triggers a custom window event to sync state across mounted components
 */
export function notifyVaultChange(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(VAULT_CHANGE_EVENT));
  }
}

export function useTripVault() {
  const [trips, setTrips] = useState<TripRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadTrips = useCallback(async () => {
    if (!isIndexedDBAvailable()) {
      setError("IndexedDB storage is not supported in this environment.");
      setIsLoading(false);
      return;
    }

    try {
      setError(null);
      const data = await getAllTrips();
      setTrips(data);
    } catch (err) {
      console.error("Failed loading trips from vault:", err);
      setError("Unable to load expeditions from local storage.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const fetchInitial = async () => {
      if (!isIndexedDBAvailable()) {
        if (mounted) {
          setError("IndexedDB storage is not supported in this environment.");
          setIsLoading(false);
        }
        return;
      }

      try {
        const data = await getAllTrips();
        if (mounted) {
          setTrips(data);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          console.error("Failed loading trips from vault:", err);
          setError("Unable to load expeditions from local storage.");
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    fetchInitial();

    const handleChange = () => {
      loadTrips();
    };

    window.addEventListener(VAULT_CHANGE_EVENT, handleChange);
    return () => {
      mounted = false;
      window.removeEventListener(VAULT_CHANGE_EVENT, handleChange);
    };
  }, [loadTrips]);

  // Compute active trip: First trip marked ACTIVE, or the next upcoming trip
  const activeTrip = useMemo(() => {
    const active = trips.find((t) => t.status === "ACTIVE");
    if (active) return active;
    const upcoming = trips.find((t) => t.status === "PLANNING");
    return upcoming || trips[0] || null;
  }, [trips]);

  // Create a new trip
  const createTrip = useCallback(
    async (
      tripData: Omit<TripRecord, "id" | "createdAt" | "updatedAt"> & { id?: ID }
    ): Promise<TripRecord> => {
      const now = new Date().toISOString();
      const newTrip: TripRecord = {
        ...tripData,
        id: tripData.id || `trip-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        createdAt: now,
        updatedAt: now,
      };

      const saved = await saveTrip(newTrip);
      notifyVaultChange();
      return saved;
    },
    []
  );

  // Update existing trip
  const updateTrip = useCallback(async (trip: TripRecord): Promise<TripRecord> => {
    const saved = await saveTrip(trip);
    notifyVaultChange();
    return saved;
  }, []);

  // Update status (e.g. from PLANNING -> ACTIVE -> COMPLETED)
  const changeTripStatus = useCallback(
    async (tripId: ID, status: TripStatus): Promise<TripRecord> => {
      const existing = await getTrip(tripId);
      if (!existing) {
        throw new Error(`Trip with ID '${tripId}' not found.`);
      }

      const updated: TripRecord = {
        ...existing,
        status,
        updatedAt: new Date().toISOString(),
      };

      const saved = await saveTrip(updated);
      notifyVaultChange();
      return saved;
    },
    []
  );

  // Atomic cascade delete
  const deleteTrip = useCallback(async (tripId: ID): Promise<boolean> => {
    const success = await deleteTripCascade(tripId);
    if (success) {
      notifyVaultChange();
    }
    return success;
  }, []);

  return {
    trips,
    activeTrip,
    isLoading,
    error,
    refreshTrips: loadTrips,
    createTrip,
    updateTrip,
    changeTripStatus,
    deleteTrip,
    getTripById: getTrip,
  };
}

/**
 * REQ-FND-03 alias for reactive Trip Vault hook
 */
export const useTripVaultStore = useTripVault;
