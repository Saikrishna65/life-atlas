import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import {
  BookingRecord,
  VehicleRentalRecord,
  ReminderRecord,
  ID,
} from "./types";
import {
  saveReminder,
  deleteReminder,
  getTrip,
} from "./storage";
import { notifyVaultChange } from "./useTripVault";

export const NOTIFICATION_CHANNEL_ID = "trip_vault_expedition_channel";

/**
 * Generates a stable 32-bit positive integer ID from a string key
 */
export function generateNotificationNumericId(key: string): number {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    const char = key.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash) % 2147483647 || Math.floor(Math.random() * 100000) + 1;
}

/**
 * Initializes the native Android notification channel
 */
export async function initializeNotificationChannel(): Promise<void> {
  if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("LocalNotifications")) {
    try {
      await LocalNotifications.createChannel({
        id: NOTIFICATION_CHANNEL_ID,
        name: "Expedition Vault Alerts",
        description: "Crucial departures, check-in deadlines, and rental drop-off warnings",
        importance: 5, // High importance (heads-up notification banner)
        visibility: 1, // Public visibility on lockscreen
        sound: "default",
        vibration: true,
        lights: true,
        lightColor: "#D4AF37", // Gold LED light
      });
    } catch (err) {
      console.warn("Could not create Android notification channel:", err);
    }
  }
}

/**
 * Checks current notification permissions
 */
export async function checkNotificationPermissions(): Promise<boolean> {
  if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("LocalNotifications")) {
    try {
      const status = await LocalNotifications.checkPermissions();
      return status.display === "granted";
    } catch (err) {
      console.error("Failed to check notification permissions:", err);
      return false;
    }
  } else if (typeof window !== "undefined" && "Notification" in window) {
    return Notification.permission === "granted";
  }
  return false;
}

/**
 * Requests notification permissions from the user
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("LocalNotifications")) {
    try {
      await initializeNotificationChannel();
      const status = await LocalNotifications.requestPermissions();
      return status.display === "granted";
    } catch (err) {
      console.error("Failed requesting native notification permissions:", err);
      return false;
    }
  } else if (typeof window !== "undefined" && "Notification" in window) {
    try {
      const perm = await Notification.requestPermission();
      return perm === "granted";
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * Schedules a native local notification
 */
export async function scheduleNativeNotification(params: {
  id: number;
  title: string;
  body: string;
  scheduleAt: Date;
  extra?: Record<string, string>;
}): Promise<boolean> {
  const { id, title, body, scheduleAt, extra } = params;

  if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("LocalNotifications")) {
    try {
      await initializeNotificationChannel();
      await LocalNotifications.schedule({
        notifications: [
          {
            id,
            title,
            body,
            schedule: { at: scheduleAt, allowWhileIdle: true },
            channelId: NOTIFICATION_CHANNEL_ID,
            smallIcon: "ic_launcher_round",
            sound: "default",
            extra,
          },
        ],
      });
      return true;
    } catch (err) {
      console.error("Failed to schedule native local notification:", err);
      return false;
    }
  } else if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
    const delayMs = scheduleAt.getTime() - Date.now();
    if (delayMs > 0 && delayMs < 2147483647) {
      setTimeout(() => {
        try {
          new Notification(title, { body });
        } catch (e) {
          console.warn("Browser notification error:", e);
        }
      }, delayMs);
    } else if (delayMs <= 0) {
      try {
        new Notification(title, { body });
      } catch (e) {
        console.warn("Browser notification error:", e);
      }
    }
    return true;
  }
  return true;
}

/**
 * Cancels a scheduled local notification
 */
export async function cancelNativeNotification(numericId: number): Promise<boolean> {
  if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("LocalNotifications")) {
    try {
      await LocalNotifications.cancel({
        notifications: [{ id: numericId }],
      });
      return true;
    } catch (err) {
      console.error("Failed to cancel native notification:", err);
      return false;
    }
  }
  return true;
}

/**
 * Triggers an immediate or fast-firing test notification (e.g. in 5 seconds)
 */
export async function triggerTestNotification(secondsAhead: number = 5): Promise<boolean> {
  const targetDate = new Date(Date.now() + secondsAhead * 1000);
  const testId = Math.floor(Math.random() * 900000) + 100000;

  return scheduleNativeNotification({
    id: testId,
    title: "⚡ Life Atlas Vault: Test Alarm",
    body: `System alarm test executed successfully at ${targetDate.toLocaleTimeString()}. Local notifications are fully operational!`,
    scheduleAt: targetDate,
    extra: { test: "true" },
  });
}

/**
 * REQ-NOT-02: Schedules a departure alarm for a transport booking (Train / Flight / Bus)
 * Default: 2 hours before scheduled departure
 */
export async function scheduleDepartureAlarmForBooking(
  booking: BookingRecord,
  hoursAhead: number = 2
): Promise<ReminderRecord> {
  const trip = await getTrip(booking.tripId);
  const tripTitle = trip?.title || "Expedition";

  const departureIso = booking.departureOrCheckInTime;
  if (!departureIso) {
    throw new Error("Cannot schedule departure alarm: Booking has no departure time configured.");
  }

  const departureDate = new Date(departureIso);
  const triggerDate = new Date(departureDate.getTime() - hoursAhead * 60 * 60 * 1000);

  // If triggerDate has already passed, schedule 10 minutes out or immediately
  const finalTriggerDate = triggerDate.getTime() > Date.now() ? triggerDate : new Date(Date.now() + 60 * 1000);

  const reminderId = `rem_dep_${booking.id}`;
  const numericId = generateNotificationNumericId(reminderId);

  const timeStr = departureDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const dateStr = departureDate.toLocaleDateString([], { month: "short", day: "numeric" });

  let title = `🚆 Departure Warning: ${booking.title}`;
  if (booking.type === "FLIGHT") title = `✈️ Flight Boarding: ${booking.title}`;
  if (booking.type === "BUS") title = `🚌 Bus Boarding: ${booking.title}`;

  let body = `${booking.carrierOrVendor || "Transport"} departs at ${timeStr} (${dateStr}).`;
  if (booking.pnrNumber) body += ` PNR: ${booking.pnrNumber}.`;
  if (booking.seatOrRoomDetails) body += ` Seat/Berth: ${booking.seatOrRoomDetails}.`;
  if (booking.departureOrPropertyAddress) body += ` Station/Terminal: ${booking.departureOrPropertyAddress}.`;

  const now = new Date().toISOString();
  const reminder: ReminderRecord = {
    id: reminderId,
    tripId: booking.tripId,
    title,
    body,
    triggerTime: finalTriggerDate.toISOString(),
    relatedType: "TRANSPORT",
    relatedEntityId: booking.id,
    nativeNotificationId: numericId,
    isTriggered: false,
    isCancelled: false,
    createdAt: now,
    updatedAt: now,
  };

  await saveReminder(reminder);
  await scheduleNativeNotification({
    id: numericId,
    title,
    body,
    scheduleAt: finalTriggerDate,
    extra: { tripId: booking.tripId, bookingId: booking.id, tripTitle },
  });

  notifyVaultChange();
  return reminder;
}

/**
 * REQ-NOT-02: Schedules a check-in alarm for an accommodation stay
 * Default: At 11:00 AM on check-in day, or 2 hours before check-in time
 */
export async function scheduleCheckInAlarmForBooking(
  booking: BookingRecord,
  hoursAhead: number = 2
): Promise<ReminderRecord> {
  const checkInIso = booking.departureOrCheckInTime;
  if (!checkInIso) {
    throw new Error("Cannot schedule stay alarm: Booking has no check-in date/time configured.");
  }

  const checkInDate = new Date(checkInIso);
  const triggerDate = new Date(checkInDate.getTime() - hoursAhead * 60 * 60 * 1000);
  const finalTriggerDate = triggerDate.getTime() > Date.now() ? triggerDate : new Date(Date.now() + 60 * 1000);

  const reminderId = `rem_stay_${booking.id}`;
  const numericId = generateNotificationNumericId(reminderId);

  const title = `🏨 Check-in Today: ${booking.title}`;
  let body = `Check-in opens for ${booking.carrierOrVendor || "Stay"}.`;
  if (booking.seatOrRoomDetails) body += ` Room: ${booking.seatOrRoomDetails}.`;
  if (booking.departureOrPropertyAddress) body += ` Address: ${booking.departureOrPropertyAddress}.`;

  const now = new Date().toISOString();
  const reminder: ReminderRecord = {
    id: reminderId,
    tripId: booking.tripId,
    title,
    body,
    triggerTime: finalTriggerDate.toISOString(),
    relatedType: "ACCOMMODATION",
    relatedEntityId: booking.id,
    nativeNotificationId: numericId,
    isTriggered: false,
    isCancelled: false,
    createdAt: now,
    updatedAt: now,
  };

  await saveReminder(reminder);
  await scheduleNativeNotification({
    id: numericId,
    title,
    body,
    scheduleAt: finalTriggerDate,
    extra: { tripId: booking.tripId, bookingId: booking.id },
  });

  notifyVaultChange();
  return reminder;
}

/**
 * REQ-NOT-03: Schedules a warning 3 hours before bike rental deadline to avoid penalty
 */
export async function scheduleDropoffWarningForRental(
  rental: VehicleRentalRecord,
  hoursAhead: number = 3
): Promise<ReminderRecord> {
  const dropoffIso = rental.dropoffTime;
  if (!dropoffIso) {
    throw new Error("Cannot schedule rental return warning: Rental has no drop-off date configured.");
  }

  const dropoffDate = new Date(dropoffIso);
  const triggerDate = new Date(dropoffDate.getTime() - hoursAhead * 60 * 60 * 1000);
  const finalTriggerDate = triggerDate.getTime() > Date.now() ? triggerDate : new Date(Date.now() + 60 * 1000);

  const reminderId = `rem_rnt_${rental.id}`;
  const numericId = generateNotificationNumericId(reminderId);

  const title = `🏍️ Rental Return Deadline: ${rental.vehicleModel}`;
  const dateStr = dropoffDate.toLocaleDateString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

  let body = `Return due in ${hoursAhead} hours (${dateStr}) to avoid late penalty. Refuel per rental policy.`;
  if (rental.securityDeposit) {
    body += ` Inspect vehicle with vendor to recover your ₹${rental.securityDeposit.toLocaleString()} security deposit.`;
  }
  if (rental.vendorPhone) {
    body += ` Vendor Hotline: ${rental.vendorPhone}.`;
  }

  const now = new Date().toISOString();
  const reminder: ReminderRecord = {
    id: reminderId,
    tripId: rental.tripId,
    title,
    body,
    triggerTime: finalTriggerDate.toISOString(),
    relatedType: "RENTAL",
    relatedEntityId: rental.id,
    nativeNotificationId: numericId,
    isTriggered: false,
    isCancelled: false,
    createdAt: now,
    updatedAt: now,
  };

  await saveReminder(reminder);
  await scheduleNativeNotification({
    id: numericId,
    title,
    body,
    scheduleAt: finalTriggerDate,
    extra: { tripId: rental.tripId, rentalId: rental.id },
  });

  notifyVaultChange();
  return reminder;
}

/**
 * Cancels a scheduled reminder and removes it from IndexedDB
 */
export async function cancelAndRemoveReminder(id: ID): Promise<boolean> {
  const numericId = generateNotificationNumericId(id);
  await cancelNativeNotification(numericId);
  const deleted = await deleteReminder(id);
  notifyVaultChange();
  return deleted;
}
