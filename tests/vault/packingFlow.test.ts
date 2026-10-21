import { test, describe, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";

import {
  saveTrip,
  getTrip,
  savePackingItem,
  getPackingItemsForTrip,
  togglePackingItem,
  deletePackingItem,
  deleteTripCascade,
  deleteVaultDB,
} from "../../src/lib/vault/storage";
import {
  TripRecord,
  PackingItemRecord,
} from "../../src/lib/vault/types";
import { PACKING_PRESETS } from "../../src/lib/vault/usePackingList";

describe("Trip Vault Phase 10: Packing Lists & Equipment Checklists Flow", () => {
  before(async () => {
    await deleteVaultDB();
  });

  beforeEach(async () => {
    await deleteVaultDB();
  });

  test("1. Categorized Gear Lists Creation & Category Grouping (REQ-PCK-01)", async () => {
    const trip: TripRecord = {
      id: "trip-pack-spiti",
      title: "Spiti Valley Monsoon Ride",
      destination: "Kaza, Spiti Valley",
      startDate: "2026-08-10T00:00:00.000Z",
      status: "PLANNING",
      travelStyle: "MOTORCYCLE",
      budgetTotal: 40000,
      currency: "INR",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await saveTrip(trip);

    const sampleItems: PackingItemRecord[] = [
      {
        id: "pck-doc-1",
        tripId: trip.id,
        category: "DOCUMENTS",
        name: "Original Driving License",
        quantity: 1,
        isEssential: true,
        isPacked: false,
        notes: "In waterproof tank pouch",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "pck-gear-1",
        tripId: trip.id,
        category: "RIDING_GEAR",
        name: "Armored Riding Jacket",
        quantity: 1,
        isEssential: true,
        isPacked: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "pck-elec-1",
        tripId: trip.id,
        category: "ELECTRONICS",
        name: "Power Bank 20,000mAh",
        quantity: 1,
        isEssential: false,
        isPacked: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "pck-med-1",
        tripId: trip.id,
        category: "FIRST_AID",
        name: "Diamox AMS Tablets",
        quantity: 10,
        isEssential: true,
        isPacked: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "pck-cloth-1",
        tripId: trip.id,
        category: "CLOTHING",
        name: "Thermal Base Layers",
        quantity: 2,
        isEssential: true,
        isPacked: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    for (const item of sampleItems) {
      await savePackingItem(item);
    }

    const items = await getPackingItemsForTrip(trip.id);
    assert.strictEqual(items.length, 5);

    // Verify item counts by category
    const docItems = items.filter((i) => i.category === "DOCUMENTS");
    assert.strictEqual(docItems.length, 1);
    assert.strictEqual(docItems[0].name, "Original Driving License");

    const ridingItems = items.filter((i) => i.category === "RIDING_GEAR");
    assert.strictEqual(ridingItems.length, 1);
    assert.strictEqual(ridingItems[0].name, "Armored Riding Jacket");

    // Verify overall packed metrics
    const packedCount = items.filter((i) => i.isPacked).length;
    assert.strictEqual(packedCount, 2); // elec-1 and cloth-1
    const percentPacked = Math.round((packedCount / items.length) * 100);
    assert.strictEqual(percentPacked, 40);
  });

  test("2. Persistent Checkbox Toggle & Status State (REQ-PCK-01)", async () => {
    const tripId = "trip-pack-spiti";
    const item: PackingItemRecord = {
      id: "pck-toggle-test",
      tripId,
      category: "DOCUMENTS",
      name: "Bike RC Smart Card",
      quantity: 1,
      isEssential: true,
      isPacked: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await savePackingItem(item);

    // Toggle to packed
    const updated = await togglePackingItem("pck-toggle-test", true);
    assert.strictEqual(updated.isPacked, true);

    const reloaded = (await getPackingItemsForTrip(tripId)).find(
      (i) => i.id === "pck-toggle-test"
    );
    assert.ok(reloaded);
    assert.strictEqual(reloaded.isPacked, true);

    // Toggle back to unpacked
    const toggledOff = await togglePackingItem("pck-toggle-test", false);
    assert.strictEqual(toggledOff.isPacked, false);

    const reloadedOff = (await getPackingItemsForTrip(tripId)).find(
      (i) => i.id === "pck-toggle-test"
    );
    assert.ok(reloadedOff);
    assert.strictEqual(reloadedOff.isPacked, false);
  });

  test("3. Essential Items Filter & Critical Unpacked Alert (REQ-PCK-02)", async () => {
    const tripId = "trip-pack-spiti";
    const items: PackingItemRecord[] = [
      {
        id: "pck-ess-1",
        tripId,
        category: "DOCUMENTS",
        name: "Passport / Government ID",
        quantity: 1,
        isEssential: true,
        isPacked: false, // CRITICAL UNPACKED
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "pck-ess-2",
        tripId,
        category: "FIRST_AID",
        name: "Personal Prescription Inhaler",
        quantity: 1,
        isEssential: true,
        isPacked: false, // CRITICAL UNPACKED
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "pck-noness-1",
        tripId,
        category: "ELECTRONICS",
        name: "Drone with Extra Propellers",
        quantity: 1,
        isEssential: false,
        isPacked: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "pck-ess-3",
        tripId,
        category: "RIDING_GEAR",
        name: "DOT Certified Helmet",
        quantity: 1,
        isEssential: true,
        isPacked: true, // ESSENTIAL BUT PACKED
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    for (const item of items) {
      await savePackingItem(item);
    }

    const all = await getPackingItemsForTrip(tripId);
    const essentialItems = all.filter((i) => i.isEssential);
    assert.strictEqual(essentialItems.length, 3);

    // Critical unpacked alert verification: items that are essential AND isPacked === false
    const criticalUnpacked = essentialItems.filter((i) => !i.isPacked);
    assert.strictEqual(criticalUnpacked.length, 2);
    const names = criticalUnpacked.map((i) => i.name);
    assert.ok(names.includes("Passport / Government ID"));
    assert.ok(names.includes("Personal Prescription Inhaler"));
    assert.ok(!names.includes("DOT Certified Helmet"));

    // Now pack both critical items
    await togglePackingItem("pck-ess-1", true);
    await togglePackingItem("pck-ess-2", true);

    const refreshed = await getPackingItemsForTrip(tripId);
    const remainingCritical = refreshed.filter((i) => i.isEssential && !i.isPacked);
    assert.strictEqual(remainingCritical.length, 0);
  });

  test("4. Custom Checklist Items CRUD & Quantity Stepper (REQ-PCK-03)", async () => {
    const tripId = "trip-pack-spiti";
    const customItem: PackingItemRecord = {
      id: "pck-custom-bungee",
      tripId,
      category: "MISC",
      name: "Heavy-Duty Bungee Cords",
      quantity: 4,
      isEssential: true,
      isPacked: false,
      notes: "For tail-bag fastening",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Create
    await savePackingItem(customItem);
    const stored = (await getPackingItemsForTrip(tripId)).find(
      (i) => i.id === "pck-custom-bungee"
    );
    assert.ok(stored);
    assert.strictEqual(stored.quantity, 4);

    // Update quantity (e.g. increase from 4 to 6)
    stored.quantity = 6;
    await savePackingItem(stored);

    const updated = (await getPackingItemsForTrip(tripId)).find(
      (i) => i.id === "pck-custom-bungee"
    );
    assert.ok(updated);
    assert.strictEqual(updated.quantity, 6);

    // Delete item
    await deletePackingItem("pck-custom-bungee");
    const afterDelete = (await getPackingItemsForTrip(tripId)).find(
      (i) => i.id === "pck-custom-bungee"
    );
    assert.strictEqual(afterDelete, undefined);
  });

  test("5. Expedition Preset Seeder & Cascade Deletion on Trip Erasure", async () => {
    const tripId = "trip-pack-preset-test";
    const trip: TripRecord = {
      id: tripId,
      title: "Himalayan Solo Odyssey",
      destination: "Leh, Ladakh",
      startDate: "2026-09-01T00:00:00.000Z",
      status: "PLANNING",
      travelStyle: "MOTORCYCLE",
      budgetTotal: 35000,
      currency: "INR",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await saveTrip(trip);

    // Seed preset items
    const preset = PACKING_PRESETS.HIMALAYAN_RIDE;
    assert.ok(preset.items.length >= 20);

    for (let i = 0; i < preset.items.length; i++) {
      const def = preset.items[i];
      await savePackingItem({
        id: `pck-preset-${i}`,
        tripId,
        category: def.category,
        name: def.name,
        quantity: def.quantity,
        isEssential: def.isEssential,
        isPacked: false,
        notes: def.notes,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    const seededItems = await getPackingItemsForTrip(tripId);
    assert.strictEqual(seededItems.length, preset.items.length);

    // Verify cascade deletion cleans all packing items
    await deleteTripCascade(tripId);
    const postCascadeItems = await getPackingItemsForTrip(tripId);
    assert.strictEqual(postCascadeItems.length, 0);

    const reloadedTrip = await getTrip(tripId);
    assert.strictEqual(reloadedTrip, null);
  });
});
