import { test, describe, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";

import {
  saveTrip,
  getTrip,
  saveBooking,
  saveRental,
  saveReminder,
  getRemindersForTrip,
  deleteTripCascade,
  deleteVaultDB,
} from "../../src/lib/vault/storage";
import {
  TripRecord,
  BookingRecord,
  VehicleRentalRecord,
  ReminderRecord,
} from "../../src/lib/vault/types";
import {
  generateNotificationNumericId,
  scheduleDepartureAlarmForBooking,
  scheduleCheckInAlarmForBooking,
  scheduleDropoffWarningForRental,
  cancelAndRemoveReminder,
} from "../../src/lib/vault/notifications";

describe("Trip Vault Phase 12: Android Local Notifications & Reminders Flow", () => {
  before(async () => {
    await deleteVaultDB();
  });

  beforeEach(async () => {
    await deleteVaultDB();
  });

  test("1. Notification Numeric ID Generator & Channel Setup (REQ-NOT-01)", () => {
    const key1 = "rem_dep_booking_12345";
    const key2 = "rem_rnt_rental_98765";
    const id1 = generateNotificationNumericId(key1);
    const id2 = generateNotificationNumericId(key2);

    assert.ok(typeof id1 === "number");
    assert.ok(typeof id2 === "number");
    assert.ok(id1 > 0);
    assert.ok(id2 > 0);
    // Stable hash check
    assert.strictEqual(generateNotificationNumericId(key1), id1);
  });

  test("2. Departure & Check-in Alarms Scheduling (REQ-NOT-02)", async () => {
    const tripId = "trip-notif-shimla";
    const trip: TripRecord = {
      id: tripId,
      title: "Shimla Heritage Mountain Railway",
      destination: "Shimla, HP",
      startDate: "2026-09-10T00:00:00.000Z",
      status: "PLANNING",
      travelStyle: "BACKPACKING",
      budgetTotal: 30000,
      currency: "INR",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await saveTrip(trip);

    // Create train booking departing in 24 hours
    const departureTime = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const trainBooking: BookingRecord = {
      id: "bkg-kalka-shimla-toy-train",
      tripId,
      category: "TRANSPORT",
      type: "TRAIN",
      title: "Himalayan Queen Express (Toy Train)",
      pnrNumber: "2849102834",
      carrierOrVendor: "Northern Railway 52455",
      seatOrRoomDetails: "Coach FC, Seat 12 (Window)",
      departureOrCheckInTime: departureTime,
      departureOrPropertyAddress: "Kalka Railway Station, Platform 3",
      totalCost: 950,
      currency: "INR",
      depositPaid: 950,
      balanceDue: 0,
      status: "CONFIRMED",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await saveBooking(trainBooking);

    // Schedule 2 hours ahead departure alarm
    const departureReminder = await scheduleDepartureAlarmForBooking(trainBooking, 2);
    assert.ok(departureReminder);
    assert.strictEqual(departureReminder.relatedType, "TRANSPORT");
    assert.strictEqual(departureReminder.relatedEntityId, trainBooking.id);
    assert.ok(departureReminder.title.includes("Departure Warning"));
    assert.ok(departureReminder.body.includes("2849102834"));
    assert.ok(departureReminder.body.includes("Coach FC, Seat 12"));

    // Create hotel stay check-in booking
    const checkInTime = new Date(Date.now() + 30 * 60 * 60 * 1000).toISOString();
    const stayBooking: BookingRecord = {
      id: "bkg-woodville-palace",
      tripId,
      category: "ACCOMMODATION",
      type: "HOTEL",
      title: "Woodville Palace Heritage Hotel",
      carrierOrVendor: "Woodville Palace",
      seatOrRoomDetails: "Imperial Suite 104",
      departureOrCheckInTime: checkInTime,
      departureOrPropertyAddress: "Raj Bhavan Road, Shimla",
      totalCost: 12000,
      currency: "INR",
      depositPaid: 4000,
      balanceDue: 8000,
      status: "CONFIRMED",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await saveBooking(stayBooking);

    // Schedule check-in alarm
    const checkInReminder = await scheduleCheckInAlarmForBooking(stayBooking, 2);
    assert.ok(checkInReminder);
    assert.strictEqual(checkInReminder.relatedType, "ACCOMMODATION");
    assert.ok(checkInReminder.title.includes("Check-in Today"));
    assert.ok(checkInReminder.body.includes("Imperial Suite 104"));

    const storedReminders = await getRemindersForTrip(tripId);
    assert.strictEqual(storedReminders.length, 2);
  });

  test("3. Rental Drop-off Warning 3 Hours Prior to Deadline (REQ-NOT-03)", async () => {
    const tripId = "trip-notif-shimla";
    const trip: TripRecord = {
      id: tripId,
      title: "Shimla Heritage Mountain Railway",
      destination: "Shimla, HP",
      startDate: "2026-09-10T00:00:00.000Z",
      status: "PLANNING",
      travelStyle: "BACKPACKING",
      budgetTotal: 30000,
      currency: "INR",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await saveTrip(trip);

    // Drop-off deadline in 12 hours
    const dropoffTime = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
    const rental: VehicleRentalRecord = {
      id: "rnt-himalayan-450",
      tripId,
      vehicleType: "MOTORCYCLE",
      vehicleModel: "Royal Enfield Himalayan 450",
      vehicleRegNumber: "HP-01-AA-4402",
      vendorName: "Kaza Wheels & Rides",
      vendorPhone: "+91-9816012345",
      pickupLocation: "Kaza Market",
      pickupTime: new Date().toISOString(),
      dropoffLocation: "Kaza Market",
      dropoffTime,
      startOdometerKm: 12000,
      dailyRate: 2200,
      securityDeposit: 5000,
      depositPaymentMode: "CASH",
      depositRefundStatus: "PENDING",
      gearIncluded: ["Helmet x2", "Bungee Cords"],
      inspectionPhotos: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await saveRental(rental);

    // Schedule 3-hour drop-off warning
    const dropoffReminder = await scheduleDropoffWarningForRental(rental, 3);
    assert.ok(dropoffReminder);
    assert.strictEqual(dropoffReminder.relatedType, "RENTAL");
    assert.strictEqual(dropoffReminder.relatedEntityId, rental.id);
    assert.ok(dropoffReminder.title.includes("Rental Return Deadline"));
    assert.ok(dropoffReminder.body.includes("3 hours"));
    assert.ok(dropoffReminder.body.includes("5,000")); // deposit recovery reminder
    assert.ok(dropoffReminder.body.includes("+91-9816012345"));

    // Verify trigger time is set 3 hours before drop-off
    const expectedTriggerTime = new Date(new Date(dropoffTime).getTime() - 3 * 60 * 60 * 1000).toISOString();
    assert.strictEqual(dropoffReminder.triggerTime, expectedTriggerTime);
  });

  test("4. Cancel & Remove Reminder and Atomic Cascade Erasure", async () => {
    const tripId = "trip-notif-cancel";
    const trip: TripRecord = {
      id: tripId,
      title: "Cancel Test Trip",
      destination: "Manali",
      startDate: "2026-09-01T00:00:00.000Z",
      status: "PLANNING",
      travelStyle: "MOTORCYCLE",
      budgetTotal: 15000,
      currency: "INR",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await saveTrip(trip);

    const reminder: ReminderRecord = {
      id: "rem-custom-1",
      tripId,
      title: "Check Engine Oil Level",
      body: "Inspect before heading up Rohtang Pass",
      triggerTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      relatedType: "CUSTOM",
      nativeNotificationId: 99128,
      isTriggered: false,
      isCancelled: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await saveReminder(reminder);

    let reminders = await getRemindersForTrip(tripId);
    assert.strictEqual(reminders.length, 1);

    // Cancel and remove single reminder
    const canceled = await cancelAndRemoveReminder("rem-custom-1");
    assert.strictEqual(canceled, true);

    reminders = await getRemindersForTrip(tripId);
    assert.strictEqual(reminders.length, 0);

    // Add another reminder to verify cascade delete
    await saveReminder({
      ...reminder,
      id: "rem-custom-2",
    });

    await deleteTripCascade(tripId);
    const postCascade = await getRemindersForTrip(tripId);
    assert.strictEqual(postCascade.length, 0);

    const postTrip = await getTrip(tripId);
    assert.strictEqual(postTrip, null);
  });
});
