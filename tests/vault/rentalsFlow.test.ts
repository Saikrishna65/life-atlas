import { test, describe, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";

import {
  saveTrip,
  saveRental,
  getRentalsForTrip,
  deleteRental,
  deleteTripCascade,
  deleteVaultDB,
} from "../../src/lib/vault/storage";
import {
  TripRecord,
  VehicleRentalRecord,
} from "../../src/lib/vault/types";

describe("Trip Vault Phase 7: Bike & Scooter Rental Logistics Flow", () => {
  before(async () => {
    await deleteVaultDB();
  });

  beforeEach(async () => {
    await deleteVaultDB();
  });

  test("1. Vehicle Specs & Vendor Record with 1-Tap Call Phone (REQ-RNT-01)", async () => {
    const trip: TripRecord = {
      id: "trip-rental-manali",
      title: "Spiti Valley Expedition",
      destination: "Manali, Himachal",
      startDate: "2026-06-15T00:00:00.000Z",
      status: "PLANNING",
      travelStyle: "MOTORCYCLE",
      budgetTotal: 50000,
      currency: "INR",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await saveTrip(trip);

    const rental: VehicleRentalRecord = {
      id: "rental-himalayan-450",
      tripId: "trip-rental-manali",
      vehicleType: "MOTORCYCLE",
      vehicleModel: "Royal Enfield Himalayan 450",
      vehicleRegNumber: "HP-01-AB-1234",
      vendorName: "Himalayan Adventure Moto Rentals",
      vendorPhone: "+919876543210",
      pickupLocation: "Mall Road Workshop, Manali",
      pickupTime: "2026-06-15T09:00:00.000Z",
      dropoffLocation: "Mall Road Workshop, Manali",
      dropoffTime: "2026-06-25T18:00:00.000Z",
      startOdometerKm: 12450,
      dailyRate: 1800,
      securityDeposit: 5000,
      depositPaymentMode: "UPI",
      depositRefundStatus: "PENDING",
      gearIncluded: ["Helmets x2", "Bungee Cords", "Pannier Mounts"],
      inspectionPhotos: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await saveRental(rental);

    const records = await getRentalsForTrip("trip-rental-manali");
    assert.strictEqual(records.length, 1);
    assert.strictEqual(records[0].vehicleModel, "Royal Enfield Himalayan 450");
    assert.strictEqual(records[0].vehicleRegNumber, "HP-01-AB-1234");
    assert.strictEqual(records[0].vendorName, "Himalayan Adventure Moto Rentals");
    assert.strictEqual(records[0].vendorPhone, "+919876543210");
    assert.deepStrictEqual(records[0].gearIncluded, ["Helmets x2", "Bungee Cords", "Pannier Mounts"]);
  });

  test("2. Rental Dates & Odometer Log with Automatic Km Computation (REQ-RNT-02)", async () => {
    const trip: TripRecord = {
      id: "trip-rental-leh",
      title: "Ladakh High Passes",
      destination: "Leh, Ladakh",
      startDate: "2026-07-10T00:00:00.000Z",
      status: "ACTIVE",
      travelStyle: "MOTORCYCLE",
      budgetTotal: 60000,
      currency: "INR",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await saveTrip(trip);

    const rental: VehicleRentalRecord = {
      id: "rental-ktm-390",
      tripId: "trip-rental-leh",
      vehicleType: "MOTORCYCLE",
      vehicleModel: "KTM Adventure 390",
      vehicleRegNumber: "JK-10-CD-5678",
      vendorName: "Leh Moto Zone",
      vendorPhone: "+919988776655",
      pickupLocation: "Fort Road, Leh",
      pickupTime: "2026-07-10T10:00:00.000Z",
      dropoffLocation: "Fort Road, Leh",
      dropoffTime: "2026-07-18T17:00:00.000Z",
      startOdometerKm: 18200,
      endOdometerKm: 19450, // +1,250 km driven
      dailyRate: 2200,
      securityDeposit: 10000,
      depositPaymentMode: "CARD",
      depositRefundStatus: "PENDING",
      gearIncluded: ["Helmet x1"],
      inspectionPhotos: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await saveRental(rental);

    const records = await getRentalsForTrip("trip-rental-leh");
    assert.strictEqual(records.length, 1);
    assert.strictEqual(records[0].startOdometerKm, 18200);
    assert.strictEqual(records[0].endOdometerKm, 19450);

    // Compute distance driven
    const distanceDriven = records[0].endOdometerKm! - records[0].startOdometerKm;
    assert.strictEqual(distanceDriven, 1250);
  });

  test("3. Security Deposit Ledger & Refund Status Tracker (REQ-RNT-03)", async () => {
    const trip: TripRecord = {
      id: "trip-rental-deposits",
      title: "Goa Coastal Cruise",
      destination: "Goa",
      startDate: "2026-12-10T00:00:00.000Z",
      status: "PLANNING",
      travelStyle: "LEISURE",
      budgetTotal: 30000,
      currency: "INR",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await saveTrip(trip);

    // Scooter 1: Deposit PENDING
    await saveRental({
      id: "rental-aerox",
      tripId: "trip-rental-deposits",
      vehicleType: "SCOOTER",
      vehicleModel: "Yamaha Aerox 155",
      vehicleRegNumber: "GA-03-E-1122",
      vendorName: "Anjuna Scooter Hire",
      vendorPhone: "+919422001122",
      pickupLocation: "Anjuna Beach",
      pickupTime: "2026-12-10T09:00:00.000Z",
      dropoffLocation: "Anjuna Beach",
      dropoffTime: "2026-12-15T18:00:00.000Z",
      startOdometerKm: 8500,
      dailyRate: 800,
      securityDeposit: 3000,
      depositPaymentMode: "UPI",
      depositRefundStatus: "PENDING",
      gearIncluded: ["Helmets x2"],
      inspectionPhotos: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Scooter 2: Deposit REFUNDED
    await saveRental({
      id: "rental-activa",
      tripId: "trip-rental-deposits",
      vehicleType: "SCOOTER",
      vehicleModel: "Honda Activa 6G",
      vehicleRegNumber: "GA-07-K-4455",
      vendorName: "Panjim Wheels",
      vendorPhone: "+919422003344",
      pickupLocation: "Panjim Bus Stand",
      pickupTime: "2026-12-10T09:00:00.000Z",
      dropoffLocation: "Panjim Bus Stand",
      dropoffTime: "2026-12-12T18:00:00.000Z",
      startOdometerKm: 22100,
      endOdometerKm: 22250,
      dailyRate: 500,
      securityDeposit: 2000,
      depositPaymentMode: "CASH",
      depositRefundStatus: "REFUNDED",
      depositRefundedDate: "2026-12-12T18:30:00.000Z",
      gearIncluded: ["Helmet x1"],
      inspectionPhotos: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const records = await getRentalsForTrip("trip-rental-deposits");
    assert.strictEqual(records.length, 2);

    const totalDeposit = records.reduce((sum, r) => sum + r.securityDeposit, 0);
    assert.strictEqual(totalDeposit, 5000);

    const pendingRefund = records
      .filter((r) => r.depositRefundStatus === "PENDING")
      .reduce((sum, r) => sum + r.securityDeposit, 0);
    assert.strictEqual(pendingRefund, 3000);

    // Transition Scooter 1 from PENDING to REFUNDED
    const aerox = records.find((r) => r.id === "rental-aerox")!;
    aerox.depositRefundStatus = "REFUNDED";
    aerox.depositRefundedDate = new Date().toISOString();
    await saveRental(aerox);

    const updated = await getRentalsForTrip("trip-rental-deposits");
    const updatedPending = updated
      .filter((r) => r.depositRefundStatus === "PENDING")
      .reduce((sum, r) => sum + r.securityDeposit, 0);
    assert.strictEqual(updatedPending, 0);
  });

  test("4. Pre-Rental Scratch Inspector & Cascade Delete (REQ-RNT-04)", async () => {
    const trip: TripRecord = {
      id: "trip-rental-scratch",
      title: "Rajasthan Thar Expedition",
      destination: "Jaisalmer, Rajasthan",
      startDate: "2026-11-12T00:00:00.000Z",
      status: "PLANNING",
      travelStyle: "ROADTRIP",
      budgetTotal: 45000,
      currency: "INR",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await saveTrip(trip);

    // Mock photo data URLs
    const photo1 = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP...";
    const photo2 = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP2...";

    const rental: VehicleRentalRecord = {
      id: "rental-thar-4x4",
      tripId: "trip-rental-scratch",
      vehicleType: "SUV",
      vehicleModel: "Mahindra Thar 4x4",
      vehicleRegNumber: "RJ-15-UB-9988",
      vendorName: "Desert Dune Wheels Jaisalmer",
      vendorPhone: "+919829012345",
      pickupLocation: "Jaisalmer Fort Road",
      pickupTime: "2026-11-12T08:00:00.000Z",
      dropoffLocation: "Jaisalmer Fort Road",
      dropoffTime: "2026-11-16T20:00:00.000Z",
      startOdometerKm: 34100,
      dailyRate: 4000,
      securityDeposit: 15000,
      depositPaymentMode: "CARD",
      depositRefundStatus: "PENDING",
      conditionNotes: "Scratches on front right bumper from previous desert dune drive.",
      gearIncluded: ["Tow Rope", "Sand Shovel", "Air Compressor"],
      inspectionPhotos: [photo1, photo2],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await saveRental(rental);

    let records = await getRentalsForTrip("trip-rental-scratch");
    assert.strictEqual(records.length, 1);
    assert.strictEqual(records[0].inspectionPhotos.length, 2);
    assert.strictEqual(records[0].conditionNotes, "Scratches on front right bumper from previous desert dune drive.");

    // Delete single rental record
    await deleteRental("rental-thar-4x4");
    records = await getRentalsForTrip("trip-rental-scratch");
    assert.strictEqual(records.length, 0);

    // Recreate and verify cascade delete on trip deletion
    await saveRental(rental);
    records = await getRentalsForTrip("trip-rental-scratch");
    assert.strictEqual(records.length, 1);

    await deleteTripCascade("trip-rental-scratch");
    records = await getRentalsForTrip("trip-rental-scratch");
    assert.strictEqual(records.length, 0);
  });
});
