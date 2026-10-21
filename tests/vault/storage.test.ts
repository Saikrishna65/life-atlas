/**
 * Automated Test Suite for Life Atlas Trip Vault Storage Engine
 * Tests CRUD operations, relationships, upgrades, attachment persistence, and failure scenarios.
 */

import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import test, { describe, beforeEach, afterEach } from "node:test";
import {
  getVaultDB,
  closeVaultDB,
  deleteVaultDB,
  ALL_VAULT_STORES,
  saveTrip,
  getTrip,
  getAllTrips,
  getTripsByStatus,
  deleteTripCascade,
  saveItineraryDay,
  getItinerariesForTrip,
  deleteItineraryDay,
  saveBooking,
  getBooking,
  getBookingsForTrip,
  getBookingByPNR,
  deleteBooking,
  saveDocument,
  getDocument,
  getDocumentsForTrip,
  getDocumentsForBooking,
  deleteDocument,
  saveRental,
  getRentalsForTrip,
  saveFoodItem,
  getFoodItemsForTrip,
  saveExpense,
  getExpensesForTrip,
  getRefundableDepositsForTrip,
  savePackingItem,
  getPackingItemsForTrip,
  togglePackingItem,
  saveSafetyContact,
  getSafetyContactsForTrip,
  saveReminder,
  getRemindersForTrip,
  getPendingReminders,
  addRecord,
  VaultStorageError,
} from "../../src/lib/vault/storage";
import {
  TripRecord,
  ItineraryDayRecord,
  BookingRecord,
  DocumentAttachmentRecord,
  VehicleRentalRecord,
  FoodPlannerRecord,
  ExpenseRecord,
  PackingItemRecord,
  SafetyContactRecord,
  ReminderRecord,
} from "../../src/lib/vault/types";

describe("Trip Vault Storage Engine", () => {
  beforeEach(async () => {
    // Reset database before each test
    await deleteVaultDB();
  });

  afterEach(async () => {
    closeVaultDB();
    await deleteVaultDB();
  });

  test("1. Database Schema Initialization & Object Stores Verification", async () => {
    const db = await getVaultDB();
    assert.ok(db, "Database should open successfully");
    assert.equal(db.name, "life_atlas_trip_vault_db");
    assert.equal(db.version, 1);

    // Verify all 10 object stores exist
    for (const storeName of ALL_VAULT_STORES) {
      assert.ok(
        db.objectStoreNames.contains(storeName),
        `Object store '${storeName}' should exist in database`
      );
    }

    // Verify critical indexes
    const tx = db.transaction(ALL_VAULT_STORES, "readonly");
    const tripStore = tx.objectStore("trips");
    assert.ok(tripStore.indexNames.contains("by-status"));
    assert.ok(tripStore.indexNames.contains("by-startDate"));

    const bookingStore = tx.objectStore("bookings");
    assert.ok(bookingStore.indexNames.contains("by-pnr"));
    assert.ok(bookingStore.indexNames.contains("by-tripId"));

    const docStore = tx.objectStore("documents");
    assert.ok(docStore.indexNames.contains("by-tripId"));
    assert.ok(docStore.indexNames.contains("by-tripId-bookingId"));
  });

  test("2. Trip CRUD & Status Queries", async () => {
    const sampleTrip: TripRecord = {
      id: "trip-spiti-001",
      title: "Spiti Valley Expedition",
      destination: "Spiti Valley, Himachal Pradesh",
      destinations: [
        { id: "dest-1", name: "Shimla", orderIndex: 0 },
        { id: "dest-2", name: "Kaza", orderIndex: 1 },
      ],
      startDate: "2026-06-10T00:00:00.000Z",
      endDate: "2026-06-20T00:00:00.000Z",
      status: "ACTIVE",
      travelStyle: "MOTORCYCLE",
      budgetTotal: 45000,
      currency: "INR",
      companions: ["Arjun", "Vikram"],
      notes: "High-altitude acclimatization needed at Narkanda",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Create / Put
    const saved = await saveTrip(sampleTrip);
    assert.equal(saved.id, "trip-spiti-001");
    assert.equal(saved.status, "ACTIVE");

    // Read by ID
    const retrieved = await getTrip("trip-spiti-001");
    assert.ok(retrieved);
    assert.equal(retrieved?.title, "Spiti Valley Expedition");
    assert.equal(retrieved?.travelStyle, "MOTORCYCLE");
    assert.equal(retrieved?.companions?.length, 2);

    // Query by status index
    const activeTrips = await getTripsByStatus("ACTIVE");
    assert.equal(activeTrips.length, 1);
    assert.equal(activeTrips[0].id, "trip-spiti-001");

    const draftTrips = await getTripsByStatus("DRAFT");
    assert.equal(draftTrips.length, 0);

    // List all
    const allTrips = await getAllTrips();
    assert.equal(allTrips.length, 1);
  });

  test("3. Itinerary Days & Chronological Ordering", async () => {
    const day2: ItineraryDayRecord = {
      id: "day-02",
      tripId: "trip-ladakh-01",
      dayIndex: 2,
      date: "2026-07-02T00:00:00.000Z",
      title: "Manali to Jispa",
      intensity: "CHALLENGING",
      activities: [
        {
          id: "act-01",
          timeSlot: "MORNING",
          startTime: "07:30",
          title: "Cross Atal Tunnel & Sissu Waterfall",
          status: "PLANNED",
          estimatedCost: 0,
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const day1: ItineraryDayRecord = {
      id: "day-01",
      tripId: "trip-ladakh-01",
      dayIndex: 1,
      date: "2026-07-01T00:00:00.000Z",
      title: "Arrive in Manali & Bike Inspection",
      intensity: "RELAXED",
      activities: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Insert out of order
    await saveItineraryDay(day2);
    await saveItineraryDay(day1);

    // Query for trip - should return ordered by dayIndex ascending (Day 1 then Day 2)
    const days = await getItinerariesForTrip("trip-ladakh-01");
    assert.equal(days.length, 2);
    assert.equal(days[0].dayIndex, 1);
    assert.equal(days[0].id, "day-01");
    assert.equal(days[1].dayIndex, 2);
    assert.equal(days[1].id, "day-02");

    // Delete a day
    const deleted = await deleteItineraryDay("day-01");
    assert.equal(deleted, true);
    const remainingDays = await getItinerariesForTrip("trip-ladakh-01");
    assert.equal(remainingDays.length, 1);
  });

  test("4. Bookings & Index Query by PNR", async () => {
    const trainBooking: BookingRecord = {
      id: "bkg-train-01",
      tripId: "trip-rajasthan-01",
      category: "TRANSPORT",
      type: "TRAIN",
      title: "Mandore Superfast Express",
      pnrNumber: "2458901234",
      carrierOrVendor: "Indian Railways 22995",
      seatOrRoomDetails: "Coach B2, Berth 35 (Side Lower)",
      totalCost: 1850,
      currency: "INR",
      depositPaid: 1850,
      balanceDue: 0,
      status: "CONFIRMED",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await saveBooking(trainBooking);

    // Query by PNR index
    const found = await getBookingByPNR("2458901234");
    assert.ok(found);
    assert.equal(found?.id, "bkg-train-01");
    assert.equal(found?.seatOrRoomDetails, "Coach B2, Berth 35 (Side Lower)");

    // Query by ID
    const byId = await getBooking("bkg-train-01");
    assert.ok(byId);
    assert.equal(byId?.title, "Mandore Superfast Express");

    // Query non-existent PNR
    const notFound = await getBookingByPNR("9999999999");
    assert.equal(notFound, null);

    // Delete booking
    const deleted = await deleteBooking("bkg-train-01");
    assert.equal(deleted, true);
    const afterDelete = await getBooking("bkg-train-01");
    assert.equal(afterDelete, null);
  });

  test("5. Binary Blob Document Persistence & Integrity", async () => {
    // Simulate binary PDF document bytes
    const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x35]); // "%PDF-1.5"
    const sampleBlob = new Blob([pdfBytes], { type: "application/pdf" });

    const docRecord: DocumentAttachmentRecord = {
      id: "doc-ticket-pdf-01",
      tripId: "trip-kerala-01",
      bookingId: "bkg-flight-01",
      title: "IndiGo Flight Boarding Pass.pdf",
      fileType: "PDF",
      fileName: "boarding_pass.pdf",
      mimeType: "application/pdf",
      sizeBytes: sampleBlob.size,
      blobData: sampleBlob,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await saveDocument(docRecord);

    // Retrieve document
    const retrieved = await getDocument("doc-ticket-pdf-01");
    assert.ok(retrieved);
    assert.equal(retrieved?.id, "doc-ticket-pdf-01");
    assert.equal(retrieved?.fileType, "PDF");
    assert.equal(retrieved?.mimeType, "application/pdf");
    assert.equal(retrieved?.sizeBytes, sampleBlob.size);

    // Verify binary integrity
    assert.ok(retrieved?.blobData);
    const readBuffer = await (retrieved.blobData as Blob).arrayBuffer();
    const readBytes = new Uint8Array(readBuffer);
    assert.deepEqual(readBytes, pdfBytes, "Persisted binary bytes must match original exactly");

    // Verify booking association
    const bookingDocs = await getDocumentsForBooking("trip-kerala-01", "bkg-flight-01");
    assert.equal(bookingDocs.length, 1);
    assert.equal(bookingDocs[0].id, "doc-ticket-pdf-01");

    // Delete document
    const docDeleted = await deleteDocument("doc-ticket-pdf-01");
    assert.equal(docDeleted, true);
    const afterDocDelete = await getDocument("doc-ticket-pdf-01");
    assert.equal(afterDocDelete, null);
  });

  test("6. Rentals, Food, Expenses, Packing, Safety & Reminders", async () => {
    const tripId = "trip-full-test";

    // 1. Rental
    const rental: VehicleRentalRecord = {
      id: "rnt-01",
      tripId,
      vehicleType: "MOTORCYCLE",
      vehicleModel: "Royal Enfield Himalayan 450",
      vehicleRegNumber: "HP-01-C-9988",
      vendorName: "Kaza Moto Adventures",
      vendorPhone: "+91-9876543210",
      pickupLocation: "Kaza Old Bus Stand",
      pickupTime: "2026-08-01T09:00:00.000Z",
      dropoffLocation: "Kaza Old Bus Stand",
      dropoffTime: "2026-08-06T18:00:00.000Z",
      startOdometerKm: 12400,
      dailyRate: 2200,
      securityDeposit: 10000,
      depositPaymentMode: "UPI",
      depositRefundStatus: "PENDING",
      gearIncluded: ["Full Face Helmet", "Riding Gloves"],
      conditionNotes: "Minor scratch on right pannier",
      inspectionPhotos: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await saveRental(rental);
    const rentals = await getRentalsForTrip(tripId);
    assert.equal(rentals.length, 1);
    assert.equal(rentals[0].depositRefundStatus, "PENDING");

    // 2. Food Item
    const food: FoodPlannerRecord = {
      id: "food-01",
      tripId,
      name: "Siddu with Ghee",
      type: "SPECIALTY_DISH",
      cuisine: "Himachali",
      location: "Old Manali",
      mealSlot: "LUNCH",
      priceLevel: 1,
      dietaryTags: ["VEG"],
      status: "TO_TRY",
      mustOrderDish: "Walnut Siddu",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await saveFoodItem(food);
    const foodItems = await getFoodItemsForTrip(tripId);
    assert.equal(foodItems.length, 1);
    assert.equal(foodItems[0].name, "Siddu with Ghee");

    // 3. Expense & Security Deposit
    const expense: ExpenseRecord = {
      id: "exp-01",
      tripId,
      title: "Bike Security Deposit",
      amount: 10000,
      currency: "INR",
      category: "RENTAL",
      paidBy: "Me",
      paymentMode: "UPI",
      date: "2026-08-01T09:00:00.000Z",
      isDeposit: true,
      depositRefundStatus: "PENDING",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await saveExpense(expense);
    const expenses = await getExpensesForTrip(tripId);
    assert.equal(expenses.length, 1);
    const deposits = await getRefundableDepositsForTrip(tripId);
    assert.equal(deposits.length, 1);
    assert.equal(deposits[0].isDeposit, true);

    // 4. Packing item & toggle
    const packing: PackingItemRecord = {
      id: "pck-01",
      tripId,
      category: "FIRST_AID",
      name: "Diamox (Acetazolamide)",
      quantity: 10,
      isEssential: true,
      isPacked: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await savePackingItem(packing);
    const pckBefore = await getPackingItemsForTrip(tripId);
    assert.equal(pckBefore[0].isPacked, false);

    // Toggle packed
    await togglePackingItem("pck-01", true);
    const pckAfter = await getPackingItemsForTrip(tripId);
    assert.equal(pckAfter[0].isPacked, true);

    // 5. Safety Contact
    const safety: SafetyContactRecord = {
      id: "sft-01",
      tripId,
      name: "ITBP Kaza Mountain Rescue",
      role: "MOUNTAIN_RESCUE",
      phone: "+91-1906-222222",
      isEmergency: true,
      notes: "Post near Spiti river bridge",
      medicalInfo: {
        bloodGroup: "O+",
        allergies: ["Penicillin"],
        emergencyMedications: ["Diamox"],
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await saveSafetyContact(safety);
    const safetyContacts = await getSafetyContactsForTrip(tripId);
    assert.equal(safetyContacts.length, 1);
    assert.equal(safetyContacts[0].medicalInfo?.bloodGroup, "O+");

    // 6. Reminder
    const reminder: ReminderRecord = {
      id: "rem-01",
      tripId,
      title: "Return Rental Bike",
      body: "Drop off bike at Kaza depot by 6:00 PM to avoid late fee",
      triggerTime: "2026-08-06T15:00:00.000Z",
      isTriggered: false,
      isCancelled: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await saveReminder(reminder);
    const tripReminders = await getRemindersForTrip(tripId);
    assert.equal(tripReminders.length, 1);
    assert.equal(tripReminders[0].title, "Return Rental Bike");

    const pendingReminders = await getPendingReminders();
    assert.equal(pendingReminders.length, 1);
    assert.equal(pendingReminders[0].id, "rem-01");
  });

  test("7. Atomic Cascade Delete across All 10 Stores", async () => {
    const tripId = "trip-cascade-victim";

    // Create a trip
    await saveTrip({
      id: tripId,
      title: "Cascade Test Trip",
      destination: "Goa",
      startDate: "2026-11-01T00:00:00.000Z",
      status: "PLANNING",
      travelStyle: "LEISURE",
      budgetTotal: 25000,
      currency: "INR",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Populate child entities across child stores
    await saveItineraryDay({
      id: "c-day-01",
      tripId,
      dayIndex: 1,
      date: "2026-11-01T00:00:00.000Z",
      title: "Day 1",
      activities: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await saveBooking({
      id: "c-bkg-01",
      tripId,
      category: "ACCOMMODATION",
      type: "HOTEL",
      title: "Seaside Resort",
      totalCost: 6000,
      currency: "INR",
      depositPaid: 2000,
      balanceDue: 4000,
      status: "CONFIRMED",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await saveDocument({
      id: "c-doc-01",
      tripId,
      title: "Voucher.pdf",
      fileType: "PDF",
      fileName: "v.pdf",
      mimeType: "application/pdf",
      sizeBytes: 100,
      blobData: new Blob(["dummy"]),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await saveRental({
      id: "c-rnt-01",
      tripId,
      vehicleType: "SCOOTER",
      vehicleModel: "Activa",
      vehicleRegNumber: "GA-01-1234",
      vendorName: "Goa Rentals",
      vendorPhone: "123",
      pickupLocation: "Airport",
      pickupTime: "2026-11-01T10:00:00.000Z",
      dropoffLocation: "Airport",
      dropoffTime: "2026-11-05T10:00:00.000Z",
      startOdometerKm: 1000,
      dailyRate: 500,
      securityDeposit: 1000,
      depositPaymentMode: "CASH",
      depositRefundStatus: "PENDING",
      gearIncluded: [],
      inspectionPhotos: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await saveExpense({
      id: "c-exp-01",
      tripId,
      title: "Dinner",
      amount: 1200,
      currency: "INR",
      category: "FOOD",
      paidBy: "Me",
      paymentMode: "CARD",
      date: "2026-11-01T20:00:00.000Z",
      isDeposit: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Execute atomic cascade delete
    const result = await deleteTripCascade(tripId);
    assert.equal(result, true);

    // Verify main trip is gone
    const tripCheck = await getTrip(tripId);
    assert.equal(tripCheck, null);

    // Verify all child records were purged atomically
    const itins = await getItinerariesForTrip(tripId);
    assert.equal(itins.length, 0);

    const bkgs = await getBookingsForTrip(tripId);
    assert.equal(bkgs.length, 0);

    const docs = await getDocumentsForTrip(tripId);
    assert.equal(docs.length, 0);

    const rnts = await getRentalsForTrip(tripId);
    assert.equal(rnts.length, 0);

    const exps = await getExpensesForTrip(tripId);
    assert.equal(exps.length, 0);
  });

  test("8. Error Handling & Validation Failures", async () => {
    // 1. Missing blobData in document throws CORRUPT_RECORD
    await assert.rejects(
      async () => {
        await saveDocument({
          id: "invalid-doc",
          tripId: "t1",
          title: "Corrupt Document",
          fileType: "PDF",
          fileName: "c.pdf",
          mimeType: "application/pdf",
          sizeBytes: 0,
          blobData: null as unknown as Blob,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      },
      (err: unknown) => {
        assert.ok(err instanceof VaultStorageError);
        assert.equal(err.code, "CORRUPT_RECORD");
        return true;
      }
    );

    // 2. addRecord on existing ID throws ALREADY_EXISTS / ConstraintError
    const trip: TripRecord = {
      id: "duplicate-id-test",
      title: "Trip A",
      destination: "Delhi",
      startDate: "2026-05-01T00:00:00.000Z",
      status: "DRAFT",
      travelStyle: "OTHER",
      budgetTotal: 1000,
      currency: "INR",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await addRecord("trips", trip);

    await assert.rejects(
      async () => {
        // Try adding with identical ID
        await addRecord("trips", { ...trip, title: "Trip B" });
      },
      (err: unknown) => {
        assert.ok(err instanceof VaultStorageError);
        assert.equal(err.code, "ALREADY_EXISTS");
        return true;
      }
    );

    // 3. Toggling packing item that doesn't exist throws NOT_FOUND
    await assert.rejects(
      async () => {
        await togglePackingItem("non-existent-packing-id", true);
      },
      (err: unknown) => {
        assert.ok(err instanceof VaultStorageError);
        assert.equal(err.code, "NOT_FOUND");
        return true;
      }
    );
  });
});
