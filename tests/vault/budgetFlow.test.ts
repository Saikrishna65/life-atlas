import { test, describe, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";

import {
  saveTrip,
  getTrip,
  saveExpense,
  getExpensesForTrip,
  getRefundableDepositsForTrip,
  deleteExpense,
  deleteTripCascade,
  deleteVaultDB,
} from "../../src/lib/vault/storage";
import {
  TripRecord,
} from "../../src/lib/vault/types";

describe("Trip Vault Phase 9: Budget Planning, Expenses & Deposit Tracker Flow", () => {
  before(async () => {
    await deleteVaultDB();
  });

  beforeEach(async () => {
    await deleteVaultDB();
  });

  test("1. Budget Allocation & Category Quotas (REQ-BDG-01)", async () => {
    const trip: TripRecord = {
      id: "trip-budget-ladakh",
      title: "Ladakh Motorcycle Expedition",
      destination: "Leh, Ladakh",
      startDate: "2026-07-20T00:00:00.000Z",
      status: "PLANNING",
      travelStyle: "MOTORCYCLE",
      budgetTotal: 50000,
      currency: "INR",
      categoryBudgets: {
        FUEL: 10000,
        ACCOMMODATION: 15000,
        FOOD: 12000,
        RENTAL: 8000,
        MISC: 5000,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await saveTrip(trip);

    const reloaded = await getTrip("trip-budget-ladakh");
    assert.ok(reloaded);
    assert.strictEqual(reloaded.budgetTotal, 50000);
    assert.ok(reloaded.categoryBudgets);
    assert.strictEqual(reloaded.categoryBudgets.FUEL, 10000);
    assert.strictEqual(reloaded.categoryBudgets.ACCOMMODATION, 15000);

    // Add fuel expense of 3,500
    await saveExpense({
      id: "exp-fuel-1",
      tripId: "trip-budget-ladakh",
      title: "Tandi Petrol Fill",
      amount: 3500,
      currency: "INR",
      category: "FUEL",
      paidBy: "Self",
      paymentMode: "CASH",
      date: new Date().toISOString(),
      isDeposit: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const expenses = await getExpensesForTrip("trip-budget-ladakh");
    assert.strictEqual(expenses.length, 1);

    const fuelSpent = expenses
      .filter((e) => e.category === "FUEL")
      .reduce((sum, e) => sum + e.amount, 0);
    assert.strictEqual(fuelSpent, 3500);

    const fuelAllocation = reloaded.categoryBudgets.FUEL || 0;
    const fuelPercent = Math.round((fuelSpent / fuelAllocation) * 100);
    assert.strictEqual(fuelPercent, 35);
  });

  test("2. Live Expense Logger with Payment Modes & Split Notes (REQ-BDG-02)", async () => {
    const trip: TripRecord = {
      id: "trip-expenses-manali",
      title: "Himachal Backpacking",
      destination: "Old Manali",
      startDate: "2026-06-12T00:00:00.000Z",
      status: "ACTIVE",
      travelStyle: "BACKPACKING",
      budgetTotal: 25000,
      currency: "INR",
      companions: ["Rohit", "Sneha"],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await saveTrip(trip);

    // Expense 1: Food via UPI
    await saveExpense({
      id: "exp-cafe-1947",
      tripId: "trip-expenses-manali",
      title: "Cafe 1947 Riverside Dinner",
      amount: 2400,
      currency: "INR",
      category: "FOOD",
      paidBy: "Self",
      paymentMode: "UPI",
      date: new Date().toISOString(),
      splitWith: ["Rohit", "Sneha"],
      isDeposit: false,
      notes: "Split 3 ways = 800 per person.",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Expense 2: Homestay via Card
    await saveExpense({
      id: "exp-homestay",
      tripId: "trip-expenses-manali",
      title: "Zostel Manali 2 Nights",
      amount: 3800,
      currency: "INR",
      category: "ACCOMMODATION",
      paidBy: "Rohit",
      paymentMode: "CARD",
      date: new Date().toISOString(),
      isDeposit: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const expenses = await getExpensesForTrip("trip-expenses-manali");
    assert.strictEqual(expenses.length, 2);

    const totalSpent = expenses.reduce((sum, e) => sum + e.amount, 0);
    assert.strictEqual(totalSpent, 6200);

    const remaining = trip.budgetTotal - totalSpent;
    assert.strictEqual(remaining, 18800);
  });

  test("3. Refundable Deposit Dashboard & Settlement Ledger (REQ-BDG-03)", async () => {
    const trip: TripRecord = {
      id: "trip-deposits-goa",
      title: "Goa Ride",
      destination: "Goa",
      startDate: "2026-12-15T00:00:00.000Z",
      status: "PLANNING",
      travelStyle: "MOTORCYCLE",
      budgetTotal: 30000,
      currency: "INR",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await saveTrip(trip);

    // Bike Security Deposit: PENDING
    await saveExpense({
      id: "exp-dep-bike",
      tripId: "trip-deposits-goa",
      title: "Royal Enfield Hunter Security Deposit",
      amount: 5000,
      currency: "INR",
      category: "RENTAL",
      paidBy: "Self",
      paymentMode: "UPI",
      date: new Date().toISOString(),
      isDeposit: true,
      depositRefundStatus: "PENDING",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Hotel Key Card Deposit: REFUNDED
    await saveExpense({
      id: "exp-dep-hotel",
      tripId: "trip-deposits-goa",
      title: "Resort Key Card Security Deposit",
      amount: 1000,
      currency: "INR",
      category: "ACCOMMODATION",
      paidBy: "Self",
      paymentMode: "CASH",
      date: new Date().toISOString(),
      isDeposit: true,
      depositRefundStatus: "REFUNDED",
      refundAmount: 1000,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const deposits = await getRefundableDepositsForTrip("trip-deposits-goa");
    assert.strictEqual(deposits.length, 2);

    const pendingRefund = deposits
      .filter((d) => d.depositRefundStatus === "PENDING")
      .reduce((sum, d) => sum + d.amount, 0);
    assert.strictEqual(pendingRefund, 5000);

    // Settle bike deposit with partial deduction (e.g. 500 helmet scratch deduction, 4500 refunded)
    const bikeDep = deposits.find((d) => d.id === "exp-dep-bike")!;
    bikeDep.depositRefundStatus = "REFUNDED";
    bikeDep.refundAmount = 4500;
    await saveExpense(bikeDep);

    const updatedDeposits = await getRefundableDepositsForTrip("trip-deposits-goa");
    const updatedPending = updatedDeposits
      .filter((d) => d.depositRefundStatus === "PENDING")
      .reduce((sum, d) => sum + d.amount, 0);
    assert.strictEqual(updatedPending, 0);

    const updatedBike = updatedDeposits.find((d) => d.id === "exp-dep-bike")!;
    assert.strictEqual(updatedBike.depositRefundStatus, "REFUNDED");
    assert.strictEqual(updatedBike.refundAmount, 4500);
  });

  test("4. Delete Expense & Cascade Erasure on Trip Deletion", async () => {
    const trip: TripRecord = {
      id: "trip-exp-delete",
      title: "Quick Weekend Getaway",
      destination: "Rishikesh",
      startDate: "2026-10-01T00:00:00.000Z",
      status: "PLANNING",
      travelStyle: "LEISURE",
      budgetTotal: 15000,
      currency: "INR",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await saveTrip(trip);

    await saveExpense({
      id: "exp-rafting",
      tripId: "trip-exp-delete",
      title: "White Water Rafting 16km",
      amount: 1800,
      currency: "INR",
      category: "ACTIVITIES",
      paidBy: "Self",
      paymentMode: "UPI",
      date: new Date().toISOString(),
      isDeposit: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    let expenses = await getExpensesForTrip("trip-exp-delete");
    assert.strictEqual(expenses.length, 1);

    // Delete single expense
    await deleteExpense("exp-rafting");
    expenses = await getExpensesForTrip("trip-exp-delete");
    assert.strictEqual(expenses.length, 0);

    // Recreate and verify cascade delete on trip deletion
    await saveExpense({
      id: "exp-camp",
      tripId: "trip-exp-delete",
      title: "Riverside Camping Stay",
      amount: 3200,
      currency: "INR",
      category: "ACCOMMODATION",
      paidBy: "Self",
      paymentMode: "CASH",
      date: new Date().toISOString(),
      isDeposit: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    expenses = await getExpensesForTrip("trip-exp-delete");
    assert.strictEqual(expenses.length, 1);

    await deleteTripCascade("trip-exp-delete");
    expenses = await getExpensesForTrip("trip-exp-delete");
    assert.strictEqual(expenses.length, 0);
  });
});
