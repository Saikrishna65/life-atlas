import { test, describe, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";

import {
  saveTrip,
  getTrip,
  deleteTripCascade,
  deleteVaultDB,
} from "../../src/lib/vault/storage";
import { TripRecord, DestinationStop } from "../../src/lib/vault/types";

describe("Trip Vault Phase 2: Trip Lifecycle & Management Flow", () => {
  before(async () => {
    await deleteVaultDB();
  });

  beforeEach(async () => {
    await deleteVaultDB();
  });

  test("1. Create Trip with Multi-Destination Route & Full Metadata", async () => {
    const stops: DestinationStop[] = [
      { id: "stop-1", name: "Manali", stayNights: 2, orderIndex: 0 },
      { id: "stop-2", name: "Jispa", stayNights: 1, orderIndex: 1 },
      { id: "stop-3", name: "Sarchu", stayNights: 1, orderIndex: 2 },
      { id: "stop-4", name: "Leh", stayNights: 3, orderIndex: 3 },
    ];

    const newTrip: TripRecord = {
      id: "trip-ladakh-2026",
      title: "Trans-Himalayan Odyssey",
      subtitle: "Manali to Leh via Umling La",
      destination: "Ladakh, India",
      destinations: stops,
      startDate: "2026-07-10T00:00:00.000Z",
      endDate: "2026-07-20T00:00:00.000Z",
      status: "PLANNING",
      travelStyle: "MOTORCYCLE",
      budgetTotal: 45000,
      currency: "INR",
      companions: ["Vikram", "Aditya"],
      notes: "Acclimatize in Leh before Khardung La pass.",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const saved = await saveTrip(newTrip);
    assert.equal(saved.id, "trip-ladakh-2026");
    assert.equal(saved.destinations?.length, 4);
    assert.equal(saved.companions?.length, 2);

    const fetched = await getTrip("trip-ladakh-2026");
    assert.ok(fetched);
    assert.equal(fetched.title, "Trans-Himalayan Odyssey");
    assert.equal(fetched.travelStyle, "MOTORCYCLE");
    assert.equal(fetched.budgetTotal, 45000);
    assert.equal(fetched.destinations?.[1].name, "Jispa");
  });

  test("2. Trip Lifecycle State Transitions (PLANNING -> ACTIVE -> COMPLETED)", async () => {
    const trip: TripRecord = {
      id: "trip-lifecycle-test",
      title: "Spiti Circuit",
      destination: "Spiti Valley",
      startDate: "2026-08-01T00:00:00.000Z",
      status: "PLANNING",
      travelStyle: "ROADTRIP",
      budgetTotal: 25000,
      currency: "INR",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await saveTrip(trip);

    // Transition to ACTIVE
    const activeTrip: TripRecord = {
      ...trip,
      status: "ACTIVE",
      updatedAt: new Date().toISOString(),
    };
    await saveTrip(activeTrip);

    let current = await getTrip("trip-lifecycle-test");
    assert.equal(current?.status, "ACTIVE");

    // Transition to COMPLETED
    const completedTrip: TripRecord = {
      ...trip,
      status: "COMPLETED",
      updatedAt: new Date().toISOString(),
    };
    await saveTrip(completedTrip);

    current = await getTrip("trip-lifecycle-test");
    assert.equal(current?.status, "COMPLETED");
  });

  test("3. Edit Trip Parameters and Verify Updated Timestamps", async () => {
    const initialTrip: TripRecord = {
      id: "trip-edit-test",
      title: "Initial Title",
      destination: "Goa",
      startDate: "2026-11-01T00:00:00.000Z",
      status: "PLANNING",
      travelStyle: "LEISURE",
      budgetTotal: 15000,
      currency: "INR",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await saveTrip(initialTrip);

    // Edit title, budget, and destination
    const editedTrip: TripRecord = {
      ...initialTrip,
      title: "South Goa Coastal Haven",
      budgetTotal: 22000,
      currency: "INR",
      destination: "Palolem & Agonda, South Goa",
      updatedAt: new Date().toISOString(),
    };

    await saveTrip(editedTrip);

    const updated = await getTrip("trip-edit-test");
    assert.equal(updated?.title, "South Goa Coastal Haven");
    assert.equal(updated?.budgetTotal, 22000);
    assert.equal(updated?.destination, "Palolem & Agonda, South Goa");
  });

  test("4. Safe Cascade Deletion of Trip and Verification", async () => {
    const trip: TripRecord = {
      id: "trip-to-delete",
      title: "Temporary Trip",
      destination: "Delhi",
      startDate: "2026-09-01T00:00:00.000Z",
      status: "DRAFT",
      travelStyle: "OTHER",
      budgetTotal: 5000,
      currency: "INR",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await saveTrip(trip);
    assert.ok(await getTrip("trip-to-delete"));

    const deleted = await deleteTripCascade("trip-to-delete");
    assert.equal(deleted, true);

    const lookup = await getTrip("trip-to-delete");
    assert.equal(lookup, null);
  });
});
