"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  VehicleRentalRecord,
  DepositRefundStatus,
  ID,
} from "./types";
import {
  getRentalsForTrip,
  saveRental,
  deleteRental,
  isIndexedDBAvailable,
} from "./storage";
import { notifyVaultChange } from "./useTripVault";

export interface RentalStats {
  totalVehicles: number;
  totalSecurityDeposit: number;
  pendingRefundAmount: number;
  refundedAmount: number;
  deductedAmount: number;
  totalKmDriven: number;
  activeRentals: number;
}

export function useRentals(tripId: string) {
  const [rentals, setRentals] = useState<VehicleRentalRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [now] = useState(() => Date.now());

  const loadRentals = useCallback(async () => {
    if (!tripId || !isIndexedDBAvailable()) {
      setIsLoading(false);
      return;
    }

    try {
      setError(null);
      const data = await getRentalsForTrip(tripId);
      // Sort newest pickup first
      data.sort((a, b) => new Date(b.pickupTime).getTime() - new Date(a.pickupTime).getTime());
      setRentals(data);
    } catch (err) {
      console.error("Failed loading rentals from vault:", err);
      setError("Unable to load vehicle rental records.");
    } finally {
      setIsLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    let mounted = true;
    if (!tripId) return;

    (async () => {
      try {
        const data = await getRentalsForTrip(tripId);
        if (mounted) {
          data.sort((a, b) => new Date(b.pickupTime).getTime() - new Date(a.pickupTime).getTime());
          setRentals(data);
        }
      } catch (err) {
        if (mounted) {
          console.error("Failed initial rentals load:", err);
          setError("Failed to load vehicle rentals.");
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    })();

    const handleVaultChange = () => {
      loadRentals();
    };

    window.addEventListener("vault-storage-change", handleVaultChange);
    return () => {
      mounted = false;
      window.removeEventListener("vault-storage-change", handleVaultChange);
    };
  }, [tripId, loadRentals]);

  // Aggregated fleet metrics
  const stats: RentalStats = useMemo(() => {
    const totalVehicles = rentals.length;
    let totalSecurityDeposit = 0;
    let pendingRefundAmount = 0;
    let refundedAmount = 0;
    let deductedAmount = 0;
    let totalKmDriven = 0;
    let activeRentals = 0;

    for (const r of rentals) {
      const deposit = Number(r.securityDeposit) || 0;
      totalSecurityDeposit += deposit;

      if (r.depositRefundStatus === "PENDING") {
        pendingRefundAmount += deposit;
      } else if (r.depositRefundStatus === "REFUNDED") {
        refundedAmount += deposit;
      } else if (r.depositRefundStatus === "DEDUCTED") {
        deductedAmount += deposit;
      }

      if (typeof r.endOdometerKm === "number" && r.endOdometerKm >= r.startOdometerKm) {
        totalKmDriven += (r.endOdometerKm - r.startOdometerKm);
      }

      const pTime = new Date(r.pickupTime).getTime();
      const dTime = new Date(r.dropoffTime).getTime();
      if (now >= pTime && now <= dTime) {
        activeRentals++;
      } else if (now < dTime && !r.endOdometerKm) {
        // Still open
        activeRentals++;
      }
    }

    return {
      totalVehicles,
      totalSecurityDeposit,
      pendingRefundAmount,
      refundedAmount,
      deductedAmount,
      totalKmDriven,
      activeRentals,
    };
  }, [rentals, now]);

  // Actions
  const addRental = useCallback(
    async (
      record: Omit<VehicleRentalRecord, "id" | "tripId" | "createdAt" | "updatedAt">
    ): Promise<VehicleRentalRecord> => {
      const newRental: VehicleRentalRecord = {
        ...record,
        id: `rental-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        tripId,
        gearIncluded: record.gearIncluded || [],
        inspectionPhotos: record.inspectionPhotos || [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const saved = await saveRental(newRental);
      notifyVaultChange();
      await loadRentals();
      return saved;
    },
    [tripId, loadRentals]
  );

  const updateRental = useCallback(
    async (rental: VehicleRentalRecord): Promise<VehicleRentalRecord> => {
      const updated: VehicleRentalRecord = {
        ...rental,
        updatedAt: new Date().toISOString(),
      };
      const saved = await saveRental(updated);
      notifyVaultChange();
      await loadRentals();
      return saved;
    },
    [loadRentals]
  );

  const updateOdometer = useCallback(
    async (id: ID, endOdometerKm: number) => {
      const current = rentals.find((r) => r.id === id);
      if (!current) return;

      await updateRental({
        ...current,
        endOdometerKm,
      });
    },
    [rentals, updateRental]
  );

  const updateDepositStatus = useCallback(
    async (id: ID, status: DepositRefundStatus, refundedDate?: string) => {
      const current = rentals.find((r) => r.id === id);
      if (!current) return;

      await updateRental({
        ...current,
        depositRefundStatus: status,
        depositRefundedDate: status === "REFUNDED" ? (refundedDate || new Date().toISOString()) : undefined,
      });
    },
    [rentals, updateRental]
  );

  const addInspectionPhoto = useCallback(
    async (id: ID, photoDataUrl: string) => {
      const current = rentals.find((r) => r.id === id);
      if (!current) return;

      const photos = [...(current.inspectionPhotos || []), photoDataUrl];
      await updateRental({
        ...current,
        inspectionPhotos: photos,
      });
    },
    [rentals, updateRental]
  );

  const removeInspectionPhoto = useCallback(
    async (id: ID, photoIndex: number) => {
      const current = rentals.find((r) => r.id === id);
      if (!current) return;

      const photos = [...(current.inspectionPhotos || [])];
      photos.splice(photoIndex, 1);
      await updateRental({
        ...current,
        inspectionPhotos: photos,
      });
    },
    [rentals, updateRental]
  );

  const removeRental = useCallback(
    async (id: ID) => {
      await deleteRental(id);
      notifyVaultChange();
      await loadRentals();
    },
    [loadRentals]
  );

  return {
    rentals,
    stats,
    isLoading,
    error,
    addRental,
    updateRental,
    updateOdometer,
    updateDepositStatus,
    addInspectionPhoto,
    removeInspectionPhoto,
    removeRental,
    refresh: loadRentals,
  };
}
