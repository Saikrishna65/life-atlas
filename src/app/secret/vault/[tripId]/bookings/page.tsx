"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  MapPin,
  Clock,
  Plus,
  Trash2,
  Edit3,
  Copy,
  Check,
  Phone,
  Navigation,
  ShieldCheck,
  Lock,
  Train,
  Plane,
  Bus,
  Car,
  Ship,
  Hotel,
  Home,
  Tent,
  Building,
  AlertCircle,
  CreditCard,
  X,
  FileText,
  Ticket,
} from "lucide-react";
import { getTrip, getDocumentsForTrip } from "@/lib/vault/storage";
import { useBookings } from "@/lib/vault/useBookings";
import {
  TripRecord,
  BookingRecord,
  BookingCategory,
  TransportType,
  AccommodationType,
  BookingStatus,
  DocumentAttachmentRecord,
} from "@/lib/vault/types";
import { revokeSecretAccess } from "@/lib/deviceAuth";
import { useLockBodyScroll } from "@/lib/vault/useLockBodyScroll";
import { Select } from "@/components/ui/Select";

type TabFilter = "ALL" | "TRANSPORT" | "ACCOMMODATION";

export default function TripBookingsPage() {
  const params = useParams();
  const router = useRouter();
  const tripId = params.tripId as string;

  const [trip, setTrip] = useState<TripRecord | null>(null);
  const [isTripLoading, setIsTripLoading] = useState(true);

  const {
    bookings,
    isLoading: isBookingsLoading,
    financials,
    addBooking,
    updateBooking,
    removeBooking,
  } = useBookings(tripId);

  const [activeTab, setActiveTab] = useState<TabFilter>("ALL");
  const [copiedPNRId, setCopiedPNRId] = useState<string | null>(null);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingBooking, setEditingBooking] = useState<BookingRecord | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<BookingRecord | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Lock body scroll when modal or delete dialog is open
  useLockBodyScroll(showModal || !!deleteCandidate);

  // Form state
  const [category, setCategory] = useState<BookingCategory>("TRANSPORT");
  const [transportType, setTransportType] = useState<TransportType>("TRAIN");
  const [accommodationType, setAccommodationType] = useState<AccommodationType>("HOTEL");
  const [title, setTitle] = useState("");
  const [carrierOrVendor, setCarrierOrVendor] = useState("");
  const [pnrNumber, setPnrNumber] = useState("");
  const [bookingReference, setBookingReference] = useState("");
  const [seatOrRoomDetails, setSeatOrRoomDetails] = useState("");
  const [departureOrCheckInTime, setDepartureOrCheckInTime] = useState("");
  const [arrivalOrCheckOutTime, setArrivalOrCheckOutTime] = useState("");
  const [departureOrPropertyAddress, setDepartureOrPropertyAddress] = useState("");
  const [arrivalAddress, setArrivalAddress] = useState("");
  const [totalCost, setTotalCost] = useState<number>(0);
  const [depositPaid, setDepositPaid] = useState<number>(0);
  const [currency, setCurrency] = useState("INR");
  const [status, setStatus] = useState<BookingStatus>("CONFIRMED");
  const [contactPhone, setContactPhone] = useState("");
  const [notes, setNotes] = useState("");

  const [documents, setDocuments] = useState<DocumentAttachmentRecord[]>([]);

  // Load trip record and attached documents
  useEffect(() => {
    let mounted = true;
    if (!tripId) return;

    (async () => {
      try {
        const [tripData, docsData] = await Promise.all([
          getTrip(tripId),
          getDocumentsForTrip(tripId),
        ]);
        if (mounted) {
          setTrip(tripData);
          if (tripData?.currency) setCurrency(tripData.currency);
          setDocuments(docsData);
        }
      } catch (err) {
        console.error("Failed loading trip or documents:", err);
      } finally {
        if (mounted) {
          setIsTripLoading(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [tripId]);

  // Filter bookings
  const filteredBookings = useMemo(() => {
    if (activeTab === "ALL") return bookings;
    return bookings.filter((b) => b.category === activeTab);
  }, [bookings, activeTab]);

  // Lock vault session
  const handleLockVault = () => {
    revokeSecretAccess();
    router.push("/");
  };

  // Copy PNR to clipboard with visual feedback
  const handleCopyPNR = (pnr: string, id: string) => {
    navigator.clipboard.writeText(pnr);
    setCopiedPNRId(id);
    setTimeout(() => setCopiedPNRId(null), 2500);
  };

  // Open modal for new booking
  const handleOpenAddModal = (presetCategory?: BookingCategory) => {
    setEditingBooking(null);
    const cat = presetCategory || (activeTab === "ACCOMMODATION" ? "ACCOMMODATION" : "TRANSPORT");
    setCategory(cat);
    setTransportType("TRAIN");
    setAccommodationType("HOTEL");
    setTitle("");
    setCarrierOrVendor("");
    setPnrNumber("");
    setBookingReference("");
    setSeatOrRoomDetails("");
    setDepartureOrCheckInTime("");
    setArrivalOrCheckOutTime("");
    setDepartureOrPropertyAddress("");
    setArrivalAddress("");
    setTotalCost(0);
    setDepositPaid(0);
    setCurrency(trip?.currency || "INR");
    setStatus("CONFIRMED");
    setContactPhone("");
    setNotes("");
    setShowModal(true);
  };

  // Open modal for editing
  const handleOpenEditModal = (booking: BookingRecord) => {
    setEditingBooking(booking);
    setCategory(booking.category);
    if (booking.category === "TRANSPORT") {
      setTransportType(booking.type as TransportType);
    } else {
      setAccommodationType(booking.type as AccommodationType);
    }
    setTitle(booking.title);
    setCarrierOrVendor(booking.carrierOrVendor || "");
    setPnrNumber(booking.pnrNumber || "");
    setBookingReference(booking.bookingReference || "");
    setSeatOrRoomDetails(booking.seatOrRoomDetails || "");
    setDepartureOrCheckInTime(
      booking.departureOrCheckInTime ? booking.departureOrCheckInTime.slice(0, 16) : ""
    );
    setArrivalOrCheckOutTime(
      booking.arrivalOrCheckOutTime ? booking.arrivalOrCheckOutTime.slice(0, 16) : ""
    );
    setDepartureOrPropertyAddress(booking.departureOrPropertyAddress || "");
    setArrivalAddress(booking.arrivalAddress || "");
    setTotalCost(booking.totalCost);
    setDepositPaid(booking.depositPaid);
    setCurrency(booking.currency);
    setStatus(booking.status);
    setContactPhone(booking.contactPhone || "");
    setNotes(booking.notes || "");
    setShowModal(true);
  };

  // Submit booking
  const handleSaveBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    try {
      setIsSubmitting(true);
      const chosenType = category === "TRANSPORT" ? transportType : accommodationType;
      const parsedCost = Number(totalCost) || 0;
      const parsedDeposit = Number(depositPaid) || 0;
      const parsedBalance = Math.max(0, parsedCost - parsedDeposit);

      if (editingBooking) {
        await updateBooking({
          ...editingBooking,
          category,
          type: chosenType,
          title: title.trim(),
          carrierOrVendor: carrierOrVendor.trim() || undefined,
          pnrNumber: pnrNumber.trim() || undefined,
          bookingReference: bookingReference.trim() || undefined,
          seatOrRoomDetails: seatOrRoomDetails.trim() || undefined,
          departureOrCheckInTime: departureOrCheckInTime
            ? new Date(departureOrCheckInTime).toISOString()
            : undefined,
          arrivalOrCheckOutTime: arrivalOrCheckOutTime
            ? new Date(arrivalOrCheckOutTime).toISOString()
            : undefined,
          departureOrPropertyAddress: departureOrPropertyAddress.trim() || undefined,
          arrivalAddress: arrivalAddress.trim() || undefined,
          totalCost: parsedCost,
          depositPaid: parsedDeposit,
          balanceDue: parsedBalance,
          currency,
          status,
          contactPhone: contactPhone.trim() || undefined,
          notes: notes.trim() || undefined,
        });
      } else {
        await addBooking({
          category,
          type: chosenType,
          title: title.trim(),
          carrierOrVendor: carrierOrVendor.trim() || undefined,
          pnrNumber: pnrNumber.trim() || undefined,
          bookingReference: bookingReference.trim() || undefined,
          seatOrRoomDetails: seatOrRoomDetails.trim() || undefined,
          departureOrCheckInTime: departureOrCheckInTime
            ? new Date(departureOrCheckInTime).toISOString()
            : undefined,
          arrivalOrCheckOutTime: arrivalOrCheckOutTime
            ? new Date(arrivalOrCheckOutTime).toISOString()
            : undefined,
          departureOrPropertyAddress: departureOrPropertyAddress.trim() || undefined,
          arrivalAddress: arrivalAddress.trim() || undefined,
          totalCost: parsedCost,
          depositPaid: parsedDeposit,
          balanceDue: parsedBalance,
          currency,
          status,
          contactPhone: contactPhone.trim() || undefined,
          notes: notes.trim() || undefined,
        });
      }

      setShowModal(false);
    } catch (err) {
      console.error("Failed saving booking:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete booking confirmation
  const handleConfirmDelete = async () => {
    if (!deleteCandidate) return;
    try {
      await removeBooking(deleteCandidate.id);
      setDeleteCandidate(null);
    } catch (err) {
      console.error("Failed deleting booking:", err);
    }
  };

  // Icons helper
  const getBookingIcon = (cat: BookingCategory, type: string) => {
    if (cat === "TRANSPORT") {
      switch (type) {
        case "TRAIN":
          return <Train className="w-4 h-4 text-cyan-400" />;
        case "FLIGHT":
          return <Plane className="w-4 h-4 text-indigo-400" />;
        case "BUS":
          return <Bus className="w-4 h-4 text-emerald-400" />;
        case "CAB":
        case "SELF_DRIVE":
          return <Car className="w-4 h-4 text-amber-400" />;
        case "FERRY":
          return <Ship className="w-4 h-4 text-blue-400" />;
        default:
          return <Train className="w-4 h-4 text-cyan-400" />;
      }
    } else {
      switch (type) {
        case "HOSTEL":
          return <Building className="w-4 h-4 text-purple-400" />;
        case "HOMESTAY":
          return <Home className="w-4 h-4 text-orange-400" />;
        case "CAMP":
          return <Tent className="w-4 h-4 text-emerald-400" />;
        default:
          return <Hotel className="w-4 h-4 text-amber-400" />;
      }
    }
  };

  if (isTripLoading || isBookingsLoading) {
    return (
      <div className="max-w-4xl mx-auto py-24 text-center text-xs font-mono text-muted-foreground flex items-center justify-center gap-2">
        <div className="w-4 h-4 rounded-full border border-muted border-t-amber-500 animate-spin" />
        <span>Loading offline booking vouchers...</span>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="max-w-md mx-auto py-20 text-center space-y-4">
        <h2 className="font-display text-2xl text-foreground font-normal">Expedition Not Found</h2>
        <Link
          href="/secret/vault"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-surface border border-muted text-xs font-sans text-foreground"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Return to Vault</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in pt-2 sm:pt-4 pb-24">
      {/* Top Navigation */}
      <nav className="flex items-center justify-between border-b border-muted pb-4">
        <Link
          href={`/secret/vault/${trip.id}`}
          className="group inline-flex items-center gap-2 text-xs font-sans tracking-wide text-muted-foreground hover:text-foreground transition-colors py-1.5"
        >
          <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" />
          <span>Trip Command Center</span>
        </Link>

        <div className="flex items-center gap-2.5">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-[11px] font-mono tracking-wider text-cyan-400 font-semibold uppercase">
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
            <span>Bookings & Vouchers</span>
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

      {/* HEADER WITH FINANCIAL BALANCES BANNER (REQ-BKG-03) */}
      <header className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-widest text-cyan-400 font-semibold">
              Pillar 03 • Transport & Stay Manager
            </span>
            <h1 className="font-display text-3xl sm:text-4xl text-foreground font-normal tracking-tight mt-1">
              Tickets & Vouchers
            </h1>
            <p className="font-body text-xs sm:text-sm text-muted-foreground mt-1">
              IRCTC trains, boarding passes, PNRs, stay vouchers, and check-in balance ledger.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Link
              href={`/secret/vault/${trip.id}/assistant`}
              className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 hover:border-cyan-400 text-cyan-300 font-medium text-xs font-sans tracking-wide transition-colors"
              title="Parse raw ticket confirmation SMS or email"
            >
              <Ticket className="w-3.5 h-3.5 text-cyan-400" />
              <span>Smart PNR Parser</span>
            </Link>

            <button
              onClick={() => handleOpenAddModal()}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-neutral-950 font-semibold text-xs font-sans tracking-wide shadow-soft transition-all active:scale-[0.98]"
            >
              <Plus className="w-4 h-4" />
              <span>Add Booking</span>
            </button>
          </div>
        </div>

        {/* FINANCIAL BALANCES BANNER (REQ-BKG-03) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-2xl border border-muted bg-surface/80 shadow-soft">
          <div className="p-3 rounded-xl bg-background border border-muted/50">
            <span className="text-[10px] font-mono uppercase text-muted-foreground tracking-wider block">
              Total Booking Tariff
            </span>
            <span className="text-base font-semibold font-mono text-foreground mt-0.5 block">
              {trip.currency} {financials.totalCost.toLocaleString()}
            </span>
            <span className="text-[10px] text-muted-foreground mt-0.5 block">
              {financials.totalCount} Confirmed bookings
            </span>
          </div>

          <div className="p-3 rounded-xl bg-background border border-muted/50">
            <span className="text-[10px] font-mono uppercase text-muted-foreground tracking-wider block">
              Advance Deposits Paid
            </span>
            <span className="text-base font-semibold font-mono text-emerald-400 mt-0.5 block">
              {trip.currency} {financials.totalDeposits.toLocaleString()}
            </span>
            <span className="text-[10px] text-muted-foreground mt-0.5 block">
              Pre-paid securely
            </span>
          </div>

          <div className="p-3 rounded-xl bg-background border border-muted/50">
            <span className="text-[10px] font-mono uppercase text-muted-foreground tracking-wider block">
              Balance Due on Arrival
            </span>
            <span
              className={`text-base font-semibold font-mono mt-0.5 block ${
                financials.totalBalanceDue > 0 ? "text-amber-400" : "text-emerald-400"
              }`}
            >
              {trip.currency} {financials.totalBalanceDue.toLocaleString()}
            </span>
            <span className="text-[10px] text-muted-foreground mt-0.5 block">
              {financials.totalBalanceDue > 0 ? "Payable at check-in" : "Fully settled"}
            </span>
          </div>
        </div>
      </header>

      {/* FILTER TABS */}
      <div className="flex items-center gap-1.5 p-1 bg-surface border border-muted rounded-xl text-xs overflow-x-auto [scrollbar-width:none]">
        {(
          [
            { id: "ALL", label: `All Bookings (${financials.totalCount})` },
            { id: "TRANSPORT", label: `Transport & PNRs (${financials.transportCount})` },
            { id: "ACCOMMODATION", label: `Stays & Hotels (${financials.accommodationCount})` },
          ] as { id: TabFilter; label: string }[]
        ).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3.5 py-1.5 rounded-lg transition-all whitespace-nowrap select-none ${
              activeTab === tab.id
                ? "bg-background text-foreground border border-muted shadow-xs font-medium"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* BOOKINGS LIST */}
      {filteredBookings.length === 0 ? (
        <div className="p-12 rounded-3xl border border-muted border-dashed bg-surface/40 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center mx-auto">
            <CreditCard className="w-6 h-6 text-cyan-400" />
          </div>
          <h3 className="font-display text-lg text-foreground font-normal">
            No {activeTab.toLowerCase()} bookings recorded
          </h3>
          <p className="font-body text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
            Record IRCTC train tickets, flights, bus reservations, and hotel vouchers with offline access to PNR numbers and arrival balances.
          </p>
          <button
            onClick={() => handleOpenAddModal()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-neutral-950 font-medium text-xs font-sans transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add First Booking</span>
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredBookings.map((bkg) => {
            const isTransport = bkg.category === "TRANSPORT";
            const isCopied = copiedPNRId === bkg.id;

            return (
              <div
                key={bkg.id}
                className="group rounded-2xl border border-muted bg-surface hover:border-foreground/20 p-5 sm:p-6 transition-all duration-200 shadow-soft space-y-4"
              >
                {/* Header: Carrier/Vendor, Status, PNR Copy, Menu */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 rounded-xl bg-background border border-muted shrink-0 mt-0.5">
                      {getBookingIcon(bkg.category, bkg.type)}
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-md bg-background border border-muted text-muted-foreground font-semibold">
                          {bkg.type}
                        </span>

                        <span
                          className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-md font-semibold border ${
                            bkg.status === "CONFIRMED"
                              ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                              : bkg.status === "WAITLISTED"
                              ? "bg-amber-500/15 border-amber-500/30 text-amber-400"
                              : bkg.status === "CANCELLED"
                              ? "bg-rose-500/15 border-rose-500/30 text-rose-400"
                              : "bg-surface border-muted text-muted-foreground"
                          }`}
                        >
                          {bkg.status}
                        </span>

                        {bkg.carrierOrVendor && (
                          <span className="text-xs font-mono text-muted-foreground">
                            • {bkg.carrierOrVendor}
                          </span>
                        )}
                      </div>

                      <h3 className="font-display text-xl text-foreground font-normal tracking-tight">
                        {bkg.title}
                      </h3>
                    </div>
                  </div>

                  {/* Actions & PNR Button (REQ-BKG-01) */}
                  <div className="flex items-center gap-2 self-start sm:self-center">
                    {/* 1-Tap Copy PNR Button if PNR exists */}
                    {bkg.pnrNumber && (
                      <button
                        onClick={() => handleCopyPNR(bkg.pnrNumber!, bkg.id)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all shadow-xs ${
                          isCopied
                            ? "bg-emerald-500 text-neutral-950 border border-emerald-500 scale-105"
                            : "bg-background border border-cyan-500/40 text-cyan-400 hover:border-cyan-400 hover:bg-cyan-500/10"
                        }`}
                        title="Copy PNR to Clipboard"
                      >
                        {isCopied ? (
                          <>
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                            <span>COPIED!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>PNR: {bkg.pnrNumber}</span>
                          </>
                        )}
                      </button>
                    )}

                    <button
                      onClick={() => handleOpenEditModal(bkg)}
                      className="p-2 rounded-xl bg-background border border-muted hover:border-foreground/30 text-muted-foreground hover:text-foreground transition-colors"
                      title="Edit Booking"
                      aria-label="Edit Booking"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => setDeleteCandidate(bkg)}
                      className="p-2 rounded-xl bg-background border border-muted hover:border-rose-500/40 text-muted-foreground hover:text-rose-400 transition-colors"
                      title="Delete Booking"
                      aria-label="Delete Booking"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Body: Journey / Stay Logistics */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-muted/50 text-xs text-muted-foreground">
                  {/* Left Column: Route or Property Address */}
                  <div className="space-y-1.5">
                    {isTransport ? (
                      <div>
                        <span className="text-[10px] font-mono uppercase text-muted-foreground/80 block">
                          Route Details
                        </span>
                        <div className="text-foreground font-medium flex items-center gap-1.5 mt-0.5">
                          <span>{bkg.departureOrPropertyAddress || "Departure"}</span>
                          <span className="text-muted-foreground">→</span>
                          <span>{bkg.arrivalAddress || "Arrival"}</span>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <span className="text-[10px] font-mono uppercase text-muted-foreground/80 block">
                          Property Location
                        </span>
                        <div className="text-foreground font-medium flex items-center gap-1.5 mt-0.5">
                          <MapPin className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          <span className="line-clamp-1">
                            {bkg.departureOrPropertyAddress || trip.destination}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Seat or Room info */}
                    {bkg.seatOrRoomDetails && (
                      <div className="text-[11px] font-mono text-cyan-400 bg-background px-2.5 py-1 rounded-lg border border-muted inline-block">
                        {isTransport ? "Seat / Berth:" : "Room Type:"} {bkg.seatOrRoomDetails}
                      </div>
                    )}
                  </div>

                  {/* Right Column: Timings (Departure/Check-in & Arrival/Check-out) */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-mono uppercase text-muted-foreground/80 block">
                      {isTransport ? "Schedule & Timings" : "Check-in / Check-out"}
                    </span>
                    <div className="flex items-center gap-2 text-foreground font-mono">
                      <Clock className="w-3.5 h-3.5 text-accent shrink-0" />
                      <span>
                        {bkg.departureOrCheckInTime
                          ? new Date(bkg.departureOrCheckInTime).toLocaleString("en-US", {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "Time TBD"}
                      </span>
                      {bkg.arrivalOrCheckOutTime && (
                        <>
                          <span className="text-muted-foreground">→</span>
                          <span>
                            {new Date(bkg.arrivalOrCheckOutTime).toLocaleString("en-US", {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </>
                      )}
                    </div>

                    {/* 1-Tap Hotel Quick Actions: Call & Directions (REQ-BKG-02) */}
                    {!isTransport && (
                      <div className="flex items-center gap-2 pt-1">
                        {bkg.contactPhone && (
                          <a
                            href={`tel:${bkg.contactPhone}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-background border border-muted hover:border-emerald-500/50 text-[11px] font-sans text-emerald-400 transition-colors"
                          >
                            <Phone className="w-3 h-3" />
                            <span>Call ({bkg.contactPhone})</span>
                          </a>
                        )}

                        {bkg.departureOrPropertyAddress && (
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                              `${bkg.title} ${bkg.departureOrPropertyAddress}`
                            )}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-background border border-muted hover:border-amber-500/50 text-[11px] font-sans text-amber-400 transition-colors"
                          >
                            <Navigation className="w-3 h-3" />
                            <span>Directions</span>
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer: Financial Balance Breakdown (REQ-BKG-03) & Attached Documents (REQ-DOC-03) */}
                <div className="pt-3 border-t border-muted/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-4 font-mono">
                    <div>
                      <span className="text-[10px] uppercase text-muted-foreground block">
                        Total Tariff
                      </span>
                      <span className="font-semibold text-foreground">
                        {bkg.currency} {bkg.totalCost.toLocaleString()}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase text-muted-foreground block">
                        Deposit Paid
                      </span>
                      <span className="font-semibold text-emerald-400">
                        {bkg.currency} {bkg.depositPaid.toLocaleString()}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase text-muted-foreground block">
                        Balance Due
                      </span>
                      <span
                        className={`font-semibold ${
                          bkg.balanceDue > 0 ? "text-amber-400" : "text-emerald-400"
                        }`}
                      >
                        {bkg.currency} {bkg.balanceDue.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Attached Ticket Link (REQ-DOC-03) */}
                    {(() => {
                      const linkedDocs = documents.filter((d) => d.bookingId === bkg.id);
                      return linkedDocs.length > 0 ? (
                        <Link
                          href={`/secret/vault/${trip.id}/documents`}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 text-indigo-300 text-[11px] font-sans font-medium transition-colors"
                          title="View Attached Offline Document"
                        >
                          <FileText className="w-3 h-3 text-indigo-400" />
                          <span>View Attached Ticket ({linkedDocs.length})</span>
                        </Link>
                      ) : (
                        <Link
                          href={`/secret/vault/${trip.id}/documents`}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-background hover:bg-surface border border-muted text-muted-foreground hover:text-foreground text-[11px] font-sans transition-colors"
                          title="Attach ticket or boarding pass in Document Vault"
                        >
                          <FileText className="w-3 h-3" />
                          <span>Attach Document</span>
                        </Link>
                      );
                    })()}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL: ADD / EDIT BOOKING */}
      {showModal && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setShowModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in overscroll-contain"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 rounded-2xl border border-muted bg-surface shadow-2xl space-y-5"
          >
            <div className="flex items-center justify-between border-b border-muted pb-3">
              <h3 className="font-display text-xl text-foreground font-normal">
                {editingBooking ? "Edit Booking Voucher" : "Add Booking Voucher"}
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveBooking} className="space-y-4">
              {/* Category Selector (Transport vs Accommodation) */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setCategory("TRANSPORT")}
                  className={`py-2 px-3 rounded-xl border text-xs font-sans font-semibold transition-all cursor-pointer ${
                    category === "TRANSPORT"
                      ? "bg-accent/10 border-accent text-accent shadow-xs"
                      : "bg-background border-muted text-muted-foreground hover:border-foreground/30"
                  }`}
                >
                  Transport & Tickets
                </button>
                <button
                  type="button"
                  onClick={() => setCategory("ACCOMMODATION")}
                  className={`py-2 px-3 rounded-xl border text-xs font-sans font-semibold transition-all cursor-pointer ${
                    category === "ACCOMMODATION"
                      ? "bg-accent/10 border-accent text-accent shadow-xs"
                      : "bg-background border-muted text-muted-foreground hover:border-foreground/30"
                  }`}
                >
                  Stay & Accommodation
                </button>
              </div>

              {/* Specific Sub-Type */}
              <div className="space-y-1">
                <label className="text-xs font-sans font-medium text-foreground">Booking Type</label>
                {category === "TRANSPORT" ? (
                  <Select
                    value={transportType}
                    onChange={(e) => setTransportType(e.target.value as TransportType)}
                  >
                    <option value="TRAIN">Train (IRCTC)</option>
                    <option value="FLIGHT">Flight</option>
                    <option value="BUS">Intercity Bus</option>
                    <option value="CAB">Taxi / Private Cab</option>
                    <option value="SELF_DRIVE">Self-Drive Rental</option>
                    <option value="FERRY">Ferry / Boat</option>
                  </Select>
                ) : (
                  <Select
                    value={accommodationType}
                    onChange={(e) => setAccommodationType(e.target.value as AccommodationType)}
                  >
                    <option value="HOTEL">Hotel</option>
                    <option value="HOMESTAY">Homestay</option>
                    <option value="HOSTEL">Hostel (Zostel / Backpacker)</option>
                    <option value="CAMP">Alpine Camp / Tent</option>
                    <option value="RESORT">Resort</option>
                    <option value="OTHER">Other Stay</option>
                  </Select>
                )}
              </div>

              {/* Title & Carrier / Property */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-sans font-medium text-foreground">
                    Title / Route *
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={
                      category === "TRANSPORT"
                        ? "e.g. New Delhi to Kalka Shatabdi"
                        : "e.g. Zostel Manali Riverside"
                    }
                    className="w-full px-3 py-2 rounded-xl bg-background border border-muted focus:border-accent focus:outline-hidden text-xs text-foreground"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-sans font-medium text-foreground">
                    Carrier / Vendor / Hotel Name
                  </label>
                  <input
                    type="text"
                    value={carrierOrVendor}
                    onChange={(e) => setCarrierOrVendor(e.target.value)}
                    placeholder={
                      category === "TRANSPORT" ? "e.g. IRCTC Train 12011" : "e.g. Zostel Hospitality"
                    }
                    className="w-full px-3 py-2 rounded-xl bg-background border border-muted focus:border-accent focus:outline-hidden text-xs text-foreground"
                  />
                </div>
              </div>

              {/* PNR / Booking Reference & Seat / Room details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-sans font-medium text-foreground">
                    PNR Number / Confirmation Ref
                  </label>
                  <input
                    type="text"
                    value={pnrNumber}
                    onChange={(e) => setPnrNumber(e.target.value.toUpperCase())}
                    placeholder="e.g. 2849182390"
                    className="w-full px-3 py-2 rounded-xl bg-background border border-muted focus:border-accent focus:outline-hidden text-xs font-mono uppercase text-foreground"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-sans font-medium text-foreground">
                    {category === "TRANSPORT" ? "Coach & Berth / Seat" : "Room Type & Number"}
                  </label>
                  <input
                    type="text"
                    value={seatOrRoomDetails}
                    onChange={(e) => setSeatOrRoomDetails(e.target.value)}
                    placeholder={
                      category === "TRANSPORT"
                        ? "e.g. Coach B3, Berth 42 (Side Lower)"
                        : "e.g. Deluxe Room 204"
                    }
                    className="w-full px-3 py-2 rounded-xl bg-background border border-muted focus:border-accent focus:outline-hidden text-xs text-foreground"
                  />
                </div>
              </div>

              {/* Departure/Check-in & Arrival/Check-out Timings */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-sans font-medium text-foreground">
                    {category === "TRANSPORT" ? "Departure Time" : "Check-in Time"}
                  </label>
                  <input
                    type="datetime-local"
                    value={departureOrCheckInTime}
                    onChange={(e) => setDepartureOrCheckInTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-background border border-muted focus:border-accent focus:outline-hidden text-xs font-mono text-foreground"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-sans font-medium text-foreground">
                    {category === "TRANSPORT" ? "Arrival Time" : "Check-out Time"}
                  </label>
                  <input
                    type="datetime-local"
                    value={arrivalOrCheckOutTime}
                    onChange={(e) => setArrivalOrCheckOutTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-background border border-muted focus:border-accent focus:outline-hidden text-xs font-mono text-foreground"
                  />
                </div>
              </div>

              {/* Addresses: Departure/Property & Arrival */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-sans font-medium text-foreground">
                    {category === "TRANSPORT" ? "Departure Station / City" : "Property Address"}
                  </label>
                  <input
                    type="text"
                    value={departureOrPropertyAddress}
                    onChange={(e) => setDepartureOrPropertyAddress(e.target.value)}
                    placeholder={
                      category === "TRANSPORT"
                        ? "e.g. New Delhi Railway Station (NDLS)"
                        : "e.g. Old Manali Road, Himachal Pradesh"
                    }
                    className="w-full px-3 py-2 rounded-xl bg-background border border-muted focus:border-accent focus:outline-hidden text-xs text-foreground"
                  />
                </div>

                {category === "TRANSPORT" ? (
                  <div className="space-y-1">
                    <label className="text-xs font-sans font-medium text-foreground">
                      Arrival Station / City
                    </label>
                    <input
                      type="text"
                      value={arrivalAddress}
                      onChange={(e) => setArrivalAddress(e.target.value)}
                      placeholder="e.g. Kalka (KLK)"
                      className="w-full px-3 py-2 rounded-xl bg-background border border-muted focus:border-accent focus:outline-hidden text-xs text-foreground"
                    />
                  </div>
                ) : (
                  <div className="space-y-1">
                    <label className="text-xs font-sans font-medium text-foreground">
                      Hotel Contact Telephone
                    </label>
                    <input
                      type="tel"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      placeholder="+91 98160 12345"
                      className="w-full px-3 py-2 rounded-xl bg-background border border-muted focus:border-accent focus:outline-hidden text-xs font-mono text-foreground"
                    />
                  </div>
                )}
              </div>

              {/* Financials: Tariff, Deposit Paid, Auto-computed Balance Due (REQ-BKG-03) */}
              <div className="p-3.5 rounded-xl bg-background border border-muted space-y-3">
                <span className="text-[10px] font-mono uppercase text-muted-foreground tracking-wider block">
                  Financial Tariff & Check-in Balance
                </span>

                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <label className="text-[11px] font-sans text-muted-foreground">Total Cost</label>
                    <input
                      type="number"
                      min="0"
                      value={totalCost}
                      onChange={(e) => setTotalCost(parseFloat(e.target.value) || 0)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-surface border border-muted text-xs font-mono text-foreground"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-sans text-muted-foreground">Deposit Paid</label>
                    <input
                      type="number"
                      min="0"
                      value={depositPaid}
                      onChange={(e) => setDepositPaid(parseFloat(e.target.value) || 0)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-surface border border-muted text-xs font-mono text-emerald-700 font-semibold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-sans text-muted-foreground">Balance Due</label>
                    <div className="px-2.5 py-1.5 rounded-lg bg-surface border border-muted text-xs font-mono font-semibold text-amber-800">
                      {Math.max(0, (Number(totalCost) || 0) - (Number(depositPaid) || 0)).toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>

              {/* Status Selector */}
              <div className="space-y-1">
                <label className="text-xs font-sans font-medium text-foreground">
                  Confirmation Status
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {(["CONFIRMED", "WAITLISTED", "TENTATIVE", "CANCELLED"] as BookingStatus[]).map(
                    (st) => (
                      <button
                        type="button"
                        key={st}
                        onClick={() => setStatus(st)}
                        className={`py-1.5 px-2 rounded-lg border text-[10px] font-mono uppercase transition-all cursor-pointer ${
                          status === st
                            ? "bg-accent/10 border-accent text-accent font-semibold"
                            : "bg-background border-muted text-muted-foreground hover:border-foreground/30"
                        }`}
                      >
                        {st}
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <label className="text-xs font-sans font-medium text-foreground">
                  Notes & Special Requests
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Free breakfast included. Early check-in requested."
                  className="w-full px-3 py-2 rounded-xl bg-background border border-muted focus:border-accent focus:outline-hidden text-xs text-foreground resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-muted">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-3.5 py-2 rounded-xl border border-muted text-xs font-sans text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-accent hover:bg-accent/90 text-white font-medium text-xs font-sans transition-colors cursor-pointer shadow-xs"
                >
                  {isSubmitting ? "Saving..." : editingBooking ? "Update Voucher" : "Save Voucher"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DELETE CONFIRMATION */}
      {deleteCandidate && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setDeleteCandidate(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in overscroll-contain"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-w-sm w-full p-6 rounded-2xl border border-muted bg-surface shadow-2xl text-center space-y-4"
          >
            <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6 text-rose-600" />
            </div>

            <h3 className="font-display text-lg text-foreground font-normal">
              Delete Booking Voucher?
            </h3>
            <p className="font-body text-xs text-muted-foreground leading-relaxed">
              Are you sure you want to delete <strong className="text-foreground">{deleteCandidate.title}</strong>? This voucher will be removed from your local vault.
            </p>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteCandidate(null)}
                className="flex-1 py-2 rounded-xl border border-muted text-xs font-sans text-muted-foreground hover:text-foreground cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-medium text-xs font-sans cursor-pointer"
              >
                Delete Voucher
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
