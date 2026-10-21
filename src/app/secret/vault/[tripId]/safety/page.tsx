"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  PhoneCall,
  Phone,
  Plus,
  Trash2,
  Edit3,
  AlertTriangle,
  Lock,
  Search,
  X,
  ShieldAlert,
  Heart,
  Activity,
  Ambulance,
  Compass,
  FileText,
  MapPin,
  Sparkles,
  ShieldCheck,
  Check,
  ExternalLink,
} from "lucide-react";
import {
  useSafetyHub,
  ALL_SAFETY_ROLES,
} from "@/lib/vault/useSafetyHub";
import {
  SafetyRole,
  SafetyContactRecord,
  MedicalCardInfo,
  ContingencyPlan,
} from "@/lib/vault/types";
import { revokeSecretAccess } from "@/lib/deviceAuth";

const ROLE_META: Record<
  SafetyRole,
  { label: string; icon: React.ReactNode; color: string; badgeBg: string }
> = {
  POLICE: {
    label: "Police & Highway Patrol",
    icon: <ShieldAlert className="w-4 h-4 text-rose-400" />,
    color: "text-rose-400",
    badgeBg: "bg-rose-500/10 border-rose-500/20 text-rose-400",
  },
  HOSPITAL: {
    label: "Hospital & Medical SOS",
    icon: <Ambulance className="w-4 h-4 text-emerald-400" />,
    color: "text-emerald-400",
    badgeBg: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
  },
  MOUNTAIN_RESCUE: {
    label: "Mountain & Disaster Rescue",
    icon: <Compass className="w-4 h-4 text-amber-400" />,
    color: "text-amber-400",
    badgeBg: "bg-amber-500/10 border-amber-500/20 text-amber-400",
  },
  PERSONAL_ICE: {
    label: "In Case of Emergency (ICE)",
    icon: <Heart className="w-4 h-4 text-pink-400" />,
    color: "text-pink-400",
    badgeBg: "bg-pink-500/10 border-pink-500/20 text-pink-400",
  },
  MECHANIC: {
    label: "Mechanic & Recovery Towing",
    icon: <Activity className="w-4 h-4 text-cyan-400" />,
    color: "text-cyan-400",
    badgeBg: "bg-cyan-500/10 border-cyan-500/20 text-cyan-400",
  },
  HOTEL_STAFF: {
    label: "Hotel & Basecamp Manager",
    icon: <MapPin className="w-4 h-4 text-indigo-400" />,
    color: "text-indigo-400",
    badgeBg: "bg-indigo-500/10 border-indigo-500/20 text-indigo-400",
  },
  EMBASSY: {
    label: "Consulate / Embassy",
    icon: <FileText className="w-4 h-4 text-purple-400" />,
    color: "text-purple-400",
    badgeBg: "bg-purple-500/10 border-purple-500/20 text-purple-400",
  },
  OTHER: {
    label: "Tourist Helpline / Official",
    icon: <Phone className="w-4 h-4 text-zinc-400" />,
    color: "text-zinc-400",
    badgeBg: "bg-zinc-500/10 border-zinc-500/20 text-zinc-400",
  },
};

export default function SafetyHubPage() {
  const params = useParams();
  const router = useRouter();
  const tripId = typeof params?.tripId === "string" ? params.tripId : "";

  const {
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
  } = useSafetyHub(tripId);

  // Tab State: DIRECTORY | MEDICAL | CONTINGENCY
  const [activeTab, setActiveTab] = useState<"DIRECTORY" | "MEDICAL" | "CONTINGENCY">("DIRECTORY");
  const [roleFilter, setRoleFilter] = useState<SafetyRole | "ALL">("ALL");
  const [emergencyOnly, setEmergencyOnly] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Modals
  const [showAddContactModal, setShowAddContactModal] = useState<boolean>(false);
  const [showEditContactModal, setShowEditContactModal] = useState<boolean>(false);
  const [contactToEdit, setContactToEdit] = useState<SafetyContactRecord | null>(null);
  const [contactToDelete, setContactToDelete] = useState<SafetyContactRecord | null>(null);

  const [showEditMedicalModal, setShowEditMedicalModal] = useState<boolean>(false);
  const [showAddPlanModal, setShowAddPlanModal] = useState<boolean>(false);
  const [showEditPlanModal, setShowEditPlanModal] = useState<boolean>(false);
  const [planToEdit, setPlanToEdit] = useState<ContingencyPlan | null>(null);
  const [planToDelete, setPlanToDelete] = useState<ContingencyPlan | null>(null);

  const [seedSuccessMsg, setSeedSuccessMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Contact Form State
  const [cName, setCName] = useState("");
  const [cRole, setCRole] = useState<SafetyRole>("POLICE");
  const [cPhone, setCPhone] = useState("");
  const [cAltPhone, setCAltPhone] = useState("");
  const [cAddress, setCAddress] = useState("");
  const [cIsEmergency, setCIsEmergency] = useState(true);
  const [cNotes, setCNotes] = useState("");

  // Medical Card Form State
  const [mBloodGroup, setMBloodGroup] = useState("");
  const [mAllergies, setMAllergies] = useState("");
  const [mMedications, setMMedications] = useState("");
  const [mInsuranceProvider, setMInsuranceProvider] = useState("");
  const [mPolicyNumber, setMPolicyNumber] = useState("");
  const [mCashlessHotline, setMCashlessHotline] = useState("");
  const [mSpecialInstructions, setMSpecialInstructions] = useState("");

  // Contingency Plan Form State
  const [pTitle, setPTitle] = useState("");
  const [pTrigger, setPTrigger] = useState("");
  const [pBackup, setPBackup] = useState("");
  const [pRouteNotes, setPRouteNotes] = useState("");

  const handleLockVault = () => {
    revokeSecretAccess();
    router.push("/");
  };

  // Open Add Contact
  const handleOpenAddContact = () => {
    setCName("");
    setCRole("POLICE");
    setCPhone("");
    setCAltPhone("");
    setCAddress("");
    setCIsEmergency(true);
    setCNotes("");
    setShowAddContactModal(true);
  };

  // Open Edit Contact
  const handleOpenEditContact = (c: SafetyContactRecord) => {
    setContactToEdit(c);
    setCName(c.name);
    setCRole(c.role);
    setCPhone(c.phone);
    setCAltPhone(c.alternatePhone || "");
    setCAddress(c.address || "");
    setCIsEmergency(c.isEmergency);
    setCNotes(c.notes || "");
    setShowEditContactModal(true);
  };

  // Open Edit Medical Card
  const handleOpenEditMedical = () => {
    setMBloodGroup(medicalCard?.bloodGroup || "");
    setMAllergies(medicalCard?.allergies?.join(", ") || "");
    setMMedications(medicalCard?.emergencyMedications?.join(", ") || "");
    setMInsuranceProvider(medicalCard?.insuranceProvider || "");
    setMPolicyNumber(medicalCard?.insurancePolicyNumber || "");
    setMCashlessHotline(medicalCard?.cashlessHotline || "");
    setMSpecialInstructions(medicalCard?.specialInstructions || "");
    setShowEditMedicalModal(true);
  };

  // Open Add Contingency Plan
  const handleOpenAddPlan = () => {
    setPTitle("");
    setPTrigger("");
    setPBackup("");
    setPRouteNotes("");
    setShowAddPlanModal(true);
  };

  // Open Edit Contingency Plan
  const handleOpenEditPlan = (plan: ContingencyPlan) => {
    setPlanToEdit(plan);
    setPTitle(plan.title);
    setPTrigger(plan.triggerCondition);
    setPBackup(plan.backupPlan);
    setPRouteNotes(plan.alternateRouteNotes || "");
    setShowEditPlanModal(true);
  };

  // Contact Form Submit
  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cName.trim() || !cPhone.trim()) return;

    try {
      setIsSubmitting(true);
      if (showEditContactModal && contactToEdit) {
        await updateContact({
          ...contactToEdit,
          name: cName.trim(),
          role: cRole,
          phone: cPhone.trim(),
          alternatePhone: cAltPhone.trim() || undefined,
          address: cAddress.trim() || undefined,
          isEmergency: cIsEmergency,
          notes: cNotes.trim() || undefined,
        });
        setShowEditContactModal(false);
        setContactToEdit(null);
      } else {
        await addContact({
          name: cName.trim(),
          role: cRole,
          phone: cPhone.trim(),
          alternatePhone: cAltPhone.trim() || undefined,
          address: cAddress.trim() || undefined,
          isEmergency: cIsEmergency,
          notes: cNotes.trim() || undefined,
        });
        setShowAddContactModal(false);
      }
    } catch (err) {
      console.error("Failed to save contact:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Medical Card Submit
  const handleMedicalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      const parsedAllergies = mAllergies
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const parsedMeds = mMedications
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const card: MedicalCardInfo = {
        bloodGroup: mBloodGroup.trim().toUpperCase(),
        allergies: parsedAllergies,
        emergencyMedications: parsedMeds,
        insuranceProvider: mInsuranceProvider.trim() || undefined,
        insurancePolicyNumber: mPolicyNumber.trim() || undefined,
        cashlessHotline: mCashlessHotline.trim() || undefined,
        specialInstructions: mSpecialInstructions.trim() || undefined,
      };

      await updateMedicalCard(card);
      setShowEditMedicalModal(false);
    } catch (err) {
      console.error("Failed to save medical card:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Contingency Submit
  const handlePlanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pTitle.trim() || !pTrigger.trim() || !pBackup.trim()) return;

    try {
      setIsSubmitting(true);
      if (showEditPlanModal && planToEdit) {
        await updateContingency({
          ...planToEdit,
          title: pTitle.trim(),
          triggerCondition: pTrigger.trim(),
          backupPlan: pBackup.trim(),
          alternateRouteNotes: pRouteNotes.trim() || undefined,
        });
        setShowEditPlanModal(false);
        setPlanToEdit(null);
      } else {
        await addContingency({
          title: pTitle.trim(),
          triggerCondition: pTrigger.trim(),
          backupPlan: pBackup.trim(),
          alternateRouteNotes: pRouteNotes.trim() || undefined,
        });
        setShowAddPlanModal(false);
      }
    } catch (err) {
      console.error("Failed to save contingency plan:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Seed Hotlines
  const handleSeedHotlines = async () => {
    try {
      const count = await seedEmergencyHotlines();
      setSeedSuccessMsg(`Imported ${count} standard emergency helplines.`);
      setTimeout(() => setSeedSuccessMsg(null), 2500);
    } catch (err) {
      console.error("Failed seeding emergency hotlines:", err);
    }
  };

  // Clean phone dialer URI (REQ-SAF-01)
  const getDialerUri = (phone: string) => {
    const cleanNumber = phone.replace(/[^0-9+]/g, "");
    return `tel:${cleanNumber}`;
  };

  // Filtered contacts
  const filteredContacts = contacts.filter((c) => {
    if (roleFilter !== "ALL" && c.role !== roleFilter) return false;
    if (emergencyOnly && !c.isEmergency) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = c.name.toLowerCase().includes(q);
      const matchPhone = c.phone.toLowerCase().includes(q);
      const matchNotes = c.notes?.toLowerCase().includes(q);
      return matchName || matchPhone || matchNotes;
    }
    return true;
  });

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto py-24 text-center text-xs font-mono text-muted-foreground flex items-center justify-center gap-2">
        <div className="w-4 h-4 rounded-full border border-muted border-t-rose-500 animate-spin" />
        <span>Loading safety & emergency protocols...</span>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-24">
      {/* 1. Header Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-muted pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground mb-1">
            <Link
              href={`/secret/vault/${tripId}`}
              className="hover:text-foreground flex items-center gap-1 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{trip?.title || "Expedition"}</span>
            </Link>
            <span>/</span>
            <span className="text-rose-400">Pillar 10</span>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl text-foreground font-normal tracking-tight">
            Safety, Medical & Plan B Contingencies
          </h1>
          <p className="font-body text-xs text-muted-foreground mt-0.5">
            100% offline emergency protocols: 1-tap rescue dialer, medical card, and Plan B backup matrix.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleLockVault}
            className="p-2 rounded-xl bg-background border border-muted text-muted-foreground hover:text-foreground transition-colors"
            title="Lock Vault"
          >
            <Lock className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2 font-mono">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 2. RAPID SOS EMERGENCY RIBBON (REQ-SAF-01) */}
      <div className="p-4 sm:p-5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-foreground space-y-3 shadow-soft">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
              <ShieldAlert className="w-5 h-5 text-rose-400" />
            </div>
            <div>
              <h3 className="font-sans font-semibold text-sm text-foreground">
                Rapid Emergency Hotline Dialers
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Instant 1-tap call triggers pre-filling your device&apos;s native telephone dialer.
              </p>
            </div>
          </div>

          <button
            onClick={handleSeedHotlines}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-background border border-rose-500/30 hover:border-rose-400 text-xs font-sans text-foreground transition-colors shrink-0"
            title="Seed standard Indian emergency numbers"
          >
            <Sparkles className="w-3.5 h-3.5 text-rose-400" />
            <span>Seed Standard SOS</span>
          </button>
        </div>

        {seedSuccessMsg && (
          <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono flex items-center gap-2">
            <Check className="w-3.5 h-3.5" />
            <span>{seedSuccessMsg}</span>
          </div>
        )}

        {/* Quick Dial Chips */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1 border-t border-rose-500/20">
          <a
            href="tel:112"
            className="flex items-center justify-between p-3 rounded-xl bg-background border border-rose-500/40 hover:bg-rose-500/10 transition-all group"
          >
            <div>
              <span className="text-[10px] font-mono uppercase text-muted-foreground block">
                Police / Unified
              </span>
              <span className="text-sm font-mono font-bold text-rose-400 group-hover:underline">
                112
              </span>
            </div>
            <PhoneCall className="w-4 h-4 text-rose-400 shrink-0" />
          </a>

          <a
            href="tel:108"
            className="flex items-center justify-between p-3 rounded-xl bg-background border border-rose-500/40 hover:bg-rose-500/10 transition-all group"
          >
            <div>
              <span className="text-[10px] font-mono uppercase text-muted-foreground block">
                Ambulance Medical
              </span>
              <span className="text-sm font-mono font-bold text-emerald-400 group-hover:underline">
                108
              </span>
            </div>
            <PhoneCall className="w-4 h-4 text-emerald-400 shrink-0" />
          </a>

          <a
            href="tel:1033"
            className="flex items-center justify-between p-3 rounded-xl bg-background border border-rose-500/40 hover:bg-rose-500/10 transition-all group"
          >
            <div>
              <span className="text-[10px] font-mono uppercase text-muted-foreground block">
                Highway Breakdown
              </span>
              <span className="text-sm font-mono font-bold text-cyan-400 group-hover:underline">
                1033
              </span>
            </div>
            <PhoneCall className="w-4 h-4 text-cyan-400 shrink-0" />
          </a>

          {personalICEContacts.length > 0 ? (
            <a
              href={getDialerUri(personalICEContacts[0].phone)}
              className="flex items-center justify-between p-3 rounded-xl bg-background border border-rose-500/40 hover:bg-rose-500/10 transition-all group"
            >
              <div className="min-w-0 pr-2">
                <span className="text-[10px] font-mono uppercase text-muted-foreground block truncate">
                  ICE: {personalICEContacts[0].name.split(" ")[0]}
                </span>
                <span className="text-sm font-mono font-bold text-pink-400 group-hover:underline block truncate">
                  {personalICEContacts[0].phone}
                </span>
              </div>
              <Heart className="w-4 h-4 text-pink-400 shrink-0" />
            </a>
          ) : (
            <button
              onClick={handleOpenAddContact}
              className="flex items-center justify-between p-3 rounded-xl bg-background border border-dashed border-rose-500/40 hover:bg-rose-500/10 text-muted-foreground hover:text-foreground transition-all text-left"
            >
              <div>
                <span className="text-[10px] font-mono uppercase text-muted-foreground block">
                  Next of Kin
                </span>
                <span className="text-xs font-sans text-rose-300">
                  + Add Personal ICE
                </span>
              </div>
              <Plus className="w-4 h-4 text-rose-400 shrink-0" />
            </button>
          )}
        </div>
      </div>

      {/* 3. Section Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-muted pb-2">
        <button
          onClick={() => setActiveTab("DIRECTORY")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-sans transition-all ${
            activeTab === "DIRECTORY"
              ? "bg-rose-500/20 border border-rose-500/40 text-rose-300 font-semibold"
              : "bg-surface border border-muted text-muted-foreground hover:text-foreground"
          }`}
        >
          <PhoneCall className="w-3.5 h-3.5" />
          <span>Emergency Directory ({contacts.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("MEDICAL")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-sans transition-all ${
            activeTab === "MEDICAL"
              ? "bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-semibold"
              : "bg-surface border border-muted text-muted-foreground hover:text-foreground"
          }`}
        >
          <Heart className="w-3.5 h-3.5" />
          <span>Medical & Insurance Card</span>
          {medicalCard?.bloodGroup && (
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-md bg-rose-500/20 text-rose-300 border border-rose-500/30">
              {medicalCard.bloodGroup}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("CONTINGENCY")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-sans transition-all ${
            activeTab === "CONTINGENCY"
              ? "bg-amber-500/20 border border-amber-500/40 text-amber-300 font-semibold"
              : "bg-surface border border-muted text-muted-foreground hover:text-foreground"
          }`}
        >
          <Compass className="w-3.5 h-3.5" />
          <span>Plan B Contingencies ({contingencies.length})</span>
        </button>
      </div>

      {/* TAB 1: EMERGENCY SERVICES DIRECTORY (REQ-SAF-01) */}
      {activeTab === "DIRECTORY" && (
        <div className="space-y-4">
          {/* Controls: Search, Filter & Add */}
          <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search emergency services, hospitals, mechanics..."
                className="w-full pl-9 pr-8 py-2 rounded-xl bg-background border border-muted text-xs font-sans text-foreground placeholder:text-muted-foreground/60 focus:outline-hidden focus:border-rose-500/50"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setEmergencyOnly(!emergencyOnly)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-sans transition-colors ${
                  emergencyOnly
                    ? "bg-rose-500/20 border-rose-500/40 text-rose-300 font-medium"
                    : "bg-background border-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                <span>Critical Only ({emergencyContacts.length})</span>
              </button>

              <button
                onClick={handleOpenAddContact}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-semibold text-xs transition-colors shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Contact</span>
              </button>
            </div>
          </div>

          {/* Role Filter Badges */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
            <button
              onClick={() => setRoleFilter("ALL")}
              className={`px-3 py-1.5 rounded-xl text-xs font-sans whitespace-nowrap transition-all ${
                roleFilter === "ALL"
                  ? "bg-rose-500/20 border border-rose-500/40 text-rose-300 font-semibold"
                  : "bg-surface border border-muted text-muted-foreground hover:text-foreground hover:bg-surface-hover"
              }`}
            >
              All Contacts ({contacts.length})
            </button>
            {ALL_SAFETY_ROLES.map((r) => {
              const meta = ROLE_META[r];
              const count = contacts.filter((c) => c.role === r).length;
              return (
                <button
                  key={r}
                  onClick={() => setRoleFilter(r)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-sans whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 ${
                    roleFilter === r
                      ? `${meta.badgeBg} border font-semibold`
                      : "bg-surface border border-muted text-muted-foreground hover:text-foreground hover:bg-surface-hover"
                  }`}
                >
                  {meta.icon}
                  <span>{meta.label}</span>
                  <span className="text-[10px] font-mono opacity-80">({count})</span>
                </button>
              );
            })}
          </div>

          {/* Contacts Grid */}
          {filteredContacts.length === 0 ? (
            <div className="p-10 rounded-2xl bg-surface/40 border border-muted text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-muted/30 border border-muted flex items-center justify-center mx-auto text-muted-foreground">
                <PhoneCall className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-display text-lg text-foreground font-normal">
                  No Safety Contacts Found
                </h3>
                <p className="font-body text-xs text-muted-foreground max-w-sm mx-auto mt-1">
                  Ensure you save district police, mountain rescue stations, hospital hotlines, and trusted local mechanics.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                <button
                  onClick={handleOpenAddContact}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-semibold text-xs transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add First Contact</span>
                </button>
                <button
                  onClick={handleSeedHotlines}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-background border border-muted text-xs font-sans text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5 text-rose-400" />
                  <span>Seed Standard SOS Numbers</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {filteredContacts.map((contact) => {
                const meta = ROLE_META[contact.role] || ROLE_META.OTHER;
                return (
                  <div
                    key={contact.id}
                    className="p-4 rounded-2xl bg-surface border border-muted hover:border-muted-foreground/30 transition-all flex flex-col justify-between gap-3 shadow-xs"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-mono px-2 py-0.5 rounded-md border flex items-center gap-1 shrink-0 ${meta.badgeBg}`}>
                            {meta.icon}
                            <span>{meta.label}</span>
                          </span>
                          {contact.isEmergency && (
                            <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-md bg-rose-500/20 text-rose-300 border border-rose-500/30">
                              SOS
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleOpenEditContact(contact)}
                            className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-background transition-colors"
                            title="Edit contact"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setContactToDelete(contact)}
                            className="p-1 rounded-lg text-muted-foreground hover:text-rose-400 hover:bg-background transition-colors"
                            title="Delete contact"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <h4 className="font-display text-base text-foreground font-normal mt-2">
                        {contact.name}
                      </h4>

                      {contact.notes && (
                        <p className="text-xs text-muted-foreground font-body mt-0.5 line-clamp-2">
                          {contact.notes}
                        </p>
                      )}

                      {contact.address && (
                        <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-1.5 font-sans">
                          <MapPin className="w-3 h-3 text-muted-foreground shrink-0" />
                          <span className="truncate">{contact.address}</span>
                        </div>
                      )}
                    </div>

                    {/* Bottom Action: 1-Tap Dialer Protocol (REQ-SAF-01) */}
                    <div className="pt-2 border-t border-muted/60 flex items-center justify-between gap-2">
                      <div className="font-mono text-xs">
                        <span className="text-foreground font-semibold">{contact.phone}</span>
                        {contact.alternatePhone && (
                          <span className="text-muted-foreground text-[10px] ml-1.5">
                            (Alt: {contact.alternatePhone})
                          </span>
                        )}
                      </div>

                      <a
                        href={getDialerUri(contact.phone)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-semibold font-sans transition-colors active:scale-95 shrink-0"
                      >
                        <PhoneCall className="w-3.5 h-3.5 text-rose-400" />
                        <span>Call</span>
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: MEDICAL & INSURANCE CARD (REQ-SAF-02) */}
      {activeTab === "MEDICAL" && (
        <div className="space-y-4">
          <div className="p-5 sm:p-6 rounded-3xl bg-surface border border-muted space-y-6 shadow-soft">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-muted pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <Activity className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-display text-xl text-foreground font-normal">
                    Expedition Emergency Medical Dossier
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Crucial offline health & insurance profile readable by emergency responders without internet access.
                  </p>
                </div>
              </div>

              <button
                onClick={handleOpenEditMedical}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-xs transition-colors shrink-0 shadow-xs"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>{medicalCard?.bloodGroup ? "Edit Medical Card" : "Setup Medical Card"}</span>
              </button>
            </div>

            {medicalCard?.bloodGroup ? (
              <div className="space-y-5">
                {/* Blood Group Banner */}
                <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-mono uppercase text-muted-foreground tracking-wider block">
                      Blood Group
                    </span>
                    <span className="text-3xl font-display font-bold text-rose-400 mt-0.5 block">
                      {medicalCard.bloodGroup}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-mono uppercase text-muted-foreground tracking-wider block">
                      Offline Verification
                    </span>
                    <span className="text-xs font-mono text-emerald-400 flex items-center gap-1 justify-end mt-0.5">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Certified In Vault</span>
                    </span>
                  </div>
                </div>

                {/* Medical Specs Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Allergies */}
                  <div className="p-4 rounded-2xl bg-background border border-muted space-y-2">
                    <span className="text-xs font-mono uppercase text-muted-foreground tracking-wider flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                      <span>Known Allergies</span>
                    </span>
                    {medicalCard.allergies && medicalCard.allergies.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {medicalCard.allergies.map((allergy, idx) => (
                          <span
                            key={idx}
                            className="px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/20 text-xs font-medium"
                          >
                            {allergy}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground font-body">
                        No known drug or food allergies recorded.
                      </p>
                    )}
                  </div>

                  {/* Emergency Medications */}
                  <div className="p-4 rounded-2xl bg-background border border-muted space-y-2">
                    <span className="text-xs font-mono uppercase text-muted-foreground tracking-wider flex items-center gap-1.5">
                      <Heart className="w-3.5 h-3.5 text-rose-400" />
                      <span>Emergency Medications Carried</span>
                    </span>
                    {medicalCard.emergencyMedications && medicalCard.emergencyMedications.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {medicalCard.emergencyMedications.map((med, idx) => (
                          <span
                            key={idx}
                            className="px-2.5 py-1 rounded-lg bg-rose-500/10 text-rose-300 border border-rose-500/20 text-xs font-medium"
                          >
                            {med}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground font-body">
                        No emergency medications listed.
                      </p>
                    )}
                  </div>
                </div>

                {/* Insurance Policy Section */}
                <div className="p-4 rounded-2xl bg-background border border-muted space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono uppercase text-muted-foreground tracking-wider flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Travel & Health Insurance Policy</span>
                    </span>
                    {medicalCard.cashlessHotline && (
                      <a
                        href={getDialerUri(medicalCard.cashlessHotline)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-medium hover:bg-indigo-500/20"
                      >
                        <PhoneCall className="w-3 h-3" />
                        <span>Call Cashless TPA</span>
                      </a>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                    <div>
                      <span className="text-[10px] font-mono text-muted-foreground block">
                        Insurance Provider
                      </span>
                      <span className="text-xs font-sans font-semibold text-foreground">
                        {medicalCard.insuranceProvider || "Not Specified"}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] font-mono text-muted-foreground block">
                        Policy Number
                      </span>
                      <span className="text-xs font-mono font-semibold text-foreground">
                        {medicalCard.insurancePolicyNumber || "Not Specified"}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] font-mono text-muted-foreground block">
                        24x7 Cashless Helpline
                      </span>
                      <span className="text-xs font-mono text-indigo-400">
                        {medicalCard.cashlessHotline || "Not Specified"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Special Instructions */}
                {medicalCard.specialInstructions && (
                  <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 space-y-1">
                    <span className="text-xs font-mono uppercase text-amber-400 tracking-wider block">
                      Emergency Responder Directives
                    </span>
                    <p className="text-xs font-body text-foreground leading-relaxed">
                      {medicalCard.specialInstructions}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-8 text-center space-y-3">
                <Heart className="w-10 h-10 text-muted-foreground mx-auto" />
                <h4 className="font-display text-base text-foreground font-normal">
                  Medical Card Not Configured
                </h4>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Record your blood group, life-critical allergies, high-altitude prescriptions, and cashless health insurance policy before entering remote zones.
                </p>
                <button
                  onClick={handleOpenEditMedical}
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-xs transition-colors"
                >
                  Configure Medical Card Now
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: PLAN B CONTINGENCY MATRIX (REQ-SAF-03) */}
      {activeTab === "CONTINGENCY" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display text-lg text-foreground font-normal">
                Expedition Contingency Protocols
              </h3>
              <p className="text-xs text-muted-foreground">
                Documented Plan B scenarios for mountain pass closures, landslides, severe weather, or transport cancellations.
              </p>
            </div>

            <button
              onClick={handleOpenAddPlan}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs transition-colors shrink-0 shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Plan B</span>
            </button>
          </div>

          {contingencies.length === 0 ? (
            <div className="p-10 rounded-2xl bg-surface/40 border border-muted text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-muted/30 border border-muted flex items-center justify-center mx-auto text-muted-foreground">
                <Compass className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-display text-lg text-foreground font-normal">
                  No Contingencies Documented
                </h3>
                <p className="font-body text-xs text-muted-foreground max-w-sm mx-auto mt-1">
                  High-altitude expeditions require contingency protocols for pass closures, weather delays, and remote mechanical breakdowns.
                </p>
              </div>
              <button
                onClick={handleOpenAddPlan}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs transition-colors"
              >
                Create First Plan B
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {contingencies.map((plan) => (
                <div
                  key={plan.id}
                  className="p-5 rounded-2xl bg-surface border border-muted hover:border-amber-500/40 transition-all space-y-3.5 shadow-xs"
                >
                  <div className="flex items-start justify-between gap-3 border-b border-muted/60 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 shrink-0">
                        <Compass className="w-4 h-4" />
                      </div>
                      <h4 className="font-display text-base text-foreground font-normal">
                        {plan.title}
                      </h4>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleOpenEditPlan(plan)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-background transition-colors"
                        title="Edit plan"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setPlanToDelete(plan)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-400 hover:bg-background transition-colors"
                        title="Delete plan"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Trigger Condition */}
                  <div className="p-3 rounded-xl bg-background/80 border border-muted space-y-1">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400 font-bold block flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 text-amber-400" />
                      <span>Trigger Condition (When to Activate):</span>
                    </span>
                    <p className="text-xs font-sans text-foreground">
                      {plan.triggerCondition}
                    </p>
                  </div>

                  {/* Action Plan */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 font-bold block flex items-center gap-1">
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span>Backup Action Protocol:</span>
                    </span>
                    <p className="text-xs font-body text-foreground leading-relaxed pl-1">
                      {plan.backupPlan}
                    </p>
                  </div>

                  {/* Alternate Route Notes */}
                  {plan.alternateRouteNotes && (
                    <div className="p-2.5 rounded-xl bg-background/50 border border-muted/60 text-[11px] font-mono text-muted-foreground flex items-start gap-1.5">
                      <ExternalLink className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                      <span>{plan.alternateRouteNotes}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: ADD / EDIT CONTACT (REQ-SAF-01) */}
      {(showAddContactModal || showEditContactModal) && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-3xl bg-surface border border-muted p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-muted pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
                  <PhoneCall className="w-5 h-5" />
                </div>
                <h3 className="font-display text-xl text-foreground font-normal">
                  {showEditContactModal ? "Edit Safety Contact" : "Add Safety Contact"}
                </h3>
              </div>
              <button
                onClick={() => {
                  setShowAddContactModal(false);
                  setShowEditContactModal(false);
                  setContactToEdit(null);
                }}
                className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-background transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleContactSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground block mb-1">
                  Contact or Station Name *
                </label>
                <input
                  type="text"
                  required
                  value={cName}
                  onChange={(e) => setCName(e.target.value)}
                  placeholder="e.g. Leh Police HQ, Dr. Stanzin (SNM Hospital)"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-muted text-sm font-sans text-foreground focus:outline-hidden focus:border-rose-500/50"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground block mb-1">
                    Service Role
                  </label>
                  <select
                    value={cRole}
                    onChange={(e) => setCRole(e.target.value as SafetyRole)}
                    className="w-full px-3 py-2 rounded-xl bg-background border border-muted text-xs font-sans text-foreground focus:outline-hidden focus:border-rose-500/50"
                  >
                    {ALL_SAFETY_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_META[r].label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground block mb-1">
                    Primary Phone Number *
                  </label>
                  <input
                    type="tel"
                    required
                    value={cPhone}
                    onChange={(e) => setCPhone(e.target.value)}
                    placeholder="e.g. 112, +91-9876543210"
                    className="w-full px-3 py-2 rounded-xl bg-background border border-muted text-xs font-mono text-foreground focus:outline-hidden focus:border-rose-500/50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground block mb-1">
                    Alternate Phone (Optional)
                  </label>
                  <input
                    type="tel"
                    value={cAltPhone}
                    onChange={(e) => setCAltPhone(e.target.value)}
                    placeholder="e.g. 01982-252018"
                    className="w-full px-3 py-2 rounded-xl bg-background border border-muted text-xs font-mono text-foreground focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground block mb-1">
                    Station / Office Address
                  </label>
                  <input
                    type="text"
                    value={cAddress}
                    onChange={(e) => setCAddress(e.target.value)}
                    placeholder="e.g. Main Bazaar, Keylong"
                    className="w-full px-3 py-2 rounded-xl bg-background border border-muted text-xs font-sans text-foreground focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Emergency Switch */}
              <div
                className="p-3.5 rounded-2xl bg-background border border-muted flex items-start gap-3 cursor-pointer select-none"
                onClick={() => setCIsEmergency(!cIsEmergency)}
              >
                <input
                  type="checkbox"
                  checked={cIsEmergency}
                  onChange={(e) => setCIsEmergency(e.target.checked)}
                  className="mt-0.5 rounded border-muted text-rose-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                />
                <div className="text-xs">
                  <span className="font-semibold text-foreground flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                    <span>Emergency SOS Priority Contact</span>
                  </span>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Pin this contact directly into the Rapid Emergency SOS top ribbon.
                  </p>
                </div>
              </div>

              <div>
                <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground block mb-1">
                  Notes / Operating Hours
                </label>
                <input
                  type="text"
                  value={cNotes}
                  onChange={(e) => setCNotes(e.target.value)}
                  placeholder="e.g. Open 24x7, English & Hindi speaking operator"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-muted text-xs font-sans text-foreground focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-muted">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddContactModal(false);
                    setShowEditContactModal(false);
                    setContactToEdit(null);
                  }}
                  className="px-4 py-2 rounded-xl border border-muted text-xs font-sans text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !cName.trim() || !cPhone.trim()}
                  className="px-5 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-semibold text-xs transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? "Saving..." : "Save Contact"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: EDIT MEDICAL CARD (REQ-SAF-02) */}
      {showEditMedicalModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-3xl bg-surface border border-muted p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-muted pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <Heart className="w-5 h-5" />
                </div>
                <h3 className="font-display text-xl text-foreground font-normal">
                  Configure Medical Card
                </h3>
              </div>
              <button
                onClick={() => setShowEditMedicalModal(false)}
                className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-background transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleMedicalSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground block mb-1">
                  Blood Group (e.g. O+, B+, A+, AB-) *
                </label>
                <input
                  type="text"
                  required
                  value={mBloodGroup}
                  onChange={(e) => setMBloodGroup(e.target.value)}
                  placeholder="e.g. O+, B+, A-, AB+"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-muted text-sm font-mono font-bold text-foreground focus:outline-hidden focus:border-emerald-500/50"
                />
              </div>

              <div>
                <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground block mb-1">
                  Known Drug & Food Allergies (Comma separated)
                </label>
                <input
                  type="text"
                  value={mAllergies}
                  onChange={(e) => setMAllergies(e.target.value)}
                  placeholder="e.g. Penicillin, Sulfa, Peanuts"
                  className="w-full px-3.5 py-2 rounded-xl bg-background border border-muted text-xs font-sans text-foreground focus:outline-hidden"
                />
              </div>

              <div>
                <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground block mb-1">
                  Emergency Medications Carried (Comma separated)
                </label>
                <input
                  type="text"
                  value={mMedications}
                  onChange={(e) => setMMedications(e.target.value)}
                  placeholder="e.g. Diamox 250mg, Asthalin Inhaler, EpiPen"
                  className="w-full px-3.5 py-2 rounded-xl bg-background border border-muted text-xs font-sans text-foreground focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground block mb-1">
                    Insurance Provider
                  </label>
                  <input
                    type="text"
                    value={mInsuranceProvider}
                    onChange={(e) => setMInsuranceProvider(e.target.value)}
                    placeholder="e.g. HDFC ERGO, Star Health"
                    className="w-full px-3 py-2 rounded-xl bg-background border border-muted text-xs font-sans text-foreground focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground block mb-1">
                    Policy Number
                  </label>
                  <input
                    type="text"
                    value={mPolicyNumber}
                    onChange={(e) => setMPolicyNumber(e.target.value)}
                    placeholder="e.g. POL-9923841"
                    className="w-full px-3 py-2 rounded-xl bg-background border border-muted text-xs font-mono text-foreground focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground block mb-1">
                  24x7 Cashless Emergency Hotline
                </label>
                <input
                  type="tel"
                  value={mCashlessHotline}
                  onChange={(e) => setMCashlessHotline(e.target.value)}
                  placeholder="e.g. 1800-2666-400"
                  className="w-full px-3 py-2 rounded-xl bg-background border border-muted text-xs font-mono text-foreground focus:outline-hidden"
                />
              </div>

              <div>
                <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground block mb-1">
                  Special Instructions / High Altitude Notes
                </label>
                <textarea
                  rows={2}
                  value={mSpecialInstructions}
                  onChange={(e) => setMSpecialInstructions(e.target.value)}
                  placeholder="e.g. Carrier has mild asthma at >10,000 ft. Inhaler kept in jacket front pocket."
                  className="w-full px-3.5 py-2 rounded-xl bg-background border border-muted text-xs font-sans text-foreground focus:outline-hidden resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-muted">
                <button
                  type="button"
                  onClick={() => setShowEditMedicalModal(false)}
                  className="px-4 py-2 rounded-xl border border-muted text-xs font-sans text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !mBloodGroup.trim()}
                  className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-xs transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? "Saving..." : "Save Medical Dossier"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: ADD / EDIT CONTINGENCY PLAN (REQ-SAF-03) */}
      {(showAddPlanModal || showEditPlanModal) && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-3xl bg-surface border border-muted p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-muted pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                  <Compass className="w-5 h-5" />
                </div>
                <h3 className="font-display text-xl text-foreground font-normal">
                  {showEditPlanModal ? "Edit Contingency Protocol" : "Add Plan B Protocol"}
                </h3>
              </div>
              <button
                onClick={() => {
                  setShowAddPlanModal(false);
                  setShowEditPlanModal(false);
                  setPlanToEdit(null);
                }}
                className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-background transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handlePlanSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground block mb-1">
                  Contingency Scenario Title *
                </label>
                <input
                  type="text"
                  required
                  value={pTitle}
                  onChange={(e) => setPTitle(e.target.value)}
                  placeholder="e.g. Rohtang Pass Landslide / Atal Tunnel Closure"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-muted text-sm font-sans text-foreground focus:outline-hidden focus:border-amber-500/50"
                />
              </div>

              <div>
                <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground block mb-1">
                  Trigger Condition (When to execute Plan B) *
                </label>
                <textarea
                  rows={2}
                  required
                  value={pTrigger}
                  onChange={(e) => setPTrigger(e.target.value)}
                  placeholder="e.g. Snowfall exceeding 1 foot or BRO military checkpoint halts civilian transit."
                  className="w-full px-3.5 py-2 rounded-xl bg-background border border-muted text-xs font-sans text-foreground focus:outline-hidden resize-none"
                />
              </div>

              <div>
                <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground block mb-1">
                  Backup Action Plan *
                </label>
                <textarea
                  rows={3}
                  required
                  value={pBackup}
                  onChange={(e) => setPBackup(e.target.value)}
                  placeholder="e.g. Divert to Keylong; check into Hotel Tashi Yangphel; verify BRO morning bulletin at 06:00."
                  className="w-full px-3.5 py-2 rounded-xl bg-background border border-muted text-xs font-sans text-foreground focus:outline-hidden resize-none"
                />
              </div>

              <div>
                <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground block mb-1">
                  Alternate Route / Safe Haven Notes
                </label>
                <input
                  type="text"
                  value={pRouteNotes}
                  onChange={(e) => setPRouteNotes(e.target.value)}
                  placeholder="e.g. Army transit camp at Pang (Km 175) offers emergency oxygen."
                  className="w-full px-3.5 py-2 rounded-xl bg-background border border-muted text-xs font-sans text-foreground focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-muted">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddPlanModal(false);
                    setShowEditPlanModal(false);
                    setPlanToEdit(null);
                  }}
                  className="px-4 py-2 rounded-xl border border-muted text-xs font-sans text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !pTitle.trim() || !pTrigger.trim() || !pBackup.trim()}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? "Saving..." : "Save Protocol"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: DELETE CONTACT CONFIRMATION */}
      {contactToDelete && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-3xl bg-surface border border-muted p-5 space-y-4 shadow-2xl">
            <div className="flex items-center gap-2 text-rose-400">
              <Trash2 className="w-5 h-5" />
              <h3 className="font-display text-lg text-foreground font-normal">
                Delete Safety Contact?
              </h3>
            </div>
            <p className="text-xs text-muted-foreground">
              Are you sure you want to remove &quot;{contactToDelete.name}&quot; from your emergency directory?
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-muted">
              <button
                onClick={() => setContactToDelete(null)}
                className="px-3 py-1.5 rounded-xl border border-muted text-xs font-sans text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  await removeContact(contactToDelete.id);
                  setContactToDelete(null);
                }}
                className="px-4 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-semibold text-xs transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: DELETE CONTINGENCY PLAN CONFIRMATION */}
      {planToDelete && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-3xl bg-surface border border-muted p-5 space-y-4 shadow-2xl">
            <div className="flex items-center gap-2 text-rose-400">
              <Trash2 className="w-5 h-5" />
              <h3 className="font-display text-lg text-foreground font-normal">
                Delete Plan B Protocol?
              </h3>
            </div>
            <p className="text-xs text-muted-foreground">
              Are you sure you want to remove &quot;{planToDelete.title}&quot; from your contingency matrix?
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-muted">
              <button
                onClick={() => setPlanToDelete(null)}
                className="px-3 py-1.5 rounded-xl border border-muted text-xs font-sans text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  await removeContingency(planToDelete.id);
                  setPlanToDelete(null);
                }}
                className="px-4 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-semibold text-xs transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
