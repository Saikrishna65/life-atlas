import { test, describe, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";

import {
  syncActiveTripToWidget,
  syncTripWidget,
  TripWidgetData,
} from "../../src/lib/vault/tripWidgetSync";
import {
  saveTrip,
  saveLiveExpedition,
  deleteVaultDB,
} from "../../src/lib/vault/storage";
import { TripRecord, LiveExpeditionSession } from "../../src/lib/vault/types";

describe("Trip Vault Android Home Screen Widget Sync", () => {
  before(async () => {
    await deleteVaultDB();
  });

  beforeEach(async () => {
    await deleteVaultDB();
  });

  test("1. Returns IDLE payload when no trips exist in vault", async () => {
    const data = await syncActiveTripToWidget();
    assert.ok(data);
    assert.equal(data.status, "IDLE");
    assert.equal(data.statusLabel, "NO TRIPS");
    assert.equal(data.title, "Atlas Trip Vault");
    assert.equal(data.targetRoute, "/secret/vault");
  });

  test("2. Accurately extracts live GPS distance, altitude, and active leg from an ACTIVE expedition", async () => {
    const trip: TripRecord = {
      id: "trip-test-active-1",
      title: "Himalayan Ridge Expedition",
      destination: "Chopta Meadows, Uttarakhand",
      startDate: "2026-11-05T06:00:00Z",
      status: "ACTIVE",
      travelStyle: "TREKKING",
      budgetTotal: 12000,
      currency: "INR",
      notes: "Base camp altitude 2,680m",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await saveTrip(trip);

    const session: LiveExpeditionSession = {
      tripId: trip.id,
      status: "ACTIVE",
      totalDistanceKm: 436.14,
      totalDurationSeconds: 14200,
      movingSeconds: 13300,
      elevationGainMeters: 2475,
      currentElevationMeters: 2680,
      currentSpeedKmh: 22.4,
      activeLegId: "leg-3",
      legs: [
        {
          id: "leg-1",
          tripId: trip.id,
          title: "Delhi to Rishikesh",
          category: "DRIVE",
          status: "COMPLETED",
          startedAt: "2026-11-05T06:00:00Z",
          endedAt: "2026-11-05T08:30:00Z",
          distanceKm: 228.4,
          durationSeconds: 9000,
          movingSeconds: 8500,
          maxSpeedKmh: 88,
          avgSpeedKmh: 65,
          elevationGainMeters: 100,
          coordinates: [],
        },
        {
          id: "leg-3",
          tripId: trip.id,
          title: "Devprayag to Chopta Meadows",
          category: "TREK",
          status: "ACTIVE",
          startedAt: "2026-11-05T09:00:00Z",
          distanceKm: 136.5,
          durationSeconds: 5200,
          movingSeconds: 4800,
          maxSpeedKmh: 45,
          avgSpeedKmh: 30,
          elevationGainMeters: 2155,
          coordinates: [
            {
              latitude: 30.4856,
              longitude: 79.1764,
              altitude: 2680,
              speed: 22,
              accuracy: 5,
              timestamp: Date.now(),
            },
          ],
        },
      ],
    };
    await saveLiveExpedition(trip.id, session);

    const data = await syncActiveTripToWidget();
    assert.ok(data);
    assert.equal(data.status, "ACTIVE");
    assert.equal(data.statusLabel, "ON THE ROAD");
    assert.equal(data.title, "Himalayan Ridge Expedition");
    assert.equal(data.subtitle, "Devprayag to Chopta Meadows");
    assert.equal(data.metric1Label, "DISTANCE");
    assert.equal(data.metric1Value, "436.1 km");
    assert.equal(data.metric2Label, "ALTITUDE");
    assert.equal(data.metric2Value, "2,680 m");
    assert.equal(data.targetRoute, "/secret/vault/trip-test-active-1/tracking");
  });

  test("3. Accurately formats upcoming trek dates and days countdown when status is PLANNING", async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().slice(0, 10);

    const endDate = new Date(tomorrow);
    endDate.setDate(endDate.getDate() + 4);
    const endStr = endDate.toISOString().slice(0, 10);

    const trip: TripRecord = {
      id: "trip-tungnath-upcoming",
      title: "Chopta Tungnath Chandrashila Trek",
      destination: "Chopta & Chandrashila Peak",
      startDate: tomorrowStr,
      endDate: endStr,
      status: "PLANNING",
      travelStyle: "TREKKING",
      budgetTotal: 5500,
      currency: "INR",
      notes: "Pickup: Botanical Garden Metro, Noida (9 PM)",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await saveTrip(trip);

    const data = await syncActiveTripToWidget();
    assert.ok(data);
    assert.equal(data.status, "PLANNING");
    assert.equal(data.statusLabel, "STARTS TOMORROW");
    assert.equal(data.title, "Chopta Tungnath Chandrashila Trek");
    assert.equal(data.subtitle, "Chopta & Chandrashila Peak");
    assert.equal(data.metric1Label, "START DATE");
    assert.equal(data.metric2Label, "DURATION");
    assert.equal(data.metric2Value, "5 Days");
    assert.equal(data.targetRoute, "/secret/vault/trip-tungnath-upcoming");
  });

  test("4. Safe invocation of syncTripWidget does not crash in non-native / node environment", () => {
    assert.doesNotThrow(() => {
      syncTripWidget({
        tripId: "test-trip",
        title: "Test Expedition",
        status: "ACTIVE",
        metric1Label: "DISTANCE",
        metric1Value: "12.5 km",
      });
    });
  });
});
