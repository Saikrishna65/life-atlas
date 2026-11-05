import { test, describe, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";

import {
  haversineDistanceMeters,
  shouldRecordPoint,
  createDefaultExpedition,
  startExpedition,
  startNewLeg,
  pauseExpedition,
  resumeExpedition,
  endExpedition,
  addBreadcrumbToExpedition,
  exportExpeditionToGeoJson,
  formatDuration,
} from "../../src/lib/vault/liveTrackingEngine";
import {
  saveTrip,
  getTrip,
  getLiveExpedition,
  saveLiveExpedition,
  deleteTripCascade,
  deleteVaultDB,
} from "../../src/lib/vault/storage";
import { TripRecord, BreadcrumbPoint } from "../../src/lib/vault/types";

describe("Trip Vault Phase 16: Live Expedition & Hybrid GPS Route Tracking Flow", () => {
  before(async () => {
    await deleteVaultDB();
  });

  beforeEach(async () => {
    await deleteVaultDB();
  });

  test("1. Haversine distance calculation is accurate across mountain terrain", () => {
    // Chopta Campsite to Tungnath Temple (~3.2 km straight line geodesic)
    const choptaLat = 30.4878;
    const choptaLon = 79.1764;
    const tungnathLat = 30.4883;
    const tungnathLon = 79.2173;

    const distanceMeters = haversineDistanceMeters(choptaLat, choptaLon, tungnathLat, tungnathLon);
    assert.ok(distanceMeters > 3800 && distanceMeters < 4100, `Expected ~3.9km, got ${distanceMeters}m`);

    // Zero distance
    assert.equal(haversineDistanceMeters(choptaLat, choptaLon, choptaLat, choptaLon), 0);
  });

  test("2. Jitter and stationary noise filtering rejects unreliable fixes", () => {
    const pt1: BreadcrumbPoint = {
      latitude: 30.4878,
      longitude: 79.1764,
      altitude: 2680,
      speed: 0,
      accuracy: 10,
      timestamp: 1000,
    };

    // First point should be accepted
    assert.equal(shouldRecordPoint(undefined, pt1), true);

    // Bad accuracy (> 40m) must be rejected
    const badAccuracyPt: BreadcrumbPoint = {
      latitude: 30.4879,
      longitude: 79.1765,
      altitude: 2680,
      speed: 0,
      accuracy: 65,
      timestamp: 4000,
    };
    assert.equal(shouldRecordPoint(pt1, badAccuracyPt), false);

    // Stationary micro-jitter (< 2m, speed 0) must be rejected
    const jitterPt: BreadcrumbPoint = {
      latitude: 30.487805,
      longitude: 79.176405,
      altitude: 2680,
      speed: 0,
      accuracy: 8,
      timestamp: 5000,
    };
    assert.equal(shouldRecordPoint(pt1, jitterPt), false);

    // Legitimate movement (> 10m) must be accepted
    const movingPt: BreadcrumbPoint = {
      latitude: 30.4881,
      longitude: 79.1767,
      altitude: 2695,
      speed: 1.4, // 5 km/h walking speed
      accuracy: 6,
      timestamp: 10000,
    };
    assert.equal(shouldRecordPoint(pt1, movingPt), true);
  });

  test("3. Hybrid Expedition lifecycle: start, add legs, pause, resume and end", () => {
    const tripId = "trip_tungnath_2026";
    let session = startExpedition(tripId, "Noida to Chopta Highway Drive", "DRIVE");

    assert.equal(session.status, "ACTIVE");
    assert.equal(session.legs.length, 1);
    assert.equal(session.legs[0].title, "Noida to Chopta Highway Drive");
    assert.equal(session.legs[0].category, "DRIVE");

    // Start a new hybrid sub-track (Tungnath Summit Trek)
    session = startNewLeg(session, "Tungnath & Chandrashila Summit Trek", "TREK");
    assert.equal(session.legs.length, 2);
    assert.equal(session.legs[0].status, "COMPLETED");
    assert.equal(session.legs[1].status, "ACTIVE");
    assert.equal(session.legs[1].title, "Tungnath & Chandrashila Summit Trek");

    // Pause tracking
    session = pauseExpedition(session);
    assert.equal(session.status, "PAUSED");
    assert.equal(session.legs[1].status, "PAUSED");

    // Resume tracking
    session = resumeExpedition(session);
    assert.equal(session.status, "ACTIVE");
    assert.equal(session.legs[1].status, "ACTIVE");

    // End tracking
    session = endExpedition(session);
    assert.equal(session.status, "COMPLETED");
    assert.equal(session.legs[1].status, "COMPLETED");
    assert.ok(session.endedAt != null);
  });

  test("4. Breadcrumb points accurately accumulate distance and elevation gain", () => {
    const tripId = "trip_chopta";
    let session = startExpedition(tripId, "Chopta to Chandrashila", "TREK");

    // Point 1: Chopta base (2,680 m)
    const p1: BreadcrumbPoint = {
      latitude: 30.4878,
      longitude: 79.1764,
      altitude: 2680,
      speed: 1.2,
      accuracy: 5,
      timestamp: 100000,
    };
    session = addBreadcrumbToExpedition(session, p1);

    // Point 2: Halfway point (3,100 m)
    const p2: BreadcrumbPoint = {
      latitude: 30.4880,
      longitude: 79.1960,
      altitude: 3100,
      speed: 1.1,
      accuracy: 5,
      timestamp: 105000,
    };
    session = addBreadcrumbToExpedition(session, p2);

    // Point 3: Chandrashila summit (3,690 m)
    const p3: BreadcrumbPoint = {
      latitude: 30.4883,
      longitude: 79.2173,
      altitude: 3690,
      speed: 0.8,
      accuracy: 5,
      timestamp: 110000,
    };
    session = addBreadcrumbToExpedition(session, p3);

    assert.ok(session.totalDistanceKm > 3.5, `Expected > 3.5 km, got ${session.totalDistanceKm} km`);
    assert.equal(session.maxElevationMeters, 3690);
    assert.ok(session.elevationGainMeters >= 1000, `Expected >= 1000m gain, got ${session.elevationGainMeters}m`);

    // Verify GeoJSON export
    const geoJson = exportExpeditionToGeoJson(session) as any;
    assert.equal(geoJson.type, "FeatureCollection");
    assert.equal(geoJson.features.length, 1);
    assert.equal(geoJson.features[0].geometry.type, "LineString");
    assert.equal(geoJson.features[0].geometry.coordinates.length, 3);
  });

  test("5. IndexedDB persistence of Live Expedition with Cascade Deletion", async () => {
    const trip: TripRecord = {
      id: "trip_test_live_storage",
      title: "Himalayan Expedition",
      destination: "Chopta",
      startDate: "2026-11-06T15:30:00.000Z",
      status: "ACTIVE",
      travelStyle: "TREKKING",
      budgetTotal: 5500,
      currency: "INR",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await saveTrip(trip);

    let session = startExpedition(trip.id, "Main Trek", "TREK");
    session = addBreadcrumbToExpedition(session, {
      latitude: 30.4878,
      longitude: 79.1764,
      altitude: 2680,
      speed: 1.5,
      accuracy: 5,
      timestamp: Date.now(),
    });

    await saveLiveExpedition(trip.id, session);

    // Retrieve from DB
    const retrieved = await getLiveExpedition(trip.id);
    assert.ok(retrieved != null);
    assert.equal(retrieved.status, "ACTIVE");
    assert.equal(retrieved.legs.length, 1);
    assert.equal(retrieved.legs[0].coordinates.length, 1);

    // Cascade delete trip
    await deleteTripCascade(trip.id);
    const postDelete = await getTrip(trip.id);
    assert.equal(postDelete, null);
    const postDeleteSession = await getLiveExpedition(trip.id);
    assert.equal(postDeleteSession, null);
  });

  test("6. Duration formatting renders cleanly", () => {
    assert.equal(formatDuration(45), "00:45");
    assert.equal(formatDuration(125), "02:05");
    assert.equal(formatDuration(3665), "1h 01m 05s");
  });
});
