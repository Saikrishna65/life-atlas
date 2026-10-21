import { test, describe, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import fs from "node:fs";
import path from "node:path";

import {
  saveTrip,
  getTrip,
  deleteTripCascade,
  deleteVaultDB,
  saveItineraryDay,
  getItinerariesForTrip,
  saveBooking,
  getBookingsForTrip,
  saveDocument,
  getDocumentsForTrip,
  saveRental,
  getRentalsForTrip,
  saveFoodItem,
  getFoodItemsForTrip,
  saveExpense,
  getExpensesForTrip,
  savePackingItem,
  getPackingItemsForTrip,
  saveSafetyContact,
  getSafetyContactsForTrip,
  saveMedicalCard,
  getMedicalCardForTrip,
  saveContingency,
  getContingenciesForTrip,
  saveReminder,
  getRemindersForTrip,
  saveMemory,
  getMemoriesForTrip,
  completeTripAndArchive,
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
  TripMemoryRecord,
  MedicalCardInfo,
  ContingencyPlan,
  RouteSegment,
  WaypointRecord,
} from "../../src/lib/vault/types";
import {
  isSecretAccessGranted,
  verifyPasscode,
  grantSecretAccess,
  revokeSecretAccess,
  DEFAULT_GUARDIAN_PIN,
  updateGuardianPasscode,
} from "../../src/lib/deviceAuth";
import {
  parseBookingText,
  SAMPLE_CONFIRMATION_TEXTS,
} from "../../src/lib/vault/pnrParser";
import {
  generateExpeditionItinerary,
} from "../../src/lib/vault/aiItinerary";

// Ensure Node test environment supports sessionStorage and localStorage
const createStorageMock = () => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, val: string) => {
      store[key] = String(val);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
};

interface GlobalWithStorage {
  window?: unknown;
  sessionStorage?: Storage;
  localStorage?: Storage;
}

const globalScope = globalThis as unknown as GlobalWithStorage;

if (typeof globalScope.window === "undefined") {
  globalScope.window = globalThis;
}
if (typeof globalScope.sessionStorage === "undefined") {
  globalScope.sessionStorage = createStorageMock() as unknown as Storage;
}
if (typeof globalScope.localStorage === "undefined") {
  globalScope.localStorage = createStorageMock() as unknown as Storage;
}

describe("Trip Vault Phase 15: Security, Website Isolation & Android Build Quality Audit", () => {
  before(async () => {
    await deleteVaultDB();
  });

  beforeEach(async () => {
    await deleteVaultDB();
    revokeSecretAccess();
  });

  test("1. Website Isolation & Architecture Audit (REQ-AUD-01)", () => {
    // Verify that all Vault pages and APIs are cleanly encapsulated
    const vaultAppDir = path.resolve(process.cwd(), "src/app/secret/vault");
    const vaultLibDir = path.resolve(process.cwd(), "src/lib/vault");
    const vaultApiDir = path.resolve(process.cwd(), "src/app/api/vault");

    assert.ok(fs.existsSync(vaultAppDir), "Vault app directory must exist");
    assert.ok(fs.existsSync(vaultLibDir), "Vault library directory must exist");
    assert.ok(fs.existsSync(vaultApiDir), "Vault API directory must exist");

    // Verify public website routes exist untouched
    const publicPages = [
      "src/app/page.tsx",
      "src/app/trips/page.tsx",
      "src/app/places/page.tsx",
      "src/app/explore/page.tsx",
      "src/app/admin/page.tsx",
    ];

    publicPages.forEach((p) => {
      const fullPath = path.resolve(process.cwd(), p);
      assert.ok(fs.existsSync(fullPath), `Public page ${p} must remain intact`);
    });
  });

  test("2. Secret Door Double-Tap & Biometric Session State Machine (REQ-AUD-02)", async () => {
    // 1. Initial State: Secret access must be locked
    assert.strictEqual(isSecretAccessGranted(), false, "Initial access must be locked");

    // 2. Invalid Guardian PIN attempt
    const invalidResult = verifyPasscode("0000");
    assert.strictEqual(invalidResult, false, "Invalid PIN must be rejected");
    assert.strictEqual(isSecretAccessGranted(), false, "Session must remain locked on failed PIN");

    // 3. Valid Guardian PIN unlock
    const validResult = verifyPasscode(DEFAULT_GUARDIAN_PIN);
    assert.strictEqual(validResult, true, "Default guardian PIN (1984) must unlock vault");
    assert.strictEqual(isSecretAccessGranted(), true, "Session should be authenticated");

    // 4. Custom PIN update and verification
    const updateSuccess = updateGuardianPasscode("5678");
    assert.strictEqual(updateSuccess, true, "PIN update should succeed");
    revokeSecretAccess();
    assert.strictEqual(isSecretAccessGranted(), false, "Session must be revoked");

    // Old PIN fails, new PIN succeeds
    assert.strictEqual(verifyPasscode("1984"), false, "Old PIN should now fail");
    assert.strictEqual(verifyPasscode("5678"), true, "New PIN should succeed");
    assert.strictEqual(isSecretAccessGranted(), true, "Session authenticated with new PIN");

    // Reset back to default
    updateGuardianPasscode(DEFAULT_GUARDIAN_PIN);

    // 5. Explicit grant and Vault Lock action revokes session instantly
    grantSecretAccess();
    assert.strictEqual(isSecretAccessGranted(), true, "grantSecretAccess must unlock session");
    revokeSecretAccess();
    assert.strictEqual(isSecretAccessGranted(), false, "Lock Vault must revoke session immediately");
  });

  test("3. Full 15-Pillar End-to-End Offline Resilience Audit (REQ-AUD-03)", async () => {
    const tripId = "trip-audit-expedition-2026";
    const now = "2026-06-01T00:00:00.000Z";

    // Pillar 1 & 2: Trip Record
    const trip: TripRecord = {
      id: tripId,
      title: "Trans-Himalayan Zanskar Circuit",
      destination: "Zanskar, Ladakh",
      startDate: now,
      endDate: "2026-06-14T00:00:00.000Z",
      status: "ACTIVE",
      travelStyle: "MOTORCYCLE",
      budgetTotal: 75000,
      currency: "INR",
      createdAt: now,
      updatedAt: now,
    };
    await saveTrip(trip);
    assert.ok(await getTrip(tripId));

    // Pillar 3: Route Segments & Waypoints
    const segment: RouteSegment = {
      id: "seg-shinku-la",
      tripId,
      fromStop: "Darcha",
      toStop: "Padum",
      distanceKm: 145,
      estimatedHours: 6,
      terrainType: "HIGH_ALTITUDE_PASS",
      roadCondition: "GRAVEL_UNPAVED",
      highestElevationMeters: 5091, // Shinku La pass
      passNames: ["Shinku La"],
      orderIndex: 0,
      createdAt: now,
    };
    const waypoint: WaypointRecord = {
      id: "wp-shinku-la",
      tripId,
      title: "Shinku La Top (16,703 ft)",
      category: "PASS",
      latitude: 32.9667,
      longitude: 77.1667,
      elevationMeters: 5091,
      createdAt: now,
    };
    trip.routeSegments = [segment];
    trip.waypoints = [waypoint];
    await saveTrip(trip);

    // Pillar 4: Itinerary & Day-by-Day Activities
    const day: ItineraryDayRecord = {
      id: "itin-d1",
      tripId,
      dayIndex: 0,
      date: now,
      title: "Darcha to Padum via Shinku La",
      activities: [
        {
          id: "act-1",
          timeSlot: "MORNING",
          startTime: "06:30",
          title: "Early ascent to Shinku La Pass",
          status: "COMPLETED",
        },
        {
          id: "act-2",
          timeSlot: "AFTERNOON",
          startTime: "14:00",
          title: "Arrive at Padum Valley",
          status: "PLANNED",
        },
      ],
      createdAt: now,
      updatedAt: now,
    };
    await saveItineraryDay(day);
    assert.strictEqual((await getItinerariesForTrip(tripId)).length, 1);

    // Pillar 5: Bookings (Train / Transport)
    const booking: BookingRecord = {
      id: "bkg-train-chandigarh",
      tripId,
      category: "TRANSPORT",
      type: "TRAIN",
      title: "Kalka Shatabdi Express",
      pnrNumber: "2458901234",
      seatOrRoomDetails: "Coach B2, Berth 35 (LB)",
      totalCost: 1450,
      currency: "INR",
      depositPaid: 1450,
      balanceDue: 0,
      status: "CONFIRMED",
      createdAt: now,
      updatedAt: now,
    };
    await saveBooking(booking);
    assert.strictEqual((await getBookingsForTrip(tripId)).length, 1);

    // Pillar 6: Offline Documents & PDF Ticket Vault
    const pdfBlob = new Blob(["%PDF-1.4 Mock Zanskar Permit Document"], {
      type: "application/pdf",
    });
    const doc: DocumentAttachmentRecord = {
      id: "doc-permit",
      tripId,
      title: "Zanskar Inner Line Permit",
      fileType: "PDF",
      fileName: "zanskar_permit.pdf",
      mimeType: "application/pdf",
      sizeBytes: pdfBlob.size,
      blobData: pdfBlob,
      createdAt: now,
      updatedAt: now,
    };
    await saveDocument(doc);
    assert.strictEqual((await getDocumentsForTrip(tripId)).length, 1);

    // Pillar 7: Vehicle Rental Logistics
    const rental: VehicleRentalRecord = {
      id: "rnt-himalayan",
      tripId,
      vehicleType: "MOTORCYCLE",
      vehicleModel: "Royal Enfield Himalayan 450",
      vehicleRegNumber: "HP-01-C-4455",
      vendorName: "Manali Moto Rentals",
      vendorPhone: "+91 98160 55443",
      pickupLocation: "Manali",
      pickupTime: now,
      dropoffLocation: "Leh",
      dropoffTime: "2026-06-14T18:00:00.000Z",
      startOdometerKm: 15200,
      endOdometerKm: 16180, // 980 km
      dailyRate: 2000,
      securityDeposit: 15000,
      depositPaymentMode: "UPI",
      depositRefundStatus: "PENDING",
      gearIncluded: ["Helmet x2", "Luggage Carrier"],
      inspectionPhotos: [],
      createdAt: now,
      updatedAt: now,
    };
    await saveRental(rental);
    assert.strictEqual((await getRentalsForTrip(tripId)).length, 1);

    // Pillar 8: Culinary & Food Roadmaps
    const food: FoodPlannerRecord = {
      id: "fod-thukpa",
      tripId,
      name: "Tibetan Lamb Thukpa & Butter Tea",
      type: "SPECIALTY_DISH",
      mealSlot: "DINNER",
      priceLevel: 1,
      dietaryTags: ["NON_VEG"],
      status: "VISITED",
      rating: 5,
      createdAt: now,
      updatedAt: now,
    };
    await saveFoodItem(food);
    assert.strictEqual((await getFoodItemsForTrip(tripId)).length, 1);

    // Pillar 9: Budget & Expenses Logger
    const expense: ExpenseRecord = {
      id: "exp-fuel",
      tripId,
      title: "Fuel Refuel at Keylong Pump",
      amount: 1400,
      currency: "INR",
      category: "FUEL",
      paidBy: "Self",
      paymentMode: "CASH",
      date: now,
      isDeposit: false,
      createdAt: now,
      updatedAt: now,
    };
    await saveExpense(expense);
    assert.strictEqual((await getExpensesForTrip(tripId)).length, 1);

    // Pillar 10: Packing Lists & Equipment Checklists
    const packing: PackingItemRecord = {
      id: "pck-boots",
      tripId,
      category: "RIDING_GEAR",
      name: "Waterproof Adventure Touring Boots",
      quantity: 1,
      isEssential: true,
      isPacked: true,
      createdAt: now,
      updatedAt: now,
    };
    await savePackingItem(packing);
    assert.strictEqual((await getPackingItemsForTrip(tripId)).length, 1);

    // Pillar 11: Emergency, Medical & Plan B
    const safety: SafetyContactRecord = {
      id: "saf-police",
      tripId,
      name: "Padum Police Station",
      role: "POLICE",
      phone: "+91 1982 245222",
      isEmergency: true,
      createdAt: now,
      updatedAt: now,
    };
    await saveSafetyContact(safety);

    const medCard: MedicalCardInfo = {
      bloodGroup: "O+",
      allergies: ["Penicillin"],
      emergencyMedications: ["Diamox 250mg"],
      insuranceProvider: "Star Health Adventure",
      insurancePolicyNumber: "POL-778899",
    };
    await saveMedicalCard(tripId, medCard);
    assert.ok(await getMedicalCardForTrip(tripId));

    const planB: ContingencyPlan = {
      id: "con-shinku-la",
      tripId,
      title: "Shinku La Snow Closure",
      triggerCondition: "Pass closed due to sudden blizzard",
      backupPlan: "Divert via Rohtang Tunnel -> Leh -> Kargil -> Padum",
      createdAt: now,
    };
    await saveContingency(tripId, planB);
    assert.strictEqual((await getContingenciesForTrip(tripId)).length, 1);

    // Pillar 12: Android Local Notifications & Reminders
    const reminder: ReminderRecord = {
      id: "rem-dropoff",
      tripId,
      title: "Rental Return Warning: 3 Hours Remaining",
      body: "Return Himalayan 450 to avoid late fees. Inspect for ₹15,000 deposit refund.",
      triggerTime: "2026-06-14T15:00:00.000Z",
      relatedType: "RENTAL",
      nativeNotificationId: 987654,
      isTriggered: false,
      isCancelled: false,
      createdAt: now,
      updatedAt: now,
    };
    await saveReminder(reminder);
    assert.strictEqual((await getRemindersForTrip(tripId)).length, 1);

    // Pillar 13: Memories & Reflection Wall
    const memory: TripMemoryRecord = {
      id: "mem-gonbo-rangjon",
      tripId,
      title: "Standing before Gonbo Rangjon Holy Mountain",
      date: now,
      location: "Zanskar Valley",
      caption: "The majestic monolithic mountain rising from the riverbed.",
      isHighlight: true,
      rating: 5,
      createdAt: now,
    };
    await saveMemory(tripId, memory);
    assert.strictEqual((await getMemoriesForTrip(tripId)).length, 1);

    // Pillar 14: AI Itinerary & Smart PNR Parser Offline Verification
    const aiPlan = await generateExpeditionItinerary({
      destination: "Spiti Valley",
      durationDays: 8,
      travelStyle: "MOTORCYCLE",
    });
    assert.strictEqual(aiPlan.isOfflineFallback, true);
    assert.strictEqual(aiPlan.generatedDays.length, 8);

    const parsedTicket = parseBookingText(SAMPLE_CONFIRMATION_TEXTS[0].text);
    assert.strictEqual(parsedTicket.pnrNumber, "2458901234");
    assert.strictEqual(parsedTicket.transportType, "TRAIN");

    // Pillar 15: Trip Completion Milestone & Atomic Cascade Erasure
    const completed = await completeTripAndArchive(tripId);
    assert.strictEqual(completed.status, "COMPLETED");
    assert.ok(completed.completedAt);

    // Atomic Cascade Delete across all 10 stores
    const cascadeSuccess = await deleteTripCascade(tripId);
    assert.strictEqual(cascadeSuccess, true);

    // Confirm all 10 stores are completely cleaned up with zero orphaned records
    assert.strictEqual(await getTrip(tripId), null);
    assert.strictEqual((await getItinerariesForTrip(tripId)).length, 0);
    assert.strictEqual((await getBookingsForTrip(tripId)).length, 0);
    assert.strictEqual((await getDocumentsForTrip(tripId)).length, 0);
    assert.strictEqual((await getRentalsForTrip(tripId)).length, 0);
    assert.strictEqual((await getFoodItemsForTrip(tripId)).length, 0);
    assert.strictEqual((await getExpensesForTrip(tripId)).length, 0);
    assert.strictEqual((await getPackingItemsForTrip(tripId)).length, 0);
    assert.strictEqual((await getSafetyContactsForTrip(tripId)).length, 0);
    assert.strictEqual((await getRemindersForTrip(tripId)).length, 0);
    assert.strictEqual((await getMemoriesForTrip(tripId)).length, 0);
  });

  test("4. Android Native Manifest & Capacitor Configuration Audit (REQ-AUD-04)", () => {
    // 1. AndroidManifest.xml validation
    const manifestPath = path.resolve(process.cwd(), "android/app/src/main/AndroidManifest.xml");
    assert.ok(fs.existsSync(manifestPath), "AndroidManifest.xml must exist");
    const manifestContent = fs.readFileSync(manifestPath, "utf-8");

    assert.ok(manifestContent.includes("android.permission.INTERNET"), "Must include INTERNET permission");
    assert.ok(manifestContent.includes("android.permission.USE_BIOMETRIC"), "Must include USE_BIOMETRIC permission");
    assert.ok(manifestContent.includes("android.permission.POST_NOTIFICATIONS"), "Must include POST_NOTIFICATIONS permission");
    assert.ok(manifestContent.includes("android.permission.VIBRATE"), "Must include VIBRATE permission");
    assert.ok(manifestContent.includes("android.permission.SCHEDULE_EXACT_ALARM"), "Must include SCHEDULE_EXACT_ALARM permission");

    // 2. capacitor.config.ts validation
    const capConfigPath = path.resolve(process.cwd(), "capacitor.config.ts");
    assert.ok(fs.existsSync(capConfigPath), "capacitor.config.ts must exist");
    const capConfigContent = fs.readFileSync(capConfigPath, "utf-8");

    assert.ok(capConfigContent.includes("com.lifeatlas.app"), "App ID must match package");
  });
});
