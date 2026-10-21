import { test, describe, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";

import {
  saveTrip,
  deleteTripCascade,
  deleteVaultDB,
  getItinerariesForTrip,
  getPackingItemsForTrip,
} from "../../src/lib/vault/storage";
import { TripRecord } from "../../src/lib/vault/types";
import {
  parseBookingText,
  SAMPLE_CONFIRMATION_TEXTS,
} from "../../src/lib/vault/pnrParser";
import {
  generateExpeditionItinerary,
  importPlanIntoVaultItinerary,
} from "../../src/lib/vault/aiItinerary";

describe("Trip Vault Phase 14: AI Itinerary & Document Parser Flow", () => {
  before(async () => {
    await deleteVaultDB();
  });

  beforeEach(async () => {
    await deleteVaultDB();
  });

  test("1. Offline PNR & IRCTC Train SMS Parser (REQ-AIX-02)", () => {
    const irctcSample = SAMPLE_CONFIRMATION_TEXTS.find((s) => s.id === "sample_irctc_train")!;
    assert.ok(irctcSample);

    const result = parseBookingText(irctcSample.text);

    assert.strictEqual(result.pnrNumber, "2458901234");
    assert.ok(result.trainOrFlightNumber.includes("12004"));
    assert.strictEqual(result.category, "TRANSPORT");
    assert.strictEqual(result.transportType, "TRAIN");
    assert.ok(result.coachBerthDetails?.includes("B3"));
    assert.ok(result.coachBerthDetails?.includes("42"));
    assert.strictEqual(result.totalFare, 1465);
    assert.ok(result.confidenceScore && result.confidenceScore > 0.8);
    assert.ok(result.passengers && result.passengers.length > 0);
    assert.strictEqual(result.passengers[0], "SAI KRISHNA");
  });

  test("2. Flight & Intercity Bus Confirmation Extraction (REQ-AIX-02)", () => {
    // Flight check
    const flightSample = SAMPLE_CONFIRMATION_TEXTS.find((s) => s.id === "sample_indigo_flight")!;
    const flightResult = parseBookingText(flightSample.text);

    assert.strictEqual(flightResult.pnrNumber, "W47K9X");
    assert.ok(flightResult.trainOrFlightNumber.includes("6E-205"));
    assert.strictEqual(flightResult.category, "TRANSPORT");
    assert.strictEqual(flightResult.transportType, "FLIGHT");
    assert.ok(flightResult.carrier.toLowerCase().includes("indigo"));
    assert.ok(flightResult.coachBerthDetails?.includes("14A"));
    assert.strictEqual(flightResult.totalFare, 6850);

    // Bus check
    const busSample = SAMPLE_CONFIRMATION_TEXTS.find((s) => s.id === "sample_bus_booking")!;
    const busResult = parseBookingText(busSample.text);

    assert.strictEqual(busResult.pnrNumber, "ZB-9871234");
    assert.strictEqual(busResult.category, "TRANSPORT");
    assert.strictEqual(busResult.transportType, "BUS");
    assert.strictEqual(busResult.totalFare, 1650);
  });

  test("3. Curated & Dynamic AI Itinerary Generation (REQ-AIX-01)", async () => {
    // Spiti Valley Curated Circuit
    const spitiPlan = await generateExpeditionItinerary({
      destination: "Spiti Valley",
      durationDays: 8,
      travelStyle: "MOTORCYCLE",
      intensity: "CHALLENGING",
    });

    assert.strictEqual(spitiPlan.destination, "Spiti Valley");
    assert.strictEqual(spitiPlan.durationDays, 8);
    assert.strictEqual(spitiPlan.generatedDays.length, 8);
    assert.ok(spitiPlan.suggestedGear.some((g) => g.toLowerCase().includes("diamox")));
    assert.ok(spitiPlan.localAdvisories.some((a) => a.toLowerCase().includes("kunzum")));
    assert.strictEqual(spitiPlan.isOfflineFallback, true);

    // Dynamic Generic Itinerary Generation
    const zanskarPlan = await generateExpeditionItinerary({
      destination: "Zanskar Gorge",
      durationDays: 4,
      travelStyle: "TREKKING",
      intensity: "CHALLENGING",
    });

    assert.strictEqual(zanskarPlan.destination, "Zanskar Gorge");
    assert.strictEqual(zanskarPlan.durationDays, 4);
    assert.strictEqual(zanskarPlan.generatedDays.length, 4);
    assert.ok(zanskarPlan.generatedDays[0].activities && zanskarPlan.generatedDays[0].activities.length >= 3);
  });

  test("4. 1-Click Accept & Import Plan into Vault IndexedDB (REQ-AIX-01)", async () => {
    const tripId = "trip-ai-import-spiti";
    const trip: TripRecord = {
      id: tripId,
      title: "Spiti High Altitude Circuit",
      destination: "Spiti Valley",
      startDate: "2026-06-01T00:00:00.000Z",
      status: "PLANNING",
      travelStyle: "MOTORCYCLE",
      budgetTotal: 40000,
      currency: "INR",
      createdAt: "2026-05-15T00:00:00.000Z",
      updatedAt: "2026-05-15T00:00:00.000Z",
    };
    await saveTrip(trip);

    const plan = await generateExpeditionItinerary({
      destination: "Spiti Valley",
      durationDays: 8,
      travelStyle: "MOTORCYCLE",
    });

    // 1-Click Import
    const importResult = await importPlanIntoVaultItinerary(tripId, plan, trip.startDate);
    assert.strictEqual(importResult.daysCreated, 8);
    assert.ok(importResult.gearCreated > 0);

    // Verify written to IndexedDB
    const daysInDB = await getItinerariesForTrip(tripId);
    assert.strictEqual(daysInDB.length, 8);
    assert.ok(daysInDB[0].title.includes("Shimla"));
    assert.ok(daysInDB[0].activities.length > 0);

    const gearInDB = await getPackingItemsForTrip(tripId);
    assert.ok(gearInDB.length > 0);
    assert.ok(gearInDB.some((g) => g.name.toLowerCase().includes("diamox")));

    // Cascade Erasure verification
    await deleteTripCascade(tripId);
    const afterDays = await getItinerariesForTrip(tripId);
    assert.strictEqual(afterDays.length, 0);

    const afterGear = await getPackingItemsForTrip(tripId);
    assert.strictEqual(afterGear.length, 0);
  });
});
