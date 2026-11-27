"use client";
import { defaultTripSettings } from "../finance/trips/policy";

import { useSyncExternalStore, useCallback, useMemo } from "react";
import {
  tripListSession,
  subscribeTripList,
  VAULT_CHANGE_EVENT,
} from "./trip-list-session";
import { TripRecord, TripStatus, ID } from "./types";
import { getTrip, saveTrip, deleteTripCascade } from "./storage";

/**
 * Triggers a custom window event to sync state across mounted components
 */
export function notifyVaultChange(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(VAULT_CHANGE_EVENT));
  }
}

export function useTripVault() {
  const snapshot = useSyncExternalStore(
    subscribeTripList,
    tripListSession.snapshot,
    tripListSession.serverSnapshot,
  );
  const trips = snapshot.value;
  const isLoading = !snapshot.ready;
  const error = snapshot.error;
  const loadTrips = tripListSession.refresh;

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
      tripData: Omit<TripRecord, "id" | "createdAt" | "updatedAt"> & {
        id?: ID;
      },
    ): Promise<TripRecord> => {
      const now = new Date().toISOString();
      const newTrip: TripRecord = {
        ...tripData,
        id:
          tripData.id ||
          `trip-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        createdAt: now,
        updatedAt: now,
      };

      newTrip.finance =
        newTrip.finance || defaultTripSettings(newTrip) || undefined;
      const saved = await saveTrip(newTrip);
      notifyVaultChange();
      return saved;
    },
    [],
  );

  // Update existing trip
  const updateTrip = useCallback(
    async (trip: TripRecord): Promise<TripRecord> => {
      const saved = await saveTrip(trip);
      notifyVaultChange();
      return saved;
    },
    [],
  );

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
    [],
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
 * REQ-FND-03 alias for reactive Atlas Trips hook
 */
export const useTripVaultStore = useTripVault;
