"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  BookingRecord,
  BookingStatus,
  ID,
} from "./types";
import {
  getBookingsForTrip,
  saveBooking,
  deleteBooking as deleteBookingStorage,
  isIndexedDBAvailable,
} from "./storage";
import { notifyVaultChange } from "./useTripVault";

export function useBookings(tripId: string) {
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadBookings = useCallback(async () => {
    if (!tripId || !isIndexedDBAvailable()) {
      setIsLoading(false);
      return;
    }

    try {
      setError(null);
      const data = await getBookingsForTrip(tripId);
      // Sort: chronological by departure/check-in time if available
      data.sort((a, b) => {
        const timeA = a.departureOrCheckInTime ? new Date(a.departureOrCheckInTime).getTime() : 0;
        const timeB = b.departureOrCheckInTime ? new Date(b.departureOrCheckInTime).getTime() : 0;
        return timeA - timeB;
      });
      setBookings(data);
    } catch (err) {
      console.error("Failed loading bookings:", err);
      setError("Unable to load booking records from local storage.");
    } finally {
      setIsLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    let mounted = true;
    if (!tripId) return;

    (async () => {
      try {
        const data = await getBookingsForTrip(tripId);
        if (mounted) {
          data.sort((a, b) => {
            const timeA = a.departureOrCheckInTime ? new Date(a.departureOrCheckInTime).getTime() : 0;
            const timeB = b.departureOrCheckInTime ? new Date(b.departureOrCheckInTime).getTime() : 0;
            return timeA - timeB;
          });
          setBookings(data);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          console.error("Failed initial bookings fetch:", err);
          setError("Failed to load bookings.");
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [tripId]);

  // Create or update a booking
  const addBooking = useCallback(
    async (
      bookingData: Omit<BookingRecord, "id" | "tripId" | "createdAt" | "updatedAt"> & {
        id?: ID;
      }
    ): Promise<BookingRecord> => {
      const now = new Date().toISOString();
      const totalCost = Number(bookingData.totalCost) || 0;
      const depositPaid = Number(bookingData.depositPaid) || 0;
      const balanceDue = Math.max(0, totalCost - depositPaid);

      const newBooking: BookingRecord = {
        ...bookingData,
        id: bookingData.id || `bkg-${tripId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        tripId,
        totalCost,
        depositPaid,
        balanceDue,
        createdAt: now,
        updatedAt: now,
      };

      const saved = await saveBooking(newBooking);
      setBookings((prev) => {
        const updated = [...prev, saved];
        return updated.sort((a, b) => {
          const timeA = a.departureOrCheckInTime ? new Date(a.departureOrCheckInTime).getTime() : 0;
          const timeB = b.departureOrCheckInTime ? new Date(b.departureOrCheckInTime).getTime() : 0;
          return timeA - timeB;
        });
      });
      notifyVaultChange();
      return saved;
    },
    [tripId]
  );

  // Update an existing booking
  const updateBooking = useCallback(
    async (booking: BookingRecord): Promise<BookingRecord> => {
      const totalCost = Number(booking.totalCost) || 0;
      const depositPaid = Number(booking.depositPaid) || 0;
      const balanceDue = Math.max(0, totalCost - depositPaid);

      const updatedRecord: BookingRecord = {
        ...booking,
        totalCost,
        depositPaid,
        balanceDue,
        updatedAt: new Date().toISOString(),
      };

      const saved = await saveBooking(updatedRecord);
      setBookings((prev) => prev.map((b) => (b.id === saved.id ? saved : b)));
      notifyVaultChange();
      return saved;
    },
    []
  );

  // Delete a booking
  const removeBooking = useCallback(async (bookingId: ID): Promise<boolean> => {
    const success = await deleteBookingStorage(bookingId);
    if (success) {
      setBookings((prev) => prev.filter((b) => b.id !== bookingId));
      notifyVaultChange();
    }
    return success;
  }, []);

  // Update booking status
  const changeBookingStatus = useCallback(
    async (bookingId: ID, status: BookingStatus): Promise<BookingRecord> => {
      const existing = bookings.find((b) => b.id === bookingId);
      if (!existing) throw new Error(`Booking with ID '${bookingId}' not found.`);

      const updated: BookingRecord = {
        ...existing,
        status,
        updatedAt: new Date().toISOString(),
      };

      const saved = await saveBooking(updated);
      setBookings((prev) => prev.map((b) => (b.id === saved.id ? saved : b)));
      notifyVaultChange();
      return saved;
    },
    [bookings]
  );

  // Financial and category calculations
  const financials = useMemo(() => {
    let totalCost = 0;
    let totalDeposits = 0;
    let totalBalanceDue = 0;
    let transportCount = 0;
    let accommodationCount = 0;

    bookings.forEach((b) => {
      totalCost += b.totalCost || 0;
      totalDeposits += b.depositPaid || 0;
      totalBalanceDue += b.balanceDue || 0;
      if (b.category === "TRANSPORT") transportCount++;
      if (b.category === "ACCOMMODATION") accommodationCount++;
    });

    return {
      totalCost,
      totalDeposits,
      totalBalanceDue,
      transportCount,
      accommodationCount,
      totalCount: bookings.length,
    };
  }, [bookings]);

  return {
    bookings,
    isLoading,
    error,
    financials,
    refreshBookings: loadBookings,
    addBooking,
    updateBooking,
    removeBooking,
    changeBookingStatus,
  };
}
