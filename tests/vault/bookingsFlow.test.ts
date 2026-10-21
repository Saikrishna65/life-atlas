import { test, describe, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";

import {
  saveTrip,
  saveBooking,
  getBooking,
  getBookingsForTrip,
  getBookingByPNR,
  deleteBooking,
  deleteTripCascade,
  deleteVaultDB,
} from "../../src/lib/vault/storage";
import {
  TripRecord,
  BookingRecord,
} from "../../src/lib/vault/types";

describe("Trip Vault Phase 4: Bookings, Transport & Accommodation Flow", () => {
  before(async () => {
    await deleteVaultDB();
  });

  beforeEach(async () => {
    await deleteVaultDB();
  });

  test("1. Transport Booking with PNR, Berth/Coach, and Index Query (REQ-BKG-01)", async () => {
    const trip: TripRecord = {
      id: "trip-bkg-test",
      title: "Himalayan Expedition",
      destination: "Manali & Spiti",
      startDate: "2026-07-15T00:00:00.000Z",
      status: "PLANNING",
      travelStyle: "MOTORCYCLE",
      budgetTotal: 40000,
      currency: "INR",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await saveTrip(trip);

    // Create IRCTC Train Booking with PNR
    const trainBooking: BookingRecord = {
      id: "bkg-train-12011",
      tripId: "trip-bkg-test",
      category: "TRANSPORT",
      type: "TRAIN",
      title: "New Delhi to Kalka Shatabdi Express",
      carrierOrVendor: "IRCTC Train 12011",
      pnrNumber: "2849182390",
      seatOrRoomDetails: "Coach C4, Seat 28 (Window)",
      departureOrCheckInTime: "2026-07-15T07:40:00.000Z",
      arrivalOrCheckOutTime: "2026-07-15T11:45:00.000Z",
      departureOrPropertyAddress: "New Delhi Railway Station (NDLS)",
      arrivalAddress: "Kalka Railway Station (KLK)",
      totalCost: 1150,
      currency: "INR",
      depositPaid: 1150,
      balanceDue: 0,
      status: "CONFIRMED",
      notes: "Breakfast included in ticket fare.",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await saveBooking(trainBooking);

    // Verify retrieval by ID
    const retrieved = await getBooking("bkg-train-12011");
    assert.ok(retrieved);
    assert.equal(retrieved.pnrNumber, "2849182390");
    assert.equal(retrieved.seatOrRoomDetails, "Coach C4, Seat 28 (Window)");
    assert.equal(retrieved.status, "CONFIRMED");

    // Verify index query by PNR
    const pnrMatch = await getBookingByPNR("2849182390");
    assert.ok(pnrMatch);
    assert.equal(pnrMatch.id, "bkg-train-12011");
    assert.equal(pnrMatch.carrierOrVendor, "IRCTC Train 12011");
  });

  test("2. Accommodation Stay Voucher with Address, Phone & Directions (REQ-BKG-02)", async () => {
    const hotelBooking: BookingRecord = {
      id: "bkg-zostel-manali",
      tripId: "trip-bkg-test",
      category: "ACCOMMODATION",
      type: "HOSTEL",
      title: "Zostel Manali Riverside",
      carrierOrVendor: "Zostel Hospitality",
      bookingReference: "ZST-MNL-9842",
      seatOrRoomDetails: "Private Deluxe Balcony Room 102",
      departureOrCheckInTime: "2026-07-15T13:00:00.000Z",
      arrivalOrCheckOutTime: "2026-07-17T10:00:00.000Z",
      departureOrPropertyAddress: "Old Manali, Manu Temple Road, HP 175131",
      contactPhone: "+91 98160 55443",
      totalCost: 5600,
      currency: "INR",
      depositPaid: 1500,
      balanceDue: 4100,
      status: "CONFIRMED",
      notes: "Mountain facing room reserved. Free WiFi.",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await saveBooking(hotelBooking);

    const retrievedHotel = await getBooking("bkg-zostel-manali");
    assert.ok(retrievedHotel);
    assert.equal(retrievedHotel.category, "ACCOMMODATION");
    assert.equal(retrievedHotel.title, "Zostel Manali Riverside");
    assert.equal(retrievedHotel.contactPhone, "+91 98160 55443");
    assert.equal(retrievedHotel.departureOrPropertyAddress, "Old Manali, Manu Temple Road, HP 175131");
  });

  test("3. Deposit & Balance Payable Tracker (REQ-BKG-03)", async () => {
    const trip: TripRecord = {
      id: "trip-bkg-finance",
      title: "Finance Test Trip",
      destination: "Goa",
      startDate: "2026-11-01T00:00:00.000Z",
      status: "PLANNING",
      travelStyle: "LEISURE",
      budgetTotal: 30000,
      currency: "INR",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await saveTrip(trip);

    // Train: 1500 total, 1500 paid, 0 due
    await saveBooking({
      id: "bkg-fin-train",
      tripId: "trip-bkg-finance",
      category: "TRANSPORT",
      type: "TRAIN",
      title: "Goa Express",
      totalCost: 1500,
      currency: "INR",
      depositPaid: 1500,
      balanceDue: 0,
      status: "CONFIRMED",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Hotel: 6000 total, 2000 paid, 4000 due
    await saveBooking({
      id: "bkg-fin-hotel",
      tripId: "trip-bkg-finance",
      category: "ACCOMMODATION",
      type: "HOTEL",
      title: "Palolem Beach Resort",
      totalCost: 6000,
      currency: "INR",
      depositPaid: 2000,
      balanceDue: 4000,
      status: "CONFIRMED",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const tripBookings = await getBookingsForTrip("trip-bkg-finance");
    const totalCost = tripBookings.reduce((sum, b) => sum + b.totalCost, 0);
    const totalPaid = tripBookings.reduce((sum, b) => sum + b.depositPaid, 0);
    const totalDue = tripBookings.reduce((sum, b) => sum + b.balanceDue, 0);

    assert.equal(totalCost, 1500 + 6000); // 7500
    assert.equal(totalPaid, 1500 + 2000); // 3500
    assert.equal(totalDue, 4000);

    // Update hotel booking: Pay additional deposit of 2000
    const hotel = await getBooking("bkg-fin-hotel");
    assert.ok(hotel);

    const updatedHotel: BookingRecord = {
      ...hotel,
      depositPaid: 4000,
      balanceDue: hotel.totalCost - 4000, // 6000 - 4000 = 2000
      updatedAt: new Date().toISOString(),
    };

    await saveBooking(updatedHotel);

    const reloadedHotel = await getBooking("bkg-fin-hotel");
    assert.equal(reloadedHotel?.depositPaid, 4000);
    assert.equal(reloadedHotel?.balanceDue, 2000);
  });

  test("4. Delete Booking and Cascade Deletion Verification", async () => {
    const trip: TripRecord = {
      id: "trip-bkg-delete",
      title: "Delete Test Trip",
      destination: "Delhi",
      startDate: "2026-09-01T00:00:00.000Z",
      status: "DRAFT",
      travelStyle: "OTHER",
      budgetTotal: 10000,
      currency: "INR",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await saveTrip(trip);

    await saveBooking({
      id: "bkg-del-1",
      tripId: "trip-bkg-delete",
      category: "TRANSPORT",
      type: "FLIGHT",
      title: "IndiGo 6E-205",
      totalCost: 3500,
      currency: "INR",
      depositPaid: 3500,
      balanceDue: 0,
      status: "CONFIRMED",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await saveBooking({
      id: "bkg-del-2",
      tripId: "trip-bkg-delete",
      category: "ACCOMMODATION",
      type: "HOTEL",
      title: "Delhi Airport Hotel",
      totalCost: 2500,
      currency: "INR",
      depositPaid: 500,
      balanceDue: 2000,
      status: "CONFIRMED",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Delete single booking
    const deleted = await deleteBooking("bkg-del-1");
    assert.equal(deleted, true);
    assert.equal(await getBooking("bkg-del-1"), null);

    // Verify second booking still exists
    assert.ok(await getBooking("bkg-del-2"));

    // Cascade delete whole trip
    await deleteTripCascade("trip-bkg-delete");
    const remainingBookings = await getBookingsForTrip("trip-bkg-delete");
    assert.equal(remainingBookings.length, 0);
  });
});
