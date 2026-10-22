"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Bike,
  Plus,
  Trash2,
  Edit3,
  Phone,
  Gauge,
  ShieldCheck,
  Lock,
  Camera,
  Calendar,
  MapPin,
  AlertTriangle,
  CreditCard,
  X,
  Car,
  Compass,
  Check,
  ZoomIn,
} from "lucide-react";
import { getTrip } from "@/lib/vault/storage";
import { useRentals } from "@/lib/vault/useRentals";
import {
  TripRecord,
  VehicleRentalRecord,
  VehicleType,
  PaymentMode,
  DepositRefundStatus,
} from "@/lib/vault/types";
import { revokeSecretAccess } from "@/lib/deviceAuth";
import { useLockBodyScroll } from "@/lib/vault/useLockBodyScroll";
import { Select } from "@/components/ui/Select";

const COMMON_GEAR_OPTIONS = [
  "Helmet x1",
  "Helmets x2",
  "Bungee Cords",
  "Pannier Mounts",
  "Mobile Mount",
  "Luggage Carrier",
  "Tool Kit",
  "First Aid Pouch",
  "Rain Ponchos",
  "Riding Gloves",
];

export default function TripRentalsPage() {
  const params = useParams();
  const router = useRouter();
  const tripId = params.tripId as string;

  const [trip, setTrip] = useState<TripRecord | null>(null);
  const [isTripLoading, setIsTripLoading] = useState(true);

  const {
    rentals,
    stats,
    isLoading: isRentalsLoading,
    addRental,
    updateRental,
    updateOdometer,
    updateDepositStatus,
    addInspectionPhoto,
    removeInspectionPhoto,
    removeRental,
  } = useRentals(tripId);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingRental, setEditingRental] = useState<VehicleRentalRecord | null>(null);
  const [odometerRental, setOdometerRental] = useState<VehicleRentalRecord | null>(null);
  const [odometerValue, setOdometerValue] = useState<number>(0);
  const [lightboxPhoto, setLightboxPhoto] = useState<string | null>(null);

  // Lock body scroll when any modal or lightbox is active
  useLockBodyScroll(showAddModal || !!odometerRental || !!lightboxPhoto);

  // Form State
  const [formVehicleType, setFormVehicleType] = useState<VehicleType>("MOTORCYCLE");
  const [formVehicleModel, setFormVehicleModel] = useState("");
  const [formRegNumber, setFormRegNumber] = useState("");
  const [formVendorName, setFormVendorName] = useState("");
  const [formVendorPhone, setFormVendorPhone] = useState("");
  const [formPickupLocation, setFormPickupLocation] = useState("");
  const [formPickupTime, setFormPickupTime] = useState("");
  const [formDropoffLocation, setFormDropoffLocation] = useState("");
  const [formDropoffTime, setFormDropoffTime] = useState("");
  const [formStartOdo, setFormStartOdo] = useState<number>(0);
  const [formEndOdo, setFormEndOdo] = useState<string>("");
  const [formDailyRate, setFormDailyRate] = useState<number>(1200);
  const [formDeposit, setFormDeposit] = useState<number>(5000);
  const [formPaymentMode, setFormPaymentMode] = useState<PaymentMode>("UPI");
  const [formDepositStatus, setFormDepositStatus] = useState<DepositRefundStatus>("PENDING");
  const [formConditionNotes, setFormConditionNotes] = useState("");
  const [formGearIncluded, setFormGearIncluded] = useState<string[]>(["Helmet x1", "Bungee Cords"]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Hidden photo file input
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [targetPhotoRentalId, setTargetPhotoRentalId] = useState<string | null>(null);

  // Load trip record
  useEffect(() => {
    let mounted = true;
    if (!tripId) return;

    (async () => {
      try {
        const data = await getTrip(tripId);
        if (mounted) setTrip(data);
      } catch (err) {
        console.error("Failed to load trip:", err);
      } finally {
        if (mounted) setIsTripLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [tripId]);

  // Lock vault session
  const handleLockVault = () => {
    revokeSecretAccess();
    router.push("/");
  };

  // Open Add modal with smart defaults
  const handleOpenAddModal = () => {
    setEditingRental(null);
    setFormVehicleType("MOTORCYCLE");
    setFormVehicleModel("");
    setFormRegNumber("");
    setFormVendorName("");
    setFormVendorPhone("");
    setFormPickupLocation(trip?.destination ? `${trip.destination} Bike Rental Zone` : "");
    setFormPickupTime(new Date().toISOString().slice(0, 16));
    setFormDropoffLocation(trip?.destination ? `${trip.destination} Bike Rental Zone` : "");
    const tomorrow = new Date(Date.now() + 86400000 * 3);
    setFormDropoffTime(tomorrow.toISOString().slice(0, 16));
    setFormStartOdo(12500);
    setFormEndOdo("");
    setFormDailyRate(1500);
    setFormDeposit(5000);
    setFormPaymentMode("UPI");
    setFormDepositStatus("PENDING");
    setFormConditionNotes("");
    setFormGearIncluded(["Helmet x1", "Bungee Cords"]);
    setShowAddModal(true);
  };

  // Open Edit modal
  const handleOpenEditModal = (rental: VehicleRentalRecord) => {
    setEditingRental(rental);
    setFormVehicleType(rental.vehicleType);
    setFormVehicleModel(rental.vehicleModel);
    setFormRegNumber(rental.vehicleRegNumber);
    setFormVendorName(rental.vendorName);
    setFormVendorPhone(rental.vendorPhone);
    setFormPickupLocation(rental.pickupLocation);
    setFormPickupTime(rental.pickupTime ? rental.pickupTime.slice(0, 16) : "");
    setFormDropoffLocation(rental.dropoffLocation);
    setFormDropoffTime(rental.dropoffTime ? rental.dropoffTime.slice(0, 16) : "");
    setFormStartOdo(rental.startOdometerKm);
    setFormEndOdo(rental.endOdometerKm !== undefined ? String(rental.endOdometerKm) : "");
    setFormDailyRate(rental.dailyRate);
    setFormDeposit(rental.securityDeposit);
    setFormPaymentMode(rental.depositPaymentMode);
    setFormDepositStatus(rental.depositRefundStatus);
    setFormConditionNotes(rental.conditionNotes || "");
    setFormGearIncluded(rental.gearIncluded || []);
    setShowAddModal(true);
  };

  // Toggle Gear in Form
  const toggleGear = (gear: string) => {
    if (formGearIncluded.includes(gear)) {
      setFormGearIncluded(formGearIncluded.filter((g) => g !== gear));
    } else {
      setFormGearIncluded([...formGearIncluded, gear]);
    }
  };

  // Handle Submit Form
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formVehicleModel.trim() || !formRegNumber.trim()) return;

    setIsSubmitting(true);
    try {
      const pTime = formPickupTime ? new Date(formPickupTime).toISOString() : new Date().toISOString();
      const dTime = formDropoffTime ? new Date(formDropoffTime).toISOString() : new Date().toISOString();
      const endOdoVal = formEndOdo.trim() ? Number(formEndOdo) : undefined;

      if (editingRental) {
        await updateRental({
          ...editingRental,
          vehicleType: formVehicleType,
          vehicleModel: formVehicleModel.trim(),
          vehicleRegNumber: formRegNumber.trim().toUpperCase(),
          vendorName: formVendorName.trim(),
          vendorPhone: formVendorPhone.trim(),
          pickupLocation: formPickupLocation.trim(),
          pickupTime: pTime,
          dropoffLocation: formDropoffLocation.trim(),
          dropoffTime: dTime,
          startOdometerKm: Number(formStartOdo) || 0,
          endOdometerKm: endOdoVal,
          dailyRate: Number(formDailyRate) || 0,
          securityDeposit: Number(formDeposit) || 0,
          depositPaymentMode: formPaymentMode,
          depositRefundStatus: formDepositStatus,
          conditionNotes: formConditionNotes.trim() || undefined,
          gearIncluded: formGearIncluded,
        });
      } else {
        await addRental({
          vehicleType: formVehicleType,
          vehicleModel: formVehicleModel.trim(),
          vehicleRegNumber: formRegNumber.trim().toUpperCase(),
          vendorName: formVendorName.trim(),
          vendorPhone: formVendorPhone.trim(),
          pickupLocation: formPickupLocation.trim(),
          pickupTime: pTime,
          dropoffLocation: formDropoffLocation.trim(),
          dropoffTime: dTime,
          startOdometerKm: Number(formStartOdo) || 0,
          endOdometerKm: endOdoVal,
          dailyRate: Number(formDailyRate) || 0,
          securityDeposit: Number(formDeposit) || 0,
          depositPaymentMode: formPaymentMode,
          depositRefundStatus: formDepositStatus,
          conditionNotes: formConditionNotes.trim() || undefined,
          gearIncluded: formGearIncluded,
          inspectionPhotos: [],
        });
      }
      setShowAddModal(false);
      setEditingRental(null);
    } catch (err) {
      console.error("Failed saving rental record:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Quick Odometer Modal
  const handleOpenOdometerModal = (rental: VehicleRentalRecord) => {
    setOdometerRental(rental);
    setOdometerValue(rental.endOdometerKm || rental.startOdometerKm);
  };

  const handleSaveOdometer = async () => {
    if (!odometerRental) return;
    try {
      await updateOdometer(odometerRental.id, Number(odometerValue));
      setOdometerRental(null);
    } catch (err) {
      console.error("Failed updating odometer:", err);
    }
  };

  // Trigger scratch photo file input
  const handleTriggerPhotoUpload = (rentalId: string) => {
    setTargetPhotoRentalId(rentalId);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  };

  // Convert uploaded image to scaled data URL for scratch gallery
  const handlePhotoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !targetPhotoRentalId) return;

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const rawDataUrl = event.target?.result as string;
        // Optional downscale using HTML canvas
        const img = new Image();
        img.onload = async () => {
          const canvas = document.createElement("canvas");
          const maxDim = 1200;
          let w = img.width;
          let h = img.height;
          if (w > maxDim || h > maxDim) {
            if (w > h) {
              h = Math.round((h * maxDim) / w);
              w = maxDim;
            } else {
              w = Math.round((w * maxDim) / h);
              h = maxDim;
            }
          }
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(img, 0, 0, w, h);
            const compressed = canvas.toDataURL("image/jpeg", 0.75);
            await addInspectionPhoto(targetPhotoRentalId, compressed);
          } else {
            await addInspectionPhoto(targetPhotoRentalId, rawDataUrl);
          }
        };
        img.src = rawDataUrl;
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error("Failed processing inspection photo:", err);
    }
  };

  // Icon helper for vehicle type
  const getVehicleTypeIcon = (type: VehicleType) => {
    switch (type) {
      case "MOTORCYCLE":
        return <Bike className="w-5 h-5 text-emerald-400" />;
      case "SCOOTER":
        return <Bike className="w-5 h-5 text-teal-400" />;
      case "CAR":
      case "SUV":
        return <Car className="w-5 h-5 text-cyan-400" />;
      case "BICYCLE":
        return <Bike className="w-5 h-5 text-amber-400" />;
      default:
        return <Compass className="w-5 h-5 text-indigo-400" />;
    }
  };

  if (isTripLoading || isRentalsLoading) {
    return (
      <div className="max-w-4xl mx-auto py-24 text-center text-xs font-mono text-muted-foreground flex items-center justify-center gap-2">
        <div className="w-4 h-4 rounded-full border border-muted border-t-emerald-500 animate-spin" />
        <span>Loading vehicle rental fleet vault...</span>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="max-w-md mx-auto py-20 text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center mx-auto">
          <Bike className="w-6 h-6 text-emerald-500" />
        </div>
        <h2 className="font-display text-2xl text-foreground font-normal">
          Expedition Dossier Not Found
        </h2>
        <Link
          href="/secret/vault"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-surface border border-muted text-xs font-sans text-foreground"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Return to Dashboard</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in pt-2 sm:pt-4 pb-24">
      {/* Hidden File Input for Inspection Photo Upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handlePhotoFileChange}
        className="hidden"
      />

      {/* Top Navigation */}
      <nav className="flex items-center justify-between border-b border-muted pb-4">
        <Link
          href={`/secret/vault/${trip.id}`}
          className="group inline-flex items-center gap-2 text-xs font-sans tracking-wide text-muted-foreground hover:text-foreground transition-colors py-1.5"
        >
          <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" />
          <span>Command Center</span>
        </Link>

        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-mono tracking-wider text-emerald-400 font-semibold uppercase">
            <Bike className="w-3.5 h-3.5 text-emerald-400" />
            <span>Pillar 06 • Rentals</span>
          </div>

          <button
            onClick={handleLockVault}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-muted hover:border-foreground/30 text-[11px] font-sans text-muted-foreground hover:text-foreground transition-colors"
            title="Lock Private Atlas"
          >
            <Lock className="w-3 h-3 text-amber-500" />
            <span>Lock</span>
          </button>
        </div>
      </nav>

      {/* FLEET HERO COMMAND BANNER */}
      <section className="relative rounded-3xl border border-emerald-500/30 bg-surface/80 overflow-hidden shadow-soft p-6 sm:p-8 backdrop-blur-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-mono text-emerald-400 uppercase tracking-widest">
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
              <span>Fleet & Rental Logistics</span>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl text-foreground font-normal tracking-tight">
              Bike & Scooter Rental Fleet
            </h1>
            <p className="font-body text-xs text-muted-foreground max-w-xl leading-relaxed">
              Track vehicle specs, odometer telemetry, vendor hotlines, refundable security deposits, and pre-rental scratch inspection photos in{" "}
              <span className="text-foreground font-medium">{trip.destination}</span>.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={handleOpenAddModal}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-black font-semibold text-xs font-sans transition-all shadow-md active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Add Rental Vehicle</span>
            </button>
          </div>
        </div>

        {/* FLEET STATS METRICS RIBBON */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-muted/60">
          {/* Metric 1: Total Fleet */}
          <div className="p-3.5 rounded-2xl bg-background/80 border border-muted/60">
            <span className="text-[10px] font-mono uppercase text-muted-foreground tracking-wider block">
              Vehicles Logged
            </span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-bold font-mono text-foreground">
                {stats.totalVehicles}
              </span>
              <span className="text-xs font-mono text-muted-foreground">
                vehicles
              </span>
            </div>
            <span className="text-[10px] text-emerald-400 block mt-0.5">
              {stats.activeRentals} currently active
            </span>
          </div>

          {/* Metric 2: Security Deposits Held */}
          <div className="p-3.5 rounded-2xl bg-background/80 border border-muted/60">
            <span className="text-[10px] font-mono uppercase text-muted-foreground tracking-wider block">
              Total Deposit Held
            </span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-bold font-mono text-amber-400">
                ₹{stats.totalSecurityDeposit.toLocaleString()}
              </span>
            </div>
            <span className="text-[10px] text-muted-foreground block mt-0.5">
              Across all rentals
            </span>
          </div>

          {/* Metric 3: Pending Refunds */}
          <div className="p-3.5 rounded-2xl bg-background/80 border border-muted/60">
            <span className="text-[10px] font-mono uppercase text-muted-foreground tracking-wider block">
              Pending Refund
            </span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-bold font-mono text-orange-400">
                ₹{stats.pendingRefundAmount.toLocaleString()}
              </span>
            </div>
            <span className="text-[10px] text-muted-foreground block mt-0.5">
              Payable upon vehicle return
            </span>
          </div>

          {/* Metric 4: Total Distance Logged */}
          <div className="p-3.5 rounded-2xl bg-background/80 border border-muted/60">
            <span className="text-[10px] font-mono uppercase text-muted-foreground tracking-wider block">
              Distance Driven
            </span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-bold font-mono text-emerald-400">
                {stats.totalKmDriven > 0 ? `${stats.totalKmDriven.toLocaleString()} km` : "0 km"}
              </span>
            </div>
            <span className="text-[10px] text-muted-foreground block mt-0.5">
              Telemetry calculated
            </span>
          </div>
        </div>
      </section>

      {/* RENTALS LIST */}
      <section className="space-y-4">
        {rentals.length === 0 ? (
          <div className="p-12 text-center rounded-2xl border border-muted bg-surface/40 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center mx-auto">
              <Bike className="w-6 h-6 text-emerald-400" />
            </div>
            <h3 className="font-display text-base text-foreground font-normal">
              No Rental Vehicles Logged Yet
            </h3>
            <p className="font-body text-xs text-muted-foreground max-w-sm mx-auto">
              Add your Royal Enfield, Himalayan scooter, or SUV rental details to track odometer readings, vendor agreements, and deposit recovery.
            </p>
            <button
              onClick={handleOpenAddModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-black text-xs font-semibold shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Log First Rental</span>
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {rentals.map((rental) => {
              const kmDriven =
                typeof rental.endOdometerKm === "number" && rental.endOdometerKm >= rental.startOdometerKm
                  ? rental.endOdometerKm - rental.startOdometerKm
                  : null;

              const isPendingDeposit = rental.depositRefundStatus === "PENDING";
              const isRefunded = rental.depositRefundStatus === "REFUNDED";

              return (
                <div
                  key={rental.id}
                  className="rounded-2xl border border-muted hover:border-emerald-500/40 bg-surface shadow-soft p-5 sm:p-6 space-y-5 transition-all"
                >
                  {/* Top Bar: Vehicle Info & Actions */}
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="flex items-start gap-3.5">
                      <div className="p-3 rounded-xl bg-background border border-muted text-emerald-400 shrink-0">
                        {getVehicleTypeIcon(rental.vehicleType)}
                      </div>

                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-display text-lg sm:text-xl text-foreground font-normal tracking-tight">
                            {rental.vehicleModel}
                          </h3>

                          {/* Indian Style Number Plate Badge */}
                          <div className="inline-flex items-center px-2 py-0.5 rounded-md bg-yellow-400/90 border border-yellow-500 text-black text-[11px] font-mono font-black tracking-wider uppercase shadow-xs">
                            IND • {rental.vehicleRegNumber}
                          </div>

                          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground px-2 py-0.5 rounded-md bg-background border border-muted">
                            {rental.vehicleType}
                          </span>
                        </div>

                        {/* Vendor & 1-tap call */}
                        <div className="flex flex-wrap items-center gap-3 text-xs font-sans text-muted-foreground pt-0.5">
                          <span className="font-medium text-foreground">{rental.vendorName}</span>
                          {rental.vendorPhone && (
                            <a
                              href={`tel:${rental.vendorPhone}`}
                              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition-colors font-mono"
                              title="1-Tap Call Vendor"
                            >
                              <Phone className="w-3 h-3" />
                              <span>{rental.vendorPhone}</span>
                            </a>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0">
                      <button
                        onClick={() => handleOpenOdometerModal(rental)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-background border border-muted hover:border-emerald-500/40 text-xs font-sans text-foreground transition-colors shadow-xs"
                        title="Update End Odometer reading"
                      >
                        <Gauge className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Update Km</span>
                      </button>

                      <button
                        onClick={() => handleOpenEditModal(rental)}
                        className="p-1.5 rounded-lg border border-muted hover:border-foreground/30 text-muted-foreground hover:text-foreground transition-colors"
                        title="Edit Rental Details"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => removeRental(rental.id)}
                        className="p-1.5 rounded-lg border border-muted hover:border-rose-500/40 text-muted-foreground hover:text-rose-400 transition-colors"
                        title="Delete record"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* 3-Column Info Grid: Schedule, Telemetry, Deposit */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-muted/60">
                    {/* Column 1: Dates & Location */}
                    <div className="p-3.5 rounded-xl bg-background/60 border border-muted space-y-2">
                      <span className="text-[10px] font-mono uppercase text-muted-foreground tracking-wider flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-emerald-400" />
                        <span>Rental Schedule</span>
                      </span>

                      <div className="space-y-1.5 text-xs font-sans">
                        <div>
                          <span className="text-[10px] text-muted-foreground block">Pickup:</span>
                          <span className="font-medium text-foreground">
                            {new Date(rental.pickupTime).toLocaleDateString()} • {new Date(rental.pickupTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <div className="flex items-center gap-1 text-[11px] text-muted-foreground truncate">
                            <MapPin className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
                            <span className="truncate">{rental.pickupLocation}</span>
                          </div>
                        </div>

                        <div className="pt-1 border-t border-muted/40">
                          <span className="text-[10px] text-muted-foreground block">Drop-off:</span>
                          <span className="font-medium text-foreground">
                            {new Date(rental.dropoffTime).toLocaleDateString()} • {new Date(rental.dropoffTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <div className="flex items-center gap-1 text-[11px] text-muted-foreground truncate">
                            <MapPin className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
                            <span className="truncate">{rental.dropoffLocation}</span>
                          </div>
                        </div>
                      </div>

                      <div className="pt-1 text-[11px] font-mono text-muted-foreground">
                        Tariff: <span className="text-foreground font-semibold">₹{rental.dailyRate.toLocaleString()}</span> / day
                      </div>
                    </div>

                    {/* Column 2: Odometer Telemetry (REQ-RNT-02) */}
                    <div className="p-3.5 rounded-xl bg-background/60 border border-muted space-y-2">
                      <span className="text-[10px] font-mono uppercase text-muted-foreground tracking-wider flex items-center gap-1">
                        <Gauge className="w-3 h-3 text-cyan-400" />
                        <span>Odometer Telemetry</span>
                      </span>

                      <div className="space-y-1.5 text-xs font-sans">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Start Reading:</span>
                          <span className="font-mono font-medium text-foreground">
                            {rental.startOdometerKm.toLocaleString()} km
                          </span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">End Reading:</span>
                          <span className="font-mono font-medium text-foreground">
                            {rental.endOdometerKm !== undefined ? `${rental.endOdometerKm.toLocaleString()} km` : "Pending Return"}
                          </span>
                        </div>

                        <div className="pt-2 border-t border-muted/40 flex items-center justify-between">
                          <span className="text-xs font-semibold text-foreground">Total Driven:</span>
                          <span className="font-mono text-sm font-bold text-cyan-400">
                            {kmDriven !== null ? `+${kmDriven.toLocaleString()} km` : "In Progress"}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleOpenOdometerModal(rental)}
                        className="w-full mt-1 py-1 rounded-lg bg-surface hover:bg-surface-hover border border-muted text-[11px] font-sans text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {rental.endOdometerKm ? "Edit End Odometer" : "Log Return Km"}
                      </button>
                    </div>

                    {/* Column 3: Security Deposit Ledger (REQ-RNT-03) */}
                    <div className="p-3.5 rounded-xl bg-background/60 border border-muted space-y-2">
                      <span className="text-[10px] font-mono uppercase text-muted-foreground tracking-wider flex items-center gap-1">
                        <CreditCard className="w-3 h-3 text-amber-400" />
                        <span>Security Deposit</span>
                      </span>

                      <div className="space-y-1.5 text-xs font-sans">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Deposit Paid:</span>
                          <span className="font-mono font-bold text-amber-400">
                            ₹{rental.securityDeposit.toLocaleString()}
                          </span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Payment Mode:</span>
                          <span className="px-1.5 py-0.5 rounded bg-background border border-muted text-[10px] font-mono">
                            {rental.depositPaymentMode}
                          </span>
                        </div>

                        <div className="pt-1.5 border-t border-muted/40">
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Refund Status:</span>
                            <span
                              className={`px-2 py-0.5 rounded-md font-mono text-[10px] uppercase font-semibold border ${
                                isRefunded
                                  ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"
                                  : isPendingDeposit
                                  ? "bg-amber-500/20 border-amber-500/40 text-amber-400"
                                  : "bg-rose-500/20 border-rose-500/40 text-rose-400"
                              }`}
                            >
                              {rental.depositRefundStatus}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="pt-1">
                        {isPendingDeposit ? (
                          <button
                            onClick={() => updateDepositStatus(rental.id, "REFUNDED")}
                            className="w-full py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-[11px] font-sans font-medium text-emerald-400 transition-colors"
                          >
                            Mark Deposit as Refunded
                          </button>
                        ) : (
                          <button
                            onClick={() => updateDepositStatus(rental.id, "PENDING")}
                            className="w-full py-1 rounded-lg bg-surface hover:bg-surface-hover border border-muted text-[11px] font-sans text-muted-foreground transition-colors"
                          >
                            Reopen Deposit Status
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Gear Included Pills */}
                  {rental.gearIncluded && rental.gearIncluded.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                        Gear & Equipment Included:
                      </span>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {rental.gearIncluded.map((gear, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-background border border-muted text-xs font-sans text-foreground"
                          >
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span>{gear}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Pre-Rental Condition Notes */}
                  {rental.conditionNotes && (
                    <div className="p-3 rounded-xl bg-background/50 border border-muted text-xs font-sans text-muted-foreground space-y-1">
                      <span className="font-semibold text-foreground flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                        <span>Pre-Rental Inspection Notes:</span>
                      </span>
                      <p className="leading-relaxed pl-5">{rental.conditionNotes}</p>
                    </div>
                  )}

                  {/* PRE-RENTAL SCRATCH INSPECTOR & PHOTO GALLERY (REQ-RNT-04) */}
                  <div className="space-y-2.5 pt-2 border-t border-muted/60">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Camera className="w-4 h-4 text-emerald-400" />
                        <h4 className="font-display text-sm font-normal text-foreground">
                          Pre-Rental Scratch Inspector & Gallery
                        </h4>
                        <span className="text-[10px] font-mono text-muted-foreground bg-background px-2 py-0.5 rounded border border-muted">
                          {rental.inspectionPhotos?.length || 0} Photos
                        </span>
                      </div>

                      <button
                        onClick={() => handleTriggerPhotoUpload(rental.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-background border border-muted hover:border-emerald-500/40 text-xs font-sans text-foreground transition-colors shadow-xs"
                      >
                        <Plus className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Add Scratch Photo</span>
                      </button>
                    </div>

                    {rental.inspectionPhotos && rental.inspectionPhotos.length > 0 ? (
                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
                        {rental.inspectionPhotos.map((photoUrl, pIdx) => (
                          <div
                            key={pIdx}
                            className="group/photo relative aspect-square rounded-xl overflow-hidden border border-muted bg-background cursor-pointer"
                            onClick={() => setLightboxPhoto(photoUrl)}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={photoUrl}
                              alt={`Inspection Photo ${pIdx + 1}`}
                              className="w-full h-full object-cover group-hover/photo:scale-105 transition-transform duration-300"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/photo:opacity-100 transition-opacity flex items-center justify-center gap-2">
                              <ZoomIn className="w-4 h-4 text-white" />
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeInspectionPhoto(rental.id, pIdx);
                                }}
                                className="p-1 rounded bg-black/70 hover:bg-rose-600 text-white transition-colors"
                                title="Delete Photo"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] font-sans text-muted-foreground italic">
                        No pre-existing scratch photos attached. Tap &ldquo;Add Scratch Photo&rdquo; to document body condition prior to taking custody.
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ADD / EDIT RENTAL MODAL */}
      {showAddModal && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setShowAddModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in overscroll-contain"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-w-xl w-full max-h-[90vh] overflow-y-auto p-6 rounded-2xl border border-muted bg-surface shadow-2xl space-y-5"
          >
            <div className="flex items-center justify-between border-b border-muted pb-3">
              <div className="flex items-center gap-2">
                <Bike className="w-5 h-5 text-accent" />
                <h3 className="font-display text-xl text-foreground font-normal">
                  {editingRental ? "Edit Rental Record" : "Add Vehicle Rental"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="space-y-4">
              {/* Vehicle Type & Model */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-sans font-medium text-foreground">Vehicle Type *</label>
                  <Select
                    value={formVehicleType}
                    onChange={(e) => setFormVehicleType(e.target.value as VehicleType)}
                  >
                    <option value="MOTORCYCLE">Motorcycle</option>
                    <option value="SCOOTER">Scooter</option>
                    <option value="CAR">Car</option>
                    <option value="SUV">SUV 4x4</option>
                    <option value="BICYCLE">Bicycle</option>
                    <option value="OTHER">Other</option>
                  </Select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-sans font-medium text-foreground">Vehicle Model *</label>
                  <input
                    type="text"
                    value={formVehicleModel}
                    onChange={(e) => setFormVehicleModel(e.target.value)}
                    placeholder="e.g. Royal Enfield Himalayan 450"
                    className="w-full px-3 py-2 rounded-xl bg-background border border-muted focus:border-accent focus:outline-hidden text-xs text-foreground placeholder:text-muted-foreground/50"
                    required
                  />
                </div>
              </div>

              {/* Registration Number & Vendor Phone */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-sans font-medium text-foreground">Registration / Plate No. *</label>
                  <input
                    type="text"
                    value={formRegNumber}
                    onChange={(e) => setFormRegNumber(e.target.value)}
                    placeholder="e.g. HP-01-AB-1234"
                    className="w-full px-3 py-2 rounded-xl bg-background border border-muted focus:border-accent focus:outline-hidden text-xs font-mono uppercase text-foreground placeholder:text-muted-foreground/50"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-sans font-medium text-foreground">Vendor Hotline Phone</label>
                  <input
                    type="tel"
                    value={formVendorPhone}
                    onChange={(e) => setFormVendorPhone(e.target.value)}
                    placeholder="e.g. +91 98765 43210"
                    className="w-full px-3 py-2 rounded-xl bg-background border border-muted focus:border-accent focus:outline-hidden text-xs font-mono text-foreground placeholder:text-muted-foreground/50"
                  />
                </div>
              </div>

              {/* Vendor Name */}
              <div className="space-y-1">
                <label className="text-xs font-sans font-medium text-foreground">Vendor / Shop Name</label>
                <input
                  type="text"
                  value={formVendorName}
                  onChange={(e) => setFormVendorName(e.target.value)}
                  placeholder="e.g. Himalayan Adventure Moto Hire"
                  className="w-full px-3 py-2 rounded-xl bg-background border border-muted focus:border-accent focus:outline-hidden text-xs text-foreground placeholder:text-muted-foreground/50"
                />
              </div>

              {/* Pickup Location & Time */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-sans font-medium text-foreground">Pickup Location</label>
                  <input
                    type="text"
                    value={formPickupLocation}
                    onChange={(e) => setFormPickupLocation(e.target.value)}
                    placeholder="e.g. Manali Mall Road Workshop"
                    className="w-full px-3 py-2 rounded-xl bg-background border border-muted focus:border-accent focus:outline-hidden text-xs text-foreground placeholder:text-muted-foreground/50"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-sans font-medium text-foreground">Pickup Date & Time</label>
                  <input
                    type="datetime-local"
                    value={formPickupTime}
                    onChange={(e) => setFormPickupTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-background border border-muted focus:border-accent focus:outline-hidden text-xs font-mono text-foreground"
                  />
                </div>
              </div>

              {/* Drop-off Location & Time */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-sans font-medium text-foreground">Drop-off Location</label>
                  <input
                    type="text"
                    value={formDropoffLocation}
                    onChange={(e) => setFormDropoffLocation(e.target.value)}
                    placeholder="e.g. Leh Main Market Drop"
                    className="w-full px-3 py-2 rounded-xl bg-background border border-muted focus:border-accent focus:outline-hidden text-xs text-foreground placeholder:text-muted-foreground/50"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-sans font-medium text-foreground">Drop-off Date & Time</label>
                  <input
                    type="datetime-local"
                    value={formDropoffTime}
                    onChange={(e) => setFormDropoffTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-background border border-muted focus:border-accent focus:outline-hidden text-xs font-mono text-foreground"
                  />
                </div>
              </div>

              {/* Odometer Readings */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-sans font-medium text-foreground">Start Odometer (km)</label>
                  <input
                    type="number"
                    value={formStartOdo}
                    onChange={(e) => setFormStartOdo(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-background border border-muted focus:border-accent focus:outline-hidden text-xs font-mono text-foreground"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-sans font-medium text-foreground">End Odometer (km - optional)</label>
                  <input
                    type="number"
                    value={formEndOdo}
                    onChange={(e) => setFormEndOdo(e.target.value)}
                    placeholder="Leave blank until return"
                    className="w-full px-3 py-2 rounded-xl bg-background border border-muted focus:border-accent focus:outline-hidden text-xs font-mono text-foreground placeholder:text-muted-foreground/50"
                  />
                </div>
              </div>

              {/* Daily Rate & Security Deposit */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-sans font-medium text-foreground">Daily Rate (₹)</label>
                  <input
                    type="number"
                    value={formDailyRate}
                    onChange={(e) => setFormDailyRate(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-background border border-muted focus:border-accent focus:outline-hidden text-xs font-mono text-foreground"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-sans font-medium text-foreground">Security Deposit (₹)</label>
                  <input
                    type="number"
                    value={formDeposit}
                    onChange={(e) => setFormDeposit(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-background border border-muted focus:border-accent focus:outline-hidden text-xs font-mono text-foreground"
                  />
                </div>
              </div>

              {/* Deposit Payment Mode & Refund Status */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-sans font-medium text-foreground">Deposit Payment Mode</label>
                  <Select
                    value={formPaymentMode}
                    onChange={(e) => setFormPaymentMode(e.target.value as PaymentMode)}
                  >
                    <option value="UPI">UPI (GPay / PhonePe / Paytm)</option>
                    <option value="CASH">Cash</option>
                    <option value="CARD">Credit / Debit Card</option>
                    <option value="NET_BANKING">Net Banking</option>
                    <option value="OTHER">Other</option>
                  </Select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-sans font-medium text-foreground">Deposit Refund Status</label>
                  <Select
                    value={formDepositStatus}
                    onChange={(e) => setFormDepositStatus(e.target.value as DepositRefundStatus)}
                  >
                    <option value="PENDING">Pending Refund on Return</option>
                    <option value="REFUNDED">Refunded & Settled</option>
                    <option value="DEDUCTED">Deductions Applied</option>
                  </Select>
                </div>
              </div>

              {/* Gear Included Checkboxes */}
              <div className="space-y-1.5">
                <label className="text-xs font-sans font-medium text-foreground">Gear & Accessories Included</label>
                <div className="flex flex-wrap gap-2">
                  {COMMON_GEAR_OPTIONS.map((gear) => {
                    const active = formGearIncluded.includes(gear);
                    return (
                      <button
                        key={gear}
                        type="button"
                        onClick={() => toggleGear(gear)}
                        className={`px-3 py-1 rounded-xl border text-xs font-sans transition-colors cursor-pointer ${
                          active
                            ? "bg-accent/10 border-accent text-accent font-semibold"
                            : "bg-background border-muted text-muted-foreground hover:border-foreground/30"
                        }`}
                      >
                        {gear}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Condition Notes */}
              <div className="space-y-1">
                <label className="text-xs font-sans font-medium text-foreground">Pre-Rental Inspection Notes</label>
                <textarea
                  value={formConditionNotes}
                  onChange={(e) => setFormConditionNotes(e.target.value)}
                  rows={2}
                  placeholder="e.g. Scratches on left tank protector, slight dent on rear rim."
                  className="w-full px-3 py-2 rounded-xl bg-background border border-muted focus:border-accent focus:outline-hidden text-xs text-foreground placeholder:text-muted-foreground/50 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-muted">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl border border-muted text-xs font-sans text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-accent hover:bg-accent/90 disabled:opacity-50 text-white font-medium text-xs font-sans transition-all cursor-pointer shadow-xs"
                >
                  {isSubmitting ? "Saving..." : editingRental ? "Update Record" : "Save Rental"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QUICK ODOMETER UPDATE MODAL */}
      {odometerRental && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setOdometerRental(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in overscroll-contain"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-w-md w-full p-6 rounded-2xl border border-muted bg-surface shadow-2xl space-y-5"
          >
            <div className="flex items-center justify-between border-b border-muted pb-3">
              <div className="flex items-center gap-2">
                <Gauge className="w-5 h-5 text-accent" />
                <h3 className="font-display text-lg text-foreground font-normal">
                  Log End Km: {odometerRental.vehicleModel}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setOdometerRental(null)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-background border border-muted text-xs font-sans space-y-1">
                <div className="flex justify-between text-muted-foreground">
                  <span>Start Odometer:</span>
                  <span className="font-mono text-foreground font-medium">
                    {odometerRental.startOdometerKm.toLocaleString()} km
                  </span>
                </div>
                {odometerValue >= odometerRental.startOdometerKm && (
                  <div className="flex justify-between text-accent font-semibold pt-1 border-t border-muted/50">
                    <span>Computed Distance:</span>
                    <span className="font-mono">
                      +{(odometerValue - odometerRental.startOdometerKm).toLocaleString()} km
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-sans font-medium text-foreground">
                  Current / Drop-off Odometer (km)
                </label>
                <input
                  type="number"
                  value={odometerValue}
                  onChange={(e) => setOdometerValue(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-background border border-muted focus:border-accent focus:outline-hidden text-sm font-mono text-foreground"
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-muted">
                <button
                  type="button"
                  onClick={() => setOdometerRental(null)}
                  className="px-4 py-2 rounded-xl border border-muted text-xs font-sans text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveOdometer}
                  className="px-5 py-2 rounded-xl bg-accent hover:bg-accent/90 text-white font-medium text-xs font-sans transition-all cursor-pointer shadow-xs"
                >
                  Save Odometer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* LIGHTBOX PHOTO MODAL */}
      {lightboxPhoto && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-fade-in overscroll-contain"
          onClick={() => setLightboxPhoto(null)}
        >
          <div
            className="max-w-3xl w-full max-h-[90vh] overflow-hidden rounded-2xl border border-muted bg-black relative flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setLightboxPhoto(null)}
              className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/60 text-white hover:bg-black/90 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightboxPhoto}
              alt="Pre-rental scratch inspection photo"
              className="max-w-full max-h-[85vh] object-contain rounded-xl"
            />
          </div>
        </div>
      )}
    </div>
  );
}
