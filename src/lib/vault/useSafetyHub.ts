"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  SafetyContactRecord,
  SafetyRole,
  MedicalCardInfo,
  ContingencyPlan,
  TripRecord,
  ID,
} from "./types";
import {
  getSafetyContactsForTrip,
  saveSafetyContact,
  deleteSafetyContact,
  getMedicalCardForTrip,
  saveMedicalCard,
  getContingenciesForTrip,
  saveContingency,
  deleteContingency,
  getTrip,
  isIndexedDBAvailable,
} from "./storage";
import { notifyVaultChange } from "./useTripVault";

export const ALL_SAFETY_ROLES: SafetyRole[] = [
  "POLICE",
  "HOSPITAL",
  "MOUNTAIN_RESCUE",
  "PERSONAL_ICE",
  "MECHANIC",
  "EMBASSY",
  "HOTEL_STAFF",
  "OTHER",
];

export interface DefaultEmergencyHotline {
  name: string;
  role: SafetyRole;
  phone: string;
  address?: string;
  notes?: string;
}

export const NATIONAL_EMERGENCY_HOTLINES: DefaultEmergencyHotline[] = [
  {
    name: "National Unified Emergency SOS",
    role: "POLICE",
    phone: "112",
    notes: "All-in-one emergency response (Police, Fire, Ambulance)",
  },
  {
    name: "Ambulance & Medical Emergency",
    role: "HOSPITAL",
    phone: "108",
    notes: "National emergency ambulance response service",
  },
  {
    name: "National Highway Patrol & Roadside SOS",
    role: "POLICE",
    phone: "1033",
    notes: "NHAI 24x7 highway helpline for towing and breakdown recovery",
  },
  {
    name: "Disaster Management & Mountain Rescue (NDRF/SDRF)",
    role: "MOUNTAIN_RESCUE",
    phone: "1077",
    notes: "State & District disaster management control room",
  },
  {
    name: "Indian Tourist Helpline",
    role: "OTHER",
    phone: "1363",
    notes: "24x7 multi-lingual tourist assistance & guidance",
  },
];

export function useSafetyHub(tripId: string) {
  const [trip, setTrip] = useState<TripRecord | null>(null);
  const [contacts, setContacts] = useState<SafetyContactRecord[]>([]);
  const [medicalCard, setMedicalCard] = useState<MedicalCardInfo | null>(null);
  const [contingencies, setContingencies] = useState<ContingencyPlan[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!tripId || !isIndexedDBAvailable()) {
      setIsLoading(false);
      return;
    }

    try {
      setError(null);
      const [tripData, contactList, medCard, planList] = await Promise.all([
        getTrip(tripId),
        getSafetyContactsForTrip(tripId),
        getMedicalCardForTrip(tripId),
        getContingenciesForTrip(tripId),
      ]);

      setTrip(tripData);
      setContacts(contactList);
      setMedicalCard(medCard || tripData?.medicalCard || null);
      setContingencies(planList || tripData?.contingencies || []);
    } catch (err) {
      console.error("Failed loading safety data from vault:", err);
      setError("Unable to load emergency contacts and medical data.");
    } finally {
      setIsLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    let mounted = true;
    if (!tripId) return;

    (async () => {
      try {
        const [tripData, contactList, medCard, planList] = await Promise.all([
          getTrip(tripId),
          getSafetyContactsForTrip(tripId),
          getMedicalCardForTrip(tripId),
          getContingenciesForTrip(tripId),
        ]);
        if (mounted) {
          setTrip(tripData);
          setContacts(contactList);
          setMedicalCard(medCard || tripData?.medicalCard || null);
          setContingencies(planList || tripData?.contingencies || []);
        }
      } catch (err) {
        if (mounted) {
          console.error("Failed initial safety load:", err);
          setError("Unable to load safety vault.");
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    })();

    const handleVaultSync = () => {
      loadData();
    };

    window.addEventListener("life_atlas_vault_change", handleVaultSync);
    return () => {
      mounted = false;
      window.removeEventListener("life_atlas_vault_change", handleVaultSync);
    };
  }, [loadData, tripId]);

  // Derived metrics
  const emergencyContacts = useMemo(
    () => contacts.filter((c) => c.isEmergency),
    [contacts]
  );

  const personalICEContacts = useMemo(
    () => contacts.filter((c) => c.role === "PERSONAL_ICE"),
    [contacts]
  );

  // Action: Add Contact
  const addContact = useCallback(
    async (
      contact: Omit<SafetyContactRecord, "id" | "tripId" | "createdAt" | "updatedAt">
    ): Promise<SafetyContactRecord> => {
      const id = "saf_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
      const now = new Date().toISOString();

      const newRecord: SafetyContactRecord = {
        ...contact,
        id,
        tripId,
        createdAt: now,
        updatedAt: now,
      };

      const saved = await saveSafetyContact(newRecord);
      setContacts((prev) => [...prev, saved]);
      notifyVaultChange();
      return saved;
    },
    [tripId]
  );

  // Action: Update Contact
  const updateContact = useCallback(
    async (contact: SafetyContactRecord): Promise<SafetyContactRecord> => {
      const saved = await saveSafetyContact(contact);
      setContacts((prev) => prev.map((c) => (c.id === contact.id ? saved : c)));
      notifyVaultChange();
      return saved;
    },
    []
  );

  // Action: Remove Contact
  const removeContact = useCallback(
    async (id: ID): Promise<boolean> => {
      setContacts((prev) => prev.filter((c) => c.id !== id));
      const deleted = await deleteSafetyContact(id);
      notifyVaultChange();
      return deleted;
    },
    []
  );

  // Action: Save Medical Card
  const updateMedicalCard = useCallback(
    async (card: MedicalCardInfo): Promise<MedicalCardInfo> => {
      const saved = await saveMedicalCard(tripId, card);
      setMedicalCard(saved);
      notifyVaultChange();
      return saved;
    },
    [tripId]
  );

  // Action: Add Contingency Plan
  const addContingency = useCallback(
    async (
      plan: Omit<ContingencyPlan, "id" | "tripId" | "createdAt">
    ): Promise<ContingencyPlan> => {
      const id = "ctg_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
      const now = new Date().toISOString();

      const newPlan: ContingencyPlan = {
        ...plan,
        id,
        tripId,
        createdAt: now,
      };

      const saved = await saveContingency(tripId, newPlan);
      setContingencies((prev) => [...prev, saved]);
      notifyVaultChange();
      return saved;
    },
    [tripId]
  );

  // Action: Update Contingency Plan
  const updateContingency = useCallback(
    async (plan: ContingencyPlan): Promise<ContingencyPlan> => {
      const saved = await saveContingency(tripId, plan);
      setContingencies((prev) => prev.map((p) => (p.id === plan.id ? saved : p)));
      notifyVaultChange();
      return saved;
    },
    [tripId]
  );

  // Action: Remove Contingency Plan
  const removeContingency = useCallback(
    async (planId: ID): Promise<boolean> => {
      setContingencies((prev) => prev.filter((p) => p.id !== planId));
      const deleted = await deleteContingency(tripId, planId);
      notifyVaultChange();
      return deleted;
    },
    [tripId]
  );

  // Action: Seed Emergency Hotlines
  const seedEmergencyHotlines = useCallback(async (): Promise<number> => {
    const now = new Date().toISOString();
    const newItems: SafetyContactRecord[] = [];

    for (let i = 0; i < NATIONAL_EMERGENCY_HOTLINES.length; i++) {
      const hotline = NATIONAL_EMERGENCY_HOTLINES[i];
      const exists = contacts.some(
        (c) => c.phone.replace(/\D/g, "") === hotline.phone.replace(/\D/g, "")
      );

      if (!exists) {
        const id = `saf_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`;
        newItems.push({
          id,
          tripId,
          name: hotline.name,
          role: hotline.role,
          phone: hotline.phone,
          isEmergency: true,
          notes: hotline.notes,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    if (newItems.length > 0) {
      await Promise.all(newItems.map((c) => saveSafetyContact(c)));
      setContacts((prev) => [...prev, ...newItems]);
      notifyVaultChange();
    }

    return newItems.length;
  }, [contacts, tripId]);

  return {
    trip,
    contacts,
    emergencyContacts,
    personalICEContacts,
    medicalCard,
    contingencies,
    isLoading,
    error,
    addContact,
    updateContact,
    removeContact,
    updateMedicalCard,
    addContingency,
    updateContingency,
    removeContingency,
    seedEmergencyHotlines,
    refresh: loadData,
  };
}
