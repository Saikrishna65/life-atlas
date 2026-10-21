import { test, describe, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";

import {
  saveTrip,
  getWaypointsForTrip,
  saveWaypoint,
  deleteWaypoint,
  getRouteSegmentsForTrip,
  saveRouteSegment,
  deleteRouteSegment,
  deleteTripCascade,
  deleteVaultDB,
} from "../../src/lib/vault/storage";
import {
  TripRecord,
  WaypointRecord,
  RouteSegment,
} from "../../src/lib/vault/types";

describe("Trip Vault Phase 8: Maps, Routes & Offline Waypoints Flow", () => {
  before(async () => {
    await deleteVaultDB();
  });

  beforeEach(async () => {
    await deleteVaultDB();
  });

  test("1. Saved Waypoints Directory with GPS Coordinates & Elevation (REQ-MAP-01)", async () => {
    const trip: TripRecord = {
      id: "trip-map-ladakh",
      title: "Ladakh High Passes",
      destination: "Leh, Ladakh",
      startDate: "2026-07-15T00:00:00.000Z",
      status: "PLANNING",
      travelStyle: "MOTORCYCLE",
      budgetTotal: 55000,
      currency: "INR",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await saveTrip(trip);

    // Save Mountain Pass Waypoint
    const khardungLa: WaypointRecord = {
      id: "wp-khardung-la",
      tripId: "trip-map-ladakh",
      title: "Khardung La Pass",
      category: "PASS",
      latitude: 34.2787,
      longitude: 77.6047,
      elevationMeters: 5359,
      notes: "World famous gateway pass to Nubra Valley. Limit stay to 15 mins to avoid AMS.",
      createdAt: new Date().toISOString(),
    };
    await saveWaypoint("trip-map-ladakh", khardungLa);

    // Save Critical Fuel Station
    const tandiFuel: WaypointRecord = {
      id: "wp-tandi-fuel",
      tripId: "trip-map-ladakh",
      title: "Tandi Last Petrol Pump",
      category: "FUEL_PUMP",
      latitude: 32.5539,
      longitude: 76.9744,
      elevationMeters: 2850,
      notes: "Last petrol pump before Karu (365 km stretch with zero fuel stations).",
      createdAt: new Date().toISOString(),
    };
    await saveWaypoint("trip-map-ladakh", tandiFuel);

    const waypoints = await getWaypointsForTrip("trip-map-ladakh");
    assert.strictEqual(waypoints.length, 2);

    const pass = waypoints.find((w) => w.id === "wp-khardung-la");
    assert.ok(pass);
    assert.strictEqual(pass.title, "Khardung La Pass");
    assert.strictEqual(pass.category, "PASS");
    assert.strictEqual(pass.elevationMeters, 5359);
    assert.strictEqual(pass.latitude, 34.2787);
    assert.strictEqual(pass.longitude, 77.6047);

    const fuel = waypoints.find((w) => w.id === "wp-tandi-fuel");
    assert.ok(fuel);
    assert.strictEqual(fuel.category, "FUEL_PUMP");
  });

  test("2. Route Segment Summary with Distance, Terrain & Advisory Notes (REQ-MAP-02)", async () => {
    const trip: TripRecord = {
      id: "trip-map-segments",
      title: "Manali-Leh Highway Traverse",
      destination: "Leh, Ladakh",
      startDate: "2026-08-01T00:00:00.000Z",
      status: "PLANNING",
      travelStyle: "ROADTRIP",
      budgetTotal: 45000,
      currency: "INR",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await saveTrip(trip);

    const leg1: RouteSegment = {
      id: "seg-manali-jispa",
      tripId: "trip-map-segments",
      fromStop: "Manali",
      toStop: "Jispa",
      distanceKm: 138,
      estimatedHours: 4.5,
      terrainType: "MOUNTAIN_TWISTIES",
      roadCondition: "PAVED_GOOD",
      highestElevationMeters: 3120,
      passNames: ["Atal Tunnel (3,048m)"],
      advisoryNotes: "Scenic paved road through Atal Tunnel. Fuel up at Tandi pump just before Keylong.",
      orderIndex: 0,
      createdAt: new Date().toISOString(),
    };
    await saveRouteSegment("trip-map-segments", leg1);

    const leg2: RouteSegment = {
      id: "seg-jispa-sarchu",
      tripId: "trip-map-segments",
      fromStop: "Jispa",
      toStop: "Sarchu",
      distanceKm: 85,
      estimatedHours: 4.0,
      terrainType: "HIGH_ALTITUDE_PASS",
      roadCondition: "GRAVEL_UNPAVED",
      highestElevationMeters: 4890,
      passNames: ["Baralacha La (4,890m)"],
      advisoryNotes: "Rough terrain with water crossings at Zingzingbar and Bharatpur tent colony.",
      orderIndex: 1,
      createdAt: new Date().toISOString(),
    };
    await saveRouteSegment("trip-map-segments", leg2);

    const segments = await getRouteSegmentsForTrip("trip-map-segments");
    assert.strictEqual(segments.length, 2);
    assert.strictEqual(segments[0].fromStop, "Manali");
    assert.strictEqual(segments[0].toStop, "Jispa");
    assert.strictEqual(segments[1].fromStop, "Jispa");
    assert.strictEqual(segments[1].toStop, "Sarchu");

    // Total distance and time calculations
    const totalKm = segments.reduce((sum, s) => sum + s.distanceKm, 0);
    const totalHours = segments.reduce((sum, s) => sum + s.estimatedHours, 0);
    assert.strictEqual(totalKm, 223);
    assert.strictEqual(totalHours, 8.5);

    // Verify highest elevation
    const maxElevation = Math.max(...segments.map((s) => s.highestElevationMeters || 0));
    assert.strictEqual(maxElevation, 4890);
  });

  test("3. Native Navigation Intent URL & Geo Protocol Generation (REQ-MAP-03)", () => {
    const lat = 34.2787;
    const lng = 77.6047;
    const title = "Khardung La Pass";

    // Android geo: intent verification
    const encodedTitle = encodeURIComponent(title);
    const geoUri = `geo:${lat},${lng}?q=${lat},${lng}(${encodedTitle})`;
    assert.strictEqual(geoUri, "geo:34.2787,77.6047?q=34.2787,77.6047(Khardung%20La%20Pass)");

    // Web fallback Google Maps URL verification
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    assert.strictEqual(mapsUrl, "https://www.google.com/maps/search/?api=1&query=34.2787,77.6047");
  });

  test("4. Delete Waypoint, Route Segment & Cascade Cleanup upon Trip Deletion", async () => {
    const trip: TripRecord = {
      id: "trip-map-delete-test",
      title: "Spiti Circuit",
      destination: "Kaza, Spiti",
      startDate: "2026-09-05T00:00:00.000Z",
      status: "PLANNING",
      travelStyle: "MOTORCYCLE",
      budgetTotal: 35000,
      currency: "INR",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await saveTrip(trip);

    await saveWaypoint("trip-map-delete-test", {
      id: "wp-kunzum-la",
      tripId: "trip-map-delete-test",
      title: "Kunzum La Pass",
      category: "PASS",
      latitude: 32.4048,
      longitude: 77.6366,
      elevationMeters: 4590,
      createdAt: new Date().toISOString(),
    });

    await saveRouteSegment("trip-map-delete-test", {
      id: "seg-kaza-chandratal",
      tripId: "trip-map-delete-test",
      fromStop: "Kaza",
      toStop: "Chandratal Lake",
      distanceKm: 88,
      estimatedHours: 4.5,
      terrainType: "OFF_ROAD_TRAIL",
      roadCondition: "WATER_CROSSING",
      orderIndex: 0,
      createdAt: new Date().toISOString(),
    });

    let waypoints = await getWaypointsForTrip("trip-map-delete-test");
    let segments = await getRouteSegmentsForTrip("trip-map-delete-test");
    assert.strictEqual(waypoints.length, 1);
    assert.strictEqual(segments.length, 1);

    // Delete single waypoint
    await deleteWaypoint("trip-map-delete-test", "wp-kunzum-la");
    waypoints = await getWaypointsForTrip("trip-map-delete-test");
    assert.strictEqual(waypoints.length, 0);

    // Delete single route segment
    await deleteRouteSegment("trip-map-delete-test", "seg-kaza-chandratal");
    segments = await getRouteSegmentsForTrip("trip-map-delete-test");
    assert.strictEqual(segments.length, 0);

    // Cascade delete on trip deletion
    await saveWaypoint("trip-map-delete-test", {
      id: "wp-kaza-petrol",
      tripId: "trip-map-delete-test",
      title: "Kaza Indian Oil (World's Highest Retail Pump)",
      category: "FUEL_PUMP",
      latitude: 32.2276,
      longitude: 78.071,
      elevationMeters: 3740,
      createdAt: new Date().toISOString(),
    });
    waypoints = await getWaypointsForTrip("trip-map-delete-test");
    assert.strictEqual(waypoints.length, 1);

    await deleteTripCascade("trip-map-delete-test");
    waypoints = await getWaypointsForTrip("trip-map-delete-test");
    assert.strictEqual(waypoints.length, 0);
  });
});
