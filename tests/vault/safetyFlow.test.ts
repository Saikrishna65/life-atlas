import { test, describe, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";

import {
  saveTrip,
  getTrip,
  saveSafetyContact,
  getSafetyContactsForTrip,
  deleteSafetyContact,
  saveMedicalCard,
  getMedicalCardForTrip,
  saveContingency,
  getContingenciesForTrip,
  deleteContingency,
  deleteTripCascade,
  deleteVaultDB,
} from "../../src/lib/vault/storage";
import {
  TripRecord,
  SafetyContactRecord,
  MedicalCardInfo,
  ContingencyPlan,
} from "../../src/lib/vault/types";
import { NATIONAL_EMERGENCY_HOTLINES } from "../../src/lib/vault/useSafetyHub";

describe("Trip Vault Phase 11: Emergency, Medical & Plan B Contingencies Flow", () => {
  before(async () => {
    await deleteVaultDB();
  });

  beforeEach(async () => {
    await deleteVaultDB();
  });

  test("1. Emergency Services Directory & 1-Tap Phone Protocol (REQ-SAF-01)", async () => {
    const tripId = "trip-safety-ladakh";
    const trip: TripRecord = {
      id: tripId,
      title: "Ladakh High-Pass Motorcycle Run",
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

    // Save Police SOS contact
    const policeContact: SafetyContactRecord = {
      id: "saf-police-1",
      tripId,
      name: "Leh District Police Control Room",
      role: "POLICE",
      phone: "01982-252018",
      alternatePhone: "112",
      address: "Old Road, Leh, Ladakh 194101",
      isEmergency: true,
      notes: "Direct line for pass blockage & incident reports",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await saveSafetyContact(policeContact);

    // Save Mountain Rescue contact
    const rescueContact: SafetyContactRecord = {
      id: "saf-rescue-1",
      tripId,
      name: "ITBP / Mountain Search & Rescue",
      role: "MOUNTAIN_RESCUE",
      phone: "01982-252214",
      isEmergency: true,
      notes: "High-altitude extraction and avalanche emergency",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await saveSafetyContact(rescueContact);

    // Save Personal ICE Contact
    const iceContact: SafetyContactRecord = {
      id: "saf-ice-1",
      tripId,
      name: "Ananya Sharma (Spouse)",
      role: "PERSONAL_ICE",
      phone: "+91-9876543210",
      alternatePhone: "+91-9876543211",
      isEmergency: true,
      notes: "Primary next of kin, holds medical power of attorney",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await saveSafetyContact(iceContact);

    const contacts = await getSafetyContactsForTrip(tripId);
    assert.strictEqual(contacts.length, 3);

    // Verify filter for emergency contacts
    const emergencyOnly = contacts.filter((c) => c.isEmergency);
    assert.strictEqual(emergencyOnly.length, 3);

    // Verify dialer protocol URL generation
    const cleanDialNumber = policeContact.phone.replace(/[^0-9+]/g, "");
    assert.strictEqual(cleanDialNumber, "01982252018");
    const dialerUri = `tel:${cleanDialNumber}`;
    assert.strictEqual(dialerUri, "tel:01982252018");

    // Delete a contact
    await deleteSafetyContact("saf-rescue-1");
    const remaining = await getSafetyContactsForTrip(tripId);
    assert.strictEqual(remaining.length, 2);
  });

  test("2. Medical & Insurance Card Offline Record (REQ-SAF-02)", async () => {
    const tripId = "trip-safety-ladakh";
    const trip: TripRecord = {
      id: tripId,
      title: "Ladakh High-Pass Motorcycle Run",
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

    const sampleMedicalCard: MedicalCardInfo = {
      bloodGroup: "O+",
      allergies: ["Penicillin", "Sulfa Drugs", "Peanuts"],
      emergencyMedications: ["Diamox 250mg", "Asthalin Inhaler"],
      insuranceProvider: "HDFC ERGO Health Insurance",
      insurancePolicyNumber: "POL-77889912-EXP",
      cashlessHotline: "1800-2666-400",
      specialInstructions: "Asthma triggered at altitudes above 12,000 ft. Keep inhaler in jacket pocket.",
    };

    await saveMedicalCard(tripId, sampleMedicalCard);

    const storedCard = await getMedicalCardForTrip(tripId);
    assert.ok(storedCard);
    assert.strictEqual(storedCard.bloodGroup, "O+");
    assert.strictEqual(storedCard.allergies.length, 3);
    assert.ok(storedCard.allergies.includes("Penicillin"));
    assert.strictEqual(storedCard.insuranceProvider, "HDFC ERGO Health Insurance");
    assert.strictEqual(storedCard.cashlessHotline, "1800-2666-400");
  });

  test("3. Contingency / Plan B Matrix Storage & Retrieval (REQ-SAF-03)", async () => {
    const tripId = "trip-safety-ladakh";
    const trip: TripRecord = {
      id: tripId,
      title: "Ladakh High-Pass Motorcycle Run",
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

    const planB1: ContingencyPlan = {
      id: "ctg-khardungla-closure",
      tripId,
      title: "Khardung La Snowfall Closure Backup",
      triggerCondition: "Heavy snowfall or military convoy roadblock at South Pullu",
      backupPlan: "Divert to Nimmu / Alchi or delay crossing by 24h. Overnight at Stok Village Homestay.",
      alternateRouteNotes: "Check with BRO checkpoint at South Pullu (01982-252111) before 06:00 AM departure.",
      createdAt: new Date().toISOString(),
    };

    const planB2: ContingencyPlan = {
      id: "ctg-bike-breakdown",
      tripId,
      title: "Remote Pang Breakdown & Towing",
      triggerCondition: "Clutch wire snap or tire puncture between Sarchu and Pang",
      backupPlan: "Use spare clutch wire and heavy-duty zip ties from tank bag. Flag passing truck for transport to Upshi mechanic.",
      alternateRouteNotes: "Nearest permanent army transit camp is at Pang (Km 175).",
      createdAt: new Date().toISOString(),
    };

    await saveContingency(tripId, planB1);
    await saveContingency(tripId, planB2);

    const contingencies = await getContingenciesForTrip(tripId);
    assert.strictEqual(contingencies.length, 2);
    assert.strictEqual(contingencies[0].id, "ctg-khardungla-closure");
    assert.strictEqual(contingencies[1].id, "ctg-bike-breakdown");

    // Remove one contingency
    await deleteContingency(tripId, "ctg-khardungla-closure");
    const updated = await getContingenciesForTrip(tripId);
    assert.strictEqual(updated.length, 1);
    assert.strictEqual(updated[0].id, "ctg-bike-breakdown");
  });

  test("4. National Emergency Hotlines Preset Seeder", async () => {
    assert.ok(NATIONAL_EMERGENCY_HOTLINES.length >= 5);
    const sos = NATIONAL_EMERGENCY_HOTLINES.find((h) => h.phone === "112");
    assert.ok(sos);
    assert.strictEqual(sos.role, "POLICE");

    const highway = NATIONAL_EMERGENCY_HOTLINES.find((h) => h.phone === "1033");
    assert.ok(highway);
  });

  test("5. Cascade Deletion of Safety Contacts & Trip Metadata", async () => {
    const tripId = "trip-safety-cascade";
    const trip: TripRecord = {
      id: tripId,
      title: "Cascade Test Trip",
      destination: "Leh",
      startDate: "2026-07-01T00:00:00.000Z",
      status: "PLANNING",
      travelStyle: "MOTORCYCLE",
      budgetTotal: 20000,
      currency: "INR",
      medicalCard: {
        bloodGroup: "B+",
        allergies: [],
        emergencyMedications: [],
      },
      contingencies: [
        {
          id: "ctg-test-1",
          tripId,
          title: "Test Plan",
          triggerCondition: "Test Trigger",
          backupPlan: "Test Backup",
          createdAt: new Date().toISOString(),
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await saveTrip(trip);

    await saveSafetyContact({
      id: "saf-cascade-1",
      tripId,
      name: "Emergency Police",
      role: "POLICE",
      phone: "112",
      isEmergency: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const preContacts = await getSafetyContactsForTrip(tripId);
    assert.strictEqual(preContacts.length, 1);

    // Perform cascade delete
    await deleteTripCascade(tripId);

    const postContacts = await getSafetyContactsForTrip(tripId);
    assert.strictEqual(postContacts.length, 0);

    const postTrip = await getTrip(tripId);
    assert.strictEqual(postTrip, null);
  });
});
