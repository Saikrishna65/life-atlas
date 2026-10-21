"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  ReminderRecord,
  BookingRecord,
  VehicleRentalRecord,
  TripRecord,
  ID,
} from "./types";
import {
  getRemindersForTrip,
  saveReminder,
  deleteReminder,
  getBookingsForTrip,
  getRentalsForTrip,
  getTrip,
  isIndexedDBAvailable,
} from "./storage";
import {
  checkNotificationPermissions,
  requestNotificationPermissions,
  scheduleNativeNotification,
  cancelNativeNotification,
  scheduleDepartureAlarmForBooking,
  scheduleCheckInAlarmForBooking,
  scheduleDropoffWarningForRental,
  triggerTestNotification,
  generateNotificationNumericId,
} from "./notifications";
import { notifyVaultChange } from "./useTripVault";

export function useReminders(tripId: string) {
  const [trip, setTrip] = useState<TripRecord | null>(null);
  const [reminders, setReminders] = useState<ReminderRecord[]>([]);
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [rentals, setRentals] = useState<VehicleRentalRecord[]>([]);
  const [permissionGranted, setPermissionGranted] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!tripId || !isIndexedDBAvailable()) {
      setIsLoading(false);
      return;
    }

    try {
      setError(null);
      const [tripData, reminderList, bookingList, rentalList, isPermitted] = await Promise.all([
        getTrip(tripId),
        getRemindersForTrip(tripId),
        getBookingsForTrip(tripId),
        getRentalsForTrip(tripId),
        checkNotificationPermissions(),
      ]);

      setTrip(tripData);
      setReminders(reminderList);
      setBookings(bookingList);
      setRentals(rentalList);
      setPermissionGranted(isPermitted);
    } catch (err) {
      console.error("Failed loading reminders from vault:", err);
      setError("Unable to load reminders and notification schedules.");
    } finally {
      setIsLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    let mounted = true;
    if (!tripId) return;

    (async () => {
      try {
        const [tripData, reminderList, bookingList, rentalList, isPermitted] = await Promise.all([
          getTrip(tripId),
          getRemindersForTrip(tripId),
          getBookingsForTrip(tripId),
          getRentalsForTrip(tripId),
          checkNotificationPermissions(),
        ]);
        if (mounted) {
          setTrip(tripData);
          setReminders(reminderList);
          setBookings(bookingList);
          setRentals(rentalList);
          setPermissionGranted(isPermitted);
        }
      } catch (err) {
        if (mounted) {
          console.error("Failed initial reminders load:", err);
          setError("Unable to load reminders.");
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

  // Derived timeline: Upcoming vs Triggered
  const { activeReminders, pastReminders } = useMemo(() => {
    const nowIso = new Date().toISOString();
    const active: ReminderRecord[] = [];
    const past: ReminderRecord[] = [];

    reminders.forEach((r) => {
      if (!r.isCancelled && r.triggerTime > nowIso) {
        active.push(r);
      } else {
        past.push(r);
      }
    });

    return {
      activeReminders: active,
      pastReminders: past,
    };
  }, [reminders]);

  // Action: Request Notification Permissions
  const askPermission = useCallback(async (): Promise<boolean> => {
    const granted = await requestNotificationPermissions();
    setPermissionGranted(granted);
    return granted;
  }, []);

  // Action: Add Custom Reminder
  const addCustomReminder = useCallback(
    async (params: {
      title: string;
      body: string;
      triggerTime: string;
    }): Promise<ReminderRecord> => {
      const id = "rem_cst_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6);
      const numericId = generateNotificationNumericId(id);
      const now = new Date().toISOString();

      const newRecord: ReminderRecord = {
        id,
        tripId,
        title: params.title.trim(),
        body: params.body.trim(),
        triggerTime: params.triggerTime,
        relatedType: "CUSTOM",
        nativeNotificationId: numericId,
        isTriggered: false,
        isCancelled: false,
        createdAt: now,
        updatedAt: now,
      };

      const saved = await saveReminder(newRecord);
      setReminders((prev) => [...prev, saved]);

      await scheduleNativeNotification({
        id: numericId,
        title: params.title.trim(),
        body: params.body.trim(),
        scheduleAt: new Date(params.triggerTime),
        extra: { tripId, reminderId: id },
      });

      notifyVaultChange();
      return saved;
    },
    [tripId]
  );

  // Action: Schedule Departure Alarm (REQ-NOT-02)
  const scheduleDeparture = useCallback(
    async (booking: BookingRecord, hoursAhead: number = 2): Promise<ReminderRecord> => {
      const reminder = await scheduleDepartureAlarmForBooking(booking, hoursAhead);
      setReminders((prev) => {
        const filtered = prev.filter((r) => r.id !== reminder.id);
        return [...filtered, reminder];
      });
      return reminder;
    },
    []
  );

  // Action: Schedule Check-in Alarm (REQ-NOT-02)
  const scheduleCheckIn = useCallback(
    async (booking: BookingRecord, hoursAhead: number = 2): Promise<ReminderRecord> => {
      const reminder = await scheduleCheckInAlarmForBooking(booking, hoursAhead);
      setReminders((prev) => {
        const filtered = prev.filter((r) => r.id !== reminder.id);
        return [...filtered, reminder];
      });
      return reminder;
    },
    []
  );

  // Action: Schedule Rental Return Warning (REQ-NOT-03)
  const scheduleRentalWarning = useCallback(
    async (rental: VehicleRentalRecord, hoursAhead: number = 3): Promise<ReminderRecord> => {
      const reminder = await scheduleDropoffWarningForRental(rental, hoursAhead);
      setReminders((prev) => {
        const filtered = prev.filter((r) => r.id !== reminder.id);
        return [...filtered, reminder];
      });
      return reminder;
    },
    []
  );

  // Action: Remove / Cancel Reminder
  const removeReminder = useCallback(
    async (id: ID): Promise<boolean> => {
      const target = reminders.find((r) => r.id === id);
      if (target?.nativeNotificationId) {
        await cancelNativeNotification(target.nativeNotificationId);
      }
      setReminders((prev) => prev.filter((r) => r.id !== id));
      const deleted = await deleteReminder(id);
      notifyVaultChange();
      return deleted;
    },
    [reminders]
  );

  // Action: Test Instant Notification (5s)
  const triggerTest = useCallback(async (secondsAhead: number = 5): Promise<boolean> => {
    return triggerTestNotification(secondsAhead);
  }, []);

  return {
    trip,
    reminders,
    activeReminders,
    pastReminders,
    bookings,
    rentals,
    permissionGranted,
    isLoading,
    error,
    askPermission,
    addCustomReminder,
    scheduleDeparture,
    scheduleCheckIn,
    scheduleRentalWarning,
    removeReminder,
    triggerTest,
    refresh: loadData,
  };
}
