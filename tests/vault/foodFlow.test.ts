import { test, describe, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";

import {
  saveTrip,
  saveFoodItem,
  getFoodItemsForTrip,
  deleteFoodItem,
  deleteTripCascade,
  deleteVaultDB,
} from "../../src/lib/vault/storage";
import {
  TripRecord,
  FoodPlannerRecord,
} from "../../src/lib/vault/types";

describe("Trip Vault Phase 6: Culinary & Food Roadmaps Flow", () => {
  before(async () => {
    await deleteVaultDB();
  });

  beforeEach(async () => {
    await deleteVaultDB();
  });

  test("1. Regional Specialty Checklist Creation & Status Toggle (REQ-FOD-01)", async () => {
    const trip: TripRecord = {
      id: "trip-food-ladakh",
      title: "Ladakh Culinary Odyssey",
      destination: "Leh, Ladakh",
      startDate: "2026-07-20T00:00:00.000Z",
      status: "PLANNING",
      travelStyle: "MOTORCYCLE",
      budgetTotal: 30000,
      currency: "INR",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await saveTrip(trip);

    // Create a regional specialty dish
    const dish1: FoodPlannerRecord = {
      id: "food-dish-thukpa",
      tripId: "trip-food-ladakh",
      name: "Traditional Ladakhi Thukpa",
      type: "SPECIALTY_DISH",
      cuisine: "Ladakhi / Tibetan",
      location: "Old Leh Main Bazaar",
      mealSlot: "DINNER",
      priceLevel: 1,
      dietaryTags: ["VEG"],
      mustOrderDish: "Hand-pulled noodle soup with mountain herbs",
      status: "TO_TRY",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await saveFoodItem(dish1);

    const items = await getFoodItemsForTrip("trip-food-ladakh");
    assert.strictEqual(items.length, 1);
    assert.strictEqual(items[0].name, "Traditional Ladakhi Thukpa");
    assert.strictEqual(items[0].type, "SPECIALTY_DISH");
    assert.strictEqual(items[0].status, "TO_TRY");
    assert.deepStrictEqual(items[0].dietaryTags, ["VEG"]);

    // Toggle status to VISITED (Tasted)
    const updatedDish: FoodPlannerRecord = {
      ...items[0],
      status: "VISITED",
      rating: 5,
      reviewNotes: "Incredible rich broth; perfect after a cold ride over Chang La.",
    };
    await saveFoodItem(updatedDish);

    const reloaded = await getFoodItemsForTrip("trip-food-ladakh");
    assert.strictEqual(reloaded[0].status, "VISITED");
    assert.strictEqual(reloaded[0].rating, 5);
    assert.strictEqual(reloaded[0].reviewNotes, "Incredible rich broth; perfect after a cold ride over Chang La.");
  });

  test("2. Restaurant & Cafe Wishlist with Meal Slot & Must-Order Dish (REQ-FOD-02)", async () => {
    const trip: TripRecord = {
      id: "trip-food-manali",
      title: "Himachal Highland Trail",
      destination: "Old Manali, Himachal",
      startDate: "2026-06-10T00:00:00.000Z",
      status: "PLANNING",
      travelStyle: "BACKPACKING",
      budgetTotal: 25000,
      currency: "INR",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await saveTrip(trip);

    const cafe: FoodPlannerRecord = {
      id: "food-cafe-1947",
      tripId: "trip-food-manali",
      name: "Cafe 1947 Old Manali",
      type: "RESTAURANT",
      cuisine: "Italian & Continental",
      location: "Near Manalsu River Bridge, Old Manali",
      mealSlot: "CAFE_CHAI",
      priceLevel: 3,
      dietaryTags: ["VEG", "NON_VEG"],
      mustOrderDish: "Trout Pizza & Ginger Lemon Honey Tea",
      reviewNotes: "Riverside seating with live acoustic indie guitar music.",
      status: "TO_TRY",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await saveFoodItem(cafe);

    const dhaba: FoodPlannerRecord = {
      id: "food-dhaba-siddu",
      tripId: "trip-food-manali",
      name: "Chacha Pahadi Siddu Corner",
      type: "SPECIALTY_DISH",
      cuisine: "Pahadi",
      location: "Naggar Road junction",
      mealSlot: "BREAKFAST",
      priceLevel: 1,
      dietaryTags: ["VEG"],
      mustOrderDish: "Steamed Walnut & Ghee Siddu",
      status: "VISITED",
      rating: 4,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await saveFoodItem(dhaba);

    const items = await getFoodItemsForTrip("trip-food-manali");
    assert.strictEqual(items.length, 2);

    const cafeItem = items.find((i) => i.id === "food-cafe-1947");
    assert.ok(cafeItem);
    assert.strictEqual(cafeItem.mealSlot, "CAFE_CHAI");
    assert.strictEqual(cafeItem.priceLevel, 3);
    assert.strictEqual(cafeItem.mustOrderDish, "Trout Pizza & Ginger Lemon Honey Tea");

    // Verify maps navigation URL formatting
    const mapsQuery = `${cafeItem.name} ${cafeItem.location}`;
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery)}`;
    assert.ok(mapsUrl.includes("Cafe%201947%20Old%20Manali"));
  });

  test("3. Star Rating & Exploration Metrics Aggregation", async () => {
    const trip: TripRecord = {
      id: "trip-food-stats",
      title: "Rajasthan Food Trail",
      destination: "Jaipur, Rajasthan",
      startDate: "2026-11-05T00:00:00.000Z",
      status: "PLANNING",
      travelStyle: "ROADTRIP",
      budgetTotal: 40000,
      currency: "INR",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await saveTrip(trip);

    // Item 1: Visited, rated 5
    await saveFoodItem({
      id: "f-1",
      tripId: "trip-food-stats",
      name: "Dal Baati Churma at LMB",
      type: "RESTAURANT",
      mealSlot: "LUNCH",
      priceLevel: 3,
      dietaryTags: ["VEG"],
      status: "VISITED",
      rating: 5,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Item 2: Visited, rated 4
    await saveFoodItem({
      id: "f-2",
      tripId: "trip-food-stats",
      name: "Mathania Laal Maas",
      type: "SPECIALTY_DISH",
      mealSlot: "DINNER",
      priceLevel: 2,
      dietaryTags: ["NON_VEG"],
      status: "VISITED",
      rating: 4,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Item 3: To Try, unrated
    await saveFoodItem({
      id: "f-3",
      tripId: "trip-food-stats",
      name: "Lassiwala Special Malai Lassi",
      type: "SPECIALTY_DISH",
      mealSlot: "BREAKFAST",
      priceLevel: 1,
      dietaryTags: ["VEG"],
      status: "TO_TRY",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const items = await getFoodItemsForTrip("trip-food-stats");
    assert.strictEqual(items.length, 3);

    const visitedCount = items.filter((i) => i.status === "VISITED").length;
    assert.strictEqual(visitedCount, 2);

    const explorationPercentage = Math.round((visitedCount / items.length) * 100);
    assert.strictEqual(explorationPercentage, 67);

    const ratedItems = items.filter((i) => typeof i.rating === "number" && i.rating > 0);
    const avgRating = Number(
      (ratedItems.reduce((acc, curr) => acc + (curr.rating || 0), 0) / ratedItems.length).toFixed(1)
    );
    assert.strictEqual(avgRating, 4.5);
  });

  test("4. Delete Food Item and Cascade Erasure on Trip Deletion", async () => {
    const trip: TripRecord = {
      id: "trip-food-cascade",
      title: "South India Gastronomy",
      destination: "Kochi, Kerala",
      startDate: "2026-12-01T00:00:00.000Z",
      status: "PLANNING",
      travelStyle: "LEISURE",
      budgetTotal: 35000,
      currency: "INR",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await saveTrip(trip);

    await saveFoodItem({
      id: "food-appam",
      tripId: "trip-food-cascade",
      name: "Appam with Vegetable Stew",
      type: "SPECIALTY_DISH",
      mealSlot: "BREAKFAST",
      priceLevel: 1,
      dietaryTags: ["VEGAN"],
      status: "TO_TRY",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await saveFoodItem({
      id: "food-karimeen",
      tripId: "trip-food-cascade",
      name: "Karimeen Pollichathu",
      type: "SPECIALTY_DISH",
      mealSlot: "DINNER",
      priceLevel: 3,
      dietaryTags: ["NON_VEG"],
      status: "TO_TRY",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    let items = await getFoodItemsForTrip("trip-food-cascade");
    assert.strictEqual(items.length, 2);

    // Delete single food item
    await deleteFoodItem("food-appam");
    items = await getFoodItemsForTrip("trip-food-cascade");
    assert.strictEqual(items.length, 1);
    assert.strictEqual(items[0].id, "food-karimeen");

    // Perform cascade delete of the entire trip
    await deleteTripCascade("trip-food-cascade");

    items = await getFoodItemsForTrip("trip-food-cascade");
    assert.strictEqual(items.length, 0);
  });
});
