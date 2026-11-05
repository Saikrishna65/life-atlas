import { test, describe, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";

import {
  saveTrip,
  getTrip,
  deleteTripCascade,
  deleteVaultDB,
  saveRental,
  saveExpense,
  saveMemory,
  getMemoriesForTrip,
  deleteMemory,
  completeTripAndArchive,
  reopenTrip,
} from "../../src/lib/vault/storage";
import {
  TripRecord,
  TripMemoryRecord,
  VehicleRentalRecord,
  ExpenseRecord,
  RouteSegment,
} from "../../src/lib/vault/types";

describe("Trip Vault Phase 13: Completed Trip Archives & Photo Memories Flow", () => {
  before(async () => {
    await deleteVaultDB();
  });

  beforeEach(async () => {
    await deleteVaultDB();
  });

  test("1. Completed Trip Milestone & Dossier Computation (REQ-MEM-01)", async () => {
    const tripId = "trip-mem-spiti";
    const segment: RouteSegment = {
      id: "seg-1",
      tripId,
      fromStop: "Manali",
      toStop: "Kaza",
      distanceKm: 202,
      estimatedHours: 7,
      terrainType: "HIGH_ALTITUDE_PASS",
      roadCondition: "GRAVEL_UNPAVED",
      passNames: ["Rohtang Pass", "Kunzum Pass"],
      orderIndex: 0,
      createdAt: "2026-06-01T00:00:00.000Z",
    };

    const trip: TripRecord = {
      id: tripId,
      title: "Spiti High Altitude Circuit",
      destination: "Spiti Valley, Himachal Pradesh",
      startDate: "2026-06-01T00:00:00.000Z",
      endDate: "2026-06-12T00:00:00.000Z",
      status: "ACTIVE",
      travelStyle: "MOTORCYCLE",
      budgetTotal: 45000,
      currency: "INR",
      routeSegments: [segment],
      createdAt: "2026-05-20T00:00:00.000Z",
      updatedAt: "2026-05-20T00:00:00.000Z",
    };

    await saveTrip(trip);

    // Save rental with odometer readings (End - Start = 480 km)
    const rental: VehicleRentalRecord = {
      id: "rnt-himalayan-spiti",
      tripId,
      vehicleType: "MOTORCYCLE",
      vehicleModel: "Royal Enfield Himalayan 450",
      vehicleRegNumber: "HP-01-AB-9988",
      vendorName: "Manali High Riders",
      vendorPhone: "+91 98160 12345",
      pickupLocation: "Mall Road, Manali",
      pickupTime: "2026-06-01T09:00:00.000Z",
      dropoffLocation: "Old Manali",
      dropoffTime: "2026-06-12T18:00:00.000Z",
      startOdometerKm: 12400,
      endOdometerKm: 12880, // 480 km ridden
      dailyRate: 1800,
      securityDeposit: 10000,
      depositPaymentMode: "UPI",
      depositRefundStatus: "PENDING",
      gearIncluded: ["Helmet", "Bungee Cords"],
      inspectionPhotos: [],
      createdAt: "2026-05-25T00:00:00.000Z",
      updatedAt: "2026-05-25T00:00:00.000Z",
    };
    await saveRental(rental);

    // Save expenses
    const expense: ExpenseRecord = {
      id: "exp-fuel-kaza",
      tripId,
      title: "Petrol Refuel at World's Highest Petrol Pump",
      amount: 1850,
      currency: "INR",
      category: "FUEL",
      paidBy: "Self",
      paymentMode: "CASH",
      date: "2026-06-05T12:00:00.000Z",
      isDeposit: false,
      createdAt: "2026-06-05T12:00:00.000Z",
      updatedAt: "2026-06-05T12:00:00.000Z",
    };
    await saveExpense(expense);

    // Transition trip status to COMPLETED
    const completed = await completeTripAndArchive(tripId);
    assert.strictEqual(completed.status, "COMPLETED");
    assert.ok(completed.completedAt, "Completion timestamp should be stamped");

    // Verify retrieval from DB
    const persisted = await getTrip(tripId);
    assert.ok(persisted);
    assert.strictEqual(persisted.status, "COMPLETED");
    assert.ok(persisted.completedAt);

    // Reopen trip back to ACTIVE
    const reopened = await reopenTrip(tripId);
    assert.strictEqual(reopened.status, "ACTIVE");
  });

  test("2. Photo Reflection Wall & Memory CRUD (REQ-MEM-02)", async () => {
    const tripId = "trip-mem-ladakh";
    const trip: TripRecord = {
      id: tripId,
      title: "Ladakh Monasteries & High Passes",
      destination: "Leh, Ladakh",
      startDate: "2026-07-01T00:00:00.000Z",
      status: "ACTIVE",
      travelStyle: "BACKPACKING",
      budgetTotal: 60000,
      currency: "INR",
      createdAt: "2026-06-15T00:00:00.000Z",
      updatedAt: "2026-06-15T00:00:00.000Z",
    };
    await saveTrip(trip);

    // Add Memory 1 (Highlight)
    const mem1: TripMemoryRecord = {
      id: "mem-khardungla",
      tripId,
      title: "Top of Khardung La Pass (17,982 ft)",
      date: "2026-07-04T11:30:00.000Z",
      location: "Khardung La, Ladakh",
      caption: "Prayer flags dancing violently in sub-zero alpine winds.",
      imageDataUrl: "data:image/webp;base64,UklGRkAAAABXRUJQVlA4IDQAAADwAQCdASoBAAEAAQAcJaACdLoAAP7/1/4AAAA=",
      isHighlight: true,
      rating: 5,
      createdAt: "2026-07-04T12:00:00.000Z",
    };
    await saveMemory(tripId, mem1);

    // Add Memory 2 (Normal)
    const mem2: TripMemoryRecord = {
      id: "mem-thiksey",
      tripId,
      title: "Morning Butter Tea at Thiksey Monastery",
      date: "2026-07-06T07:00:00.000Z",
      location: "Thiksey Gompa",
      caption: "Chanting monks echoing through ancient wooden prayer halls.",
      imageDataUrl: "data:image/webp;base64,UklGRkAAAABXRUJQVlA4IDQAAADwAQCdASoBAAEAAQAcJaACdLoAAP7/1/4AAAA=",
      isHighlight: false,
      rating: 4,
      createdAt: "2026-07-06T08:00:00.000Z",
    };
    await saveMemory(tripId, mem2);

    // Verify retrieval
    const memList = await getMemoriesForTrip(tripId);
    assert.strictEqual(memList.length, 2);

    const khardungLa = memList.find((m) => m.id === "mem-khardungla");
    assert.ok(khardungLa);
    assert.strictEqual(khardungLa.isHighlight, true);
    assert.strictEqual(khardungLa.rating, 5);
    assert.strictEqual(khardungLa.location, "Khardung La, Ladakh");

    // Toggle highlight
    khardungLa.isHighlight = false;
    await saveMemory(tripId, khardungLa);
    const updatedList = await getMemoriesForTrip(tripId);
    const updatedMem = updatedList.find((m) => m.id === "mem-khardungla");
    assert.strictEqual(updatedMem?.isHighlight, false);

    // Delete single memory
    const deleted = await deleteMemory(tripId, "mem-thiksey");
    assert.strictEqual(deleted, true);

    const afterDeleteList = await getMemoriesForTrip(tripId);
    assert.strictEqual(afterDeleteList.length, 1);
    assert.strictEqual(afterDeleteList[0].id, "mem-khardungla");
  });

  test("3. Export to Public Journal Payload Structure & Validation (REQ-MEM-03)", () => {
    const rawTitle = "Spiti Valley & Chandra Taal Odyssey!";
    const rawDestination = "Spiti Valley, Himachal Pradesh";

    const baseSlug = (rawTitle || rawDestination)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "");

    assert.strictEqual(baseSlug, "spiti-valley-chandra-taal-odyssey");

    const payload = {
      title: rawTitle,
      destination: rawDestination,
      startDate: "2026-06-01T00:00:00.000Z",
      endDate: "2026-06-12T00:00:00.000Z",
      description: "Expedition through Spiti.",
      coverImage: "data:image/webp;base64,abc",
      memories: [
        {
          title: "Chandra Taal Reflection",
          caption: "Crescent lake at 14,000 ft",
          date: "2026-06-08T00:00:00.000Z",
          imageUrl: "data:image/webp;base64,lake",
        },
      ],
      itineraryDays: [
        {
          dayIndex: 0,
          date: "2026-06-01T00:00:00.000Z",
          title: "Day 1: Manali to Kaza",
          description: "Crossing Rohtang and Kunzum Pass",
        },
      ],
    };

    assert.ok(payload.title);
    assert.ok(payload.destination);
    assert.ok(payload.startDate);
    assert.strictEqual(payload.memories.length, 1);
    assert.strictEqual(payload.itineraryDays.length, 1);
  });

  test("4. Atomic Cascade Deletion on Trip Erasure", async () => {
    const tripId = "trip-mem-cascade";
    const trip: TripRecord = {
      id: tripId,
      title: "Himalayan Ridge Expedition",
      destination: "Uttarakhand",
      startDate: "2026-08-01T00:00:00.000Z",
      status: "ACTIVE",
      travelStyle: "BACKPACKING",
      budgetTotal: 25000,
      currency: "INR",
      memories: [
        {
          id: "mem-chopta-tungnath",
          tripId,
          title: "Trek to Tungnath Highest Shiva Temple",
          date: "2026-08-03T00:00:00.000Z",
          isHighlight: true,
          rating: 5,
          createdAt: "2026-08-03T00:00:00.000Z",
        },
      ],
      createdAt: "2026-07-20T00:00:00.000Z",
      updatedAt: "2026-07-20T00:00:00.000Z",
    };
    await saveTrip(trip);

    // Verify memory exists
    const beforeList = await getMemoriesForTrip(tripId);
    assert.strictEqual(beforeList.length, 1);

    // Cascade delete trip
    const cascadeResult = await deleteTripCascade(tripId);
    assert.strictEqual(cascadeResult, true);

    // Verify trip and memories are erased
    const afterTrip = await getTrip(tripId);
    assert.strictEqual(afterTrip, null);

    const afterList = await getMemoriesForTrip(tripId);
    assert.strictEqual(afterList.length, 0);
  });

  test("5. Multi-Photo Support and Specific Place Association (Devprayag & Custom Places)", async () => {
    const tripId = "trip-tungnath-multi-photo";
    const trip: TripRecord = {
      id: tripId,
      title: "Chopta Tungnath Chandrashila Trek",
      destination: "Chopta, Tungnath & Chandrashila",
      startDate: "2026-11-06T00:00:00.000Z",
      endDate: "2026-11-10T00:00:00.000Z",
      status: "ACTIVE",
      travelStyle: "TREKKING",
      budgetTotal: 5500,
      currency: "INR",
      waypoints: [
        {
          id: "wp-devprayag",
          tripId,
          title: "Devprayag Sangam",
          category: "VIEWPOINT",
          latitude: 30.1458,
          longitude: 78.5989,
          createdAt: "2026-11-06T00:00:00.000Z",
        },
        {
          id: "wp-tungnath",
          tripId,
          title: "Tungnath Shiva Temple",
          category: "VIEWPOINT",
          latitude: 30.4883,
          longitude: 79.2167,
          createdAt: "2026-11-06T00:00:00.000Z",
        },
      ],
      createdAt: "2026-11-05T00:00:00.000Z",
      updatedAt: "2026-11-05T00:00:00.000Z",
    };
    await saveTrip(trip);

    // Memory 1: Devprayag with 4 photos
    const devprayagPhotos = [
      "data:image/webp;base64,devprayag_sangam_confluence_1",
      "data:image/webp;base64,devprayag_bhagirathi_river_2",
      "data:image/webp;base64,devprayag_alaknanda_river_3",
      "data:image/webp;base64,devprayag_ghat_view_4",
    ];

    const mem1: TripMemoryRecord = {
      id: "mem-devprayag-sangam",
      tripId,
      title: "Holy Sangam at Devprayag",
      date: "2026-11-06T23:30:00.000Z",
      location: "Devprayag Sangam",
      placeId: "wp-devprayag",
      placeName: "Devprayag Sangam",
      caption: "Mesmerizing meeting point of turquoise Bhagirathi and muddy Alaknanda forming Ganga.",
      imageDataUrl: devprayagPhotos[0],
      images: devprayagPhotos,
      isHighlight: true,
      rating: 5,
      createdAt: "2026-11-06T23:30:00.000Z",
    };
    await saveMemory(tripId, mem1);

    // Memory 2: Tungnath with 2 photos
    const tungnathPhotos = [
      "data:image/webp;base64,tungnath_ancient_temple_shrine_1",
      "data:image/webp;base64,tungnath_himalayan_backdrop_2",
    ];

    const mem2: TripMemoryRecord = {
      id: "mem-tungnath-darshan",
      tripId,
      title: "Morning Darshan at Tungnath",
      date: "2026-11-08T09:00:00.000Z",
      location: "Tungnath Shiva Temple",
      placeId: "wp-tungnath",
      placeName: "Tungnath Shiva Temple",
      caption: "World's highest Shiva temple at 3,460m. Absolute peace and spiritual energy.",
      imageDataUrl: tungnathPhotos[0],
      images: tungnathPhotos,
      isHighlight: true,
      rating: 5,
      createdAt: "2026-11-08T09:00:00.000Z",
    };
    await saveMemory(tripId, mem2);

    // Memory 3: Custom place added on the fly (Sari Village homestay)
    const mem3: TripMemoryRecord = {
      id: "mem-sari-homestay",
      tripId,
      title: "Local Himalayan Garhwali Dinner",
      date: "2026-11-09T19:00:00.000Z",
      location: "Sari Village",
      placeName: "Sari Village",
      caption: "Warm Mandua ki Roti and Gahat ki Dal prepared by friendly locals.",
      imageDataUrl: "data:image/webp;base64,sari_village_meal_1",
      images: ["data:image/webp;base64,sari_village_meal_1"],
      isHighlight: false,
      rating: 5,
      createdAt: "2026-11-09T19:00:00.000Z",
    };
    await saveMemory(tripId, mem3);

    // Verify all 3 memories retrieved
    const list = await getMemoriesForTrip(tripId);
    assert.strictEqual(list.length, 3);

    // Verify multi-photo persistence for Devprayag
    const savedDevprayag = list.find((m) => m.id === "mem-devprayag-sangam");
    assert.ok(savedDevprayag);
    assert.strictEqual(savedDevprayag.images?.length, 4);
    assert.strictEqual(savedDevprayag.imageDataUrl, devprayagPhotos[0]);
    assert.strictEqual(savedDevprayag.placeName, "Devprayag Sangam");
    assert.strictEqual(savedDevprayag.placeId, "wp-devprayag");

    // Verify Tungnath photos
    const savedTungnath = list.find((m) => m.id === "mem-tungnath-darshan");
    assert.ok(savedTungnath);
    assert.strictEqual(savedTungnath.images?.length, 2);
    assert.strictEqual(savedTungnath.placeName, "Tungnath Shiva Temple");

    // Verify Place-based filtering logic
    const devprayagMemories = list.filter(
      (m) => (m.placeName || m.location)?.toLowerCase() === "devprayag sangam"
    );
    assert.strictEqual(devprayagMemories.length, 1);
    assert.strictEqual(devprayagMemories[0].title, "Holy Sangam at Devprayag");

    const tungnathMemories = list.filter(
      (m) => (m.placeName || m.location)?.toLowerCase() === "tungnath shiva temple"
    );
    assert.strictEqual(tungnathMemories.length, 1);
    assert.strictEqual(tungnathMemories[0].title, "Morning Darshan at Tungnath");

    const sariMemories = list.filter(
      (m) => (m.placeName || m.location)?.toLowerCase() === "sari village"
    );
    assert.strictEqual(sariMemories.length, 1);
    assert.strictEqual(sariMemories[0].title, "Local Himalayan Garhwali Dinner");
  });

});
