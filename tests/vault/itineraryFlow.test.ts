import { test, describe, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";

import {
  saveTrip,
  getTrip,
  saveItineraryDay,
  getItinerariesForTrip,
  deleteItineraryDay,
  deleteTripCascade,
  deleteVaultDB,
} from "../../src/lib/vault/storage";
import {
  TripRecord,
  ItineraryDayRecord,
  ItineraryActivity,
  ActivityStatus,
} from "../../src/lib/vault/types";

describe("Trip Vault Phase 3: Itinerary & Day-by-Day Scheduling Flow", () => {
  before(async () => {
    await deleteVaultDB();
  });

  beforeEach(async () => {
    await deleteVaultDB();
  });

  test("1. Multi-Destination Route Sequencing (REQ-ITN-01)", async () => {
    const trip: TripRecord = {
      id: "trip-itn-multi-stop",
      title: "Ladakh Trans-Himalayan Traverse",
      destination: "Ladakh",
      destinations: [
        { id: "s1", name: "Manali", stayNights: 2, orderIndex: 0 },
        { id: "s2", name: "Jispa", stayNights: 1, orderIndex: 1 },
        { id: "s3", name: "Sarchu", stayNights: 1, orderIndex: 2 },
        { id: "s4", name: "Leh", stayNights: 3, orderIndex: 3 },
      ],
      startDate: "2026-07-10T00:00:00.000Z",
      endDate: "2026-07-17T00:00:00.000Z",
      status: "PLANNING",
      travelStyle: "MOTORCYCLE",
      budgetTotal: 50000,
      currency: "INR",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await saveTrip(trip);
    const saved = await getTrip("trip-itn-multi-stop");
    assert.ok(saved);
    assert.equal(saved.destinations?.length, 4);
    assert.equal(saved.destinations?.[0].name, "Manali");
    assert.equal(saved.destinations?.[3].stayNights, 3);
  });

  test("2. Day-by-Day Calendar Generation & Management (REQ-ITN-02)", async () => {
    const day1: ItineraryDayRecord = {
      id: "itn-day-1",
      tripId: "trip-itn-multi-stop",
      dayIndex: 1,
      date: "2026-07-10T00:00:00.000Z",
      title: "Day 1 - Delhi to Manali Night Transit",
      description: "Overnight transit to basecamp. Acclimatization starts.",
      weatherNote: "Valley 22°C, clear skies",
      intensity: "MODERATE",
      activities: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const day2: ItineraryDayRecord = {
      id: "itn-day-2",
      tripId: "trip-itn-multi-stop",
      dayIndex: 2,
      date: "2026-07-11T00:00:00.000Z",
      title: "Day 2 - Rohtang Pass & Atal Tunnel Run",
      description: "Ascending into Lahaul valley.",
      weatherNote: "14°C at valley, chilly winds",
      intensity: "CHALLENGING",
      activities: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await saveItineraryDay(day1);
    await saveItineraryDay(day2);

    const tripDays = await getItinerariesForTrip("trip-itn-multi-stop");
    assert.equal(tripDays.length, 2);
    assert.equal(tripDays[0].dayIndex, 1);
    assert.equal(tripDays[1].dayIndex, 2);
    assert.equal(tripDays[1].title, "Day 2 - Rohtang Pass & Atal Tunnel Run");
    assert.equal(tripDays[1].intensity, "CHALLENGING");
  });

  test("3. Hourly Activity Blocks CRUD (REQ-ITN-03)", async () => {
    const activities: ItineraryActivity[] = [
      {
        id: "act-1",
        timeSlot: "MORNING",
        startTime: "06:30",
        endTime: "08:00",
        title: "Pre-Ride Inspection & Fuel Check",
        location: "Manali Depot",
        estimatedCost: 1500,
        status: "PLANNED",
        notes: "Check tire pressure & chain lube.",
      },
      {
        id: "act-2",
        timeSlot: "AFTERNOON",
        startTime: "13:30",
        endTime: "14:30",
        title: "Lunch at Keylong Dhabas",
        location: "Keylong",
        estimatedCost: 400,
        status: "PLANNED",
      },
      {
        id: "act-3",
        timeSlot: "EVENING",
        startTime: "18:00",
        endTime: "19:30",
        title: "Camp Setup & Oxygen Saturation Test",
        location: "Jispa Campsite",
        estimatedCost: 2000,
        status: "PLANNED",
      },
    ];

    const dayRecord: ItineraryDayRecord = {
      id: "itn-day-activities",
      tripId: "trip-itn-multi-stop",
      dayIndex: 3,
      date: "2026-07-12T00:00:00.000Z",
      title: "Day 3 - Journey to Jispa",
      activities,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await saveItineraryDay(dayRecord);

    const fetchedDays = await getItinerariesForTrip("trip-itn-multi-stop");
    const day = fetchedDays.find((d) => d.id === "itn-day-activities");
    assert.ok(day);
    assert.equal(day.activities.length, 3);
    assert.equal(day.activities[0].timeSlot, "MORNING");
    assert.equal(day.activities[1].timeSlot, "AFTERNOON");
    assert.equal(day.activities[2].timeSlot, "EVENING");
    assert.equal(day.activities[0].estimatedCost, 1500);
  });

  test("4. Activity Status Tracking & Real-Time Completion (REQ-ITN-04)", async () => {
    const initialDay: ItineraryDayRecord = {
      id: "itn-day-tracking",
      tripId: "trip-itn-multi-stop",
      dayIndex: 4,
      date: "2026-07-13T00:00:00.000Z",
      title: "Day 4 - Baralacha La Crossing",
      activities: [
        {
          id: "act-4a",
          timeSlot: "MORNING",
          title: "Cross Baralacha La Pass",
          status: "PLANNED",
        },
        {
          id: "act-4b",
          timeSlot: "AFTERNOON",
          title: "Arrive at Sarchu Camps",
          status: "PLANNED",
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await saveItineraryDay(initialDay);

    // Toggle act-4a to COMPLETED
    const updatedActivities = initialDay.activities.map((a) =>
      a.id === "act-4a" ? { ...a, status: "COMPLETED" as ActivityStatus } : a
    );

    const updatedDay: ItineraryDayRecord = {
      ...initialDay,
      activities: updatedActivities,
      updatedAt: new Date().toISOString(),
    };

    await saveItineraryDay(updatedDay);

    const reloaded = (await getItinerariesForTrip("trip-itn-multi-stop")).find(
      (d) => d.id === "itn-day-tracking"
    );
    assert.ok(reloaded);

    const completed = reloaded.activities.filter((a) => a.status === "COMPLETED");
    assert.equal(completed.length, 1);
    assert.equal(completed[0].id, "act-4a");

    const percentage = Math.round((completed.length / reloaded.activities.length) * 100);
    assert.equal(percentage, 50);
  });

  test("5. Delete Itinerary Day and Verify Cascade from Trip Deletion", async () => {
    const day: ItineraryDayRecord = {
      id: "itn-to-delete",
      tripId: "trip-itn-multi-stop",
      dayIndex: 5,
      date: "2026-07-14T00:00:00.000Z",
      title: "Day to delete",
      activities: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await saveItineraryDay(day);
    assert.ok((await getItinerariesForTrip("trip-itn-multi-stop")).some((d) => d.id === "itn-to-delete"));

    // Delete single day
    await deleteItineraryDay("itn-to-delete");
    assert.equal(
      (await getItinerariesForTrip("trip-itn-multi-stop")).some((d) => d.id === "itn-to-delete"),
      false
    );

    // Cascade delete whole trip
    await deleteTripCascade("trip-itn-multi-stop");
    const remainingDays = await getItinerariesForTrip("trip-itn-multi-stop");
    assert.equal(remainingDays.length, 0);
  });
});
