"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
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
  Upload,
  Eye,
  Download,
  Image as ImageIcon,
  ZoomIn,
  ZoomOut,
  Paperclip,
} from "lucide-react";
import { getTrip } from "@/lib/vault/storage";
import { useBookings } from "@/lib/vault/useBookings";
import { useDocuments } from "@/lib/vault/useDocuments";
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

type MasterTab = "BOOKINGS" | "DOCUMENTS";
type BookingTabFilter = "ALL" | "TRANSPORT" | "ACCOMMODATION";
type DocTabFilter = "ALL" | "PDF" | "IMAGE";

export default function TripBookingsPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tripId = params.tripId as string;

  const [trip, setTrip] = useState<TripRecord | null>(null);
  const [isTripLoading, setIsTripLoading] = useState(true);

  // Bookings Hook
  const {
    bookings,
    isLoading: isBookingsLoading,
    financials,
    addBooking,
    updateBooking,
    removeBooking,
  } = useBookings(tripId);

  // Documents Hook
  const {
    documents,
    isLoading: isDocsLoading,
    stats: docStats,
    uploadDocument,
    removeDocument,
  } = useDocuments(tripId);

  // Master Hub View State
  const [masterTab, setMasterTab] = useState<MasterTab>("BOOKINGS");
  const [bookingTab, setBookingTab] = useState<BookingTabFilter>("ALL");
  const [docFilter, setDocFilter] = useState<DocTabFilter>("ALL");
  const [copiedPNRId, setCopiedPNRId] = useState<string | null>(null);

  // Synchronize query param ?tab=documents
  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam === "documents") {
      setMasterTab("DOCUMENTS");
    }
  }, [searchParams]);

  // Booking Modal State
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [editingBooking, setEditingBooking] = useState<BookingRecord | null>(null);
  const [deleteBookingCandidate, setDeleteBookingCandidate] = useState<BookingRecord | null>(null);
  const [isSubmittingBooking, setIsSubmittingBooking] = useState(false);

  // Booking Form State
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

  // Document Modal & Previewer State
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadTitle, setUploadTitle] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [associatedBookingId, setAssociatedBookingId] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [previewDoc, setPreviewDoc] = useState<DocumentAttachmentRecord | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [deleteDocCandidate, setDeleteDocCandidate] = useState<DocumentAttachmentRecord | null>(null);

  // Lock body scroll when any modal is open
  useLockBodyScroll(
    showBookingModal ||
      !!deleteBookingCandidate ||
      showUploadModal ||
      !!previewDoc ||
      !!deleteDocCandidate
  );

  // Load trip record
  useEffect(() => {
    let mounted = true;
    if (!tripId) return;

    (async () => {
      try {
        const tripData = await getTrip(tripId);
        if (mounted && tripData) {
          setTrip(tripData);
          if (tripData.currency) setCurrency(tripData.currency);
        }
      } catch (err) {
        console.error("Failed loading trip:", err);
      } finally {
        if (mounted) setIsTripLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [tripId]);

  // Clean up object URLs
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  // Filter bookings
  const filteredBookings = useMemo(() => {
    if (bookingTab === "ALL") return bookings;
    return bookings.filter((b) => b.category === bookingTab);
  }, [bookings, bookingTab]);

  // Filter documents
  const filteredDocuments = useMemo(() => {
    if (docFilter === "ALL") return documents;
    return documents.filter((d) => d.fileType === docFilter);
  }, [documents, docFilter]);

  // Lock vault session
  const handleLockVault = () => {
    revokeSecretAccess();
    router.push("/");
  };

  // Copy PNR
  const handleCopyPNR = (pnr: string, id: string) => {
    navigator.clipboard.writeText(pnr);
    setCopiedPNRId(id);
    setTimeout(() => setCopiedPNRId(null), 2500);
  };

  // Open modal for new booking
  const handleOpenAddBooking = (presetCategory?: BookingCategory) => {
    setEditingBooking(null);
    const cat = presetCategory || (bookingTab === "ACCOMMODATION" ? "ACCOMMODATION" : "TRANSPORT");
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
    setShowBookingModal(true);
  };

  // Open modal for editing booking
  const handleOpenEditBooking = (bkg: BookingRecord) => {
    setEditingBooking(bkg);
    setCategory(bkg.category);
    if (bkg.category === "TRANSPORT") {
      setTransportType(bkg.type as TransportType);
    } else {
      setAccommodationType(bkg.type as AccommodationType);
    }
    setTitle(bkg.title);
    setCarrierOrVendor(bkg.carrierOrVendor || "");
    setPnrNumber(bkg.pnrNumber || "");
    setBookingReference(bkg.bookingReference || "");
    setSeatOrRoomDetails(bkg.seatOrRoomDetails || "");
    setDepartureOrCheckInTime(bkg.departureOrCheckInTime ? bkg.departureOrCheckInTime.slice(0, 16) : "");
    setArrivalOrCheckOutTime(bkg.arrivalOrCheckOutTime ? bkg.arrivalOrCheckOutTime.slice(0, 16) : "");
    setDepartureOrPropertyAddress(bkg.departureOrPropertyAddress || "");
    setArrivalAddress(bkg.arrivalAddress || "");
    setTotalCost(bkg.totalCost || 0);
    setDepositPaid(bkg.depositPaid || 0);
    setCurrency(bkg.currency || trip?.currency || "INR");
    setStatus(bkg.status);
    setContactPhone(bkg.contactPhone || "");
    setNotes(bkg.notes || "");
    setShowBookingModal(true);
  };

  // Save Booking
  const handleSaveBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSubmittingBooking(true);
    try {
      const parsedCost = Number(totalCost) || 0;
      const parsedDeposit = Number(depositPaid) || 0;
      const parsedBalance = Math.max(0, parsedCost - parsedDeposit);

      if (editingBooking) {
        await updateBooking({
          ...editingBooking,
          category,
          type: category === "TRANSPORT" ? transportType : accommodationType,
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
          type: category === "TRANSPORT" ? transportType : accommodationType,
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

      setShowBookingModal(false);
    } catch (err) {
      console.error("Failed saving booking:", err);
    } finally {
      setIsSubmittingBooking(false);
    }
  };

  const handleConfirmDeleteBooking = async () => {
    if (!deleteBookingCandidate) return;
    try {
      await removeBooking(deleteBookingCandidate.id);
      setDeleteBookingCandidate(null);
    } catch (err) {
      console.error("Failed deleting booking:", err);
    }
  };

  // Open Document Upload Modal
  const handleOpenUploadModal = (preselectedBookingId?: string) => {
    setSelectedFile(null);
    setUploadTitle("");
    setAssociatedBookingId(preselectedBookingId || "");
    setShowUploadModal(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      if (!uploadTitle.trim()) {
        const nameWithoutExt = file.name.substring(0, file.name.lastIndexOf(".")) || file.name;
        setUploadTitle(nameWithoutExt);
      }
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    try {
      setIsUploading(true);
      await uploadDocument(
        selectedFile,
        uploadTitle.trim() || selectedFile.name,
        associatedBookingId || undefined
      );

      setShowUploadModal(false);
      setSelectedFile(null);
      setUploadTitle("");
      setAssociatedBookingId("");
    } catch (err) {
      console.error("Failed uploading document:", err);
    } finally {
      setIsUploading(false);
    }
  };

  // Open previewer
  const handleOpenPreview = (doc: DocumentAttachmentRecord) => {
    try {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      let blob: Blob;
      if (doc.blobData instanceof Blob) {
        blob = doc.blobData;
      } else {
        blob = new Blob([doc.blobData], { type: doc.mimeType });
      }
      const url = URL.createObjectURL(blob);
      setPreviewDoc(doc);
      setPreviewUrl(url);
      setZoomLevel(1);
    } catch (err) {
      console.error("Failed creating blob preview URL:", err);
    }
  };

  const handleClosePreview = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setPreviewDoc(null);
    setZoomLevel(1);
  };

  const handleDownloadDoc = (doc: DocumentAttachmentRecord) => {
    try {
      let blob: Blob;
      if (doc.blobData instanceof Blob) {
        blob = doc.blobData;
      } else {
        blob = new Blob([doc.blobData], { type: doc.mimeType });
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      console.error("Failed downloading document:", err);
    }
  };

  const handleConfirmDeleteDoc = async () => {
    if (!deleteDocCandidate) return;
    try {
      await removeDocument(deleteDocCandidate.id);
      setDeleteDocCandidate(null);
    } catch (err) {
      console.error("Failed deleting document:", err);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  // Icon helper for bookings
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

  if (isTripLoading || isBookingsLoading || isDocsLoading) {
    return (
      <div className="max-w-4xl mx-auto py-24 text-center text-xs font-mono text-muted-foreground flex items-center justify-center gap-2">
        <div className="w-4 h-4 rounded-full border border-muted border-t-emerald-500 animate-spin" />
        <span>Loading offline bookings & document vault...</span>
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
    <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8 animate-fade-in pt-2 sm:pt-4 pb-24">
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
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-mono tracking-wider text-emerald-400 font-semibold uppercase">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Pillar 03 & 04</span>
          </div>

          <button
            onClick={handleLockVault}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-muted hover:border-foreground/30 text-[11px] font-sans text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            title="Lock Private Atlas"
          >
            <Lock className="w-3 h-3 text-amber-500" />
            <span>Lock</span>
          </button>
        </div>
      </nav>

      {/* HEADER WITH FINANCIAL & DOCUMENT METRICS */}
      <header className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-mono text-emerald-400 uppercase tracking-widest mb-1.5 font-semibold">
              <Ticket className="w-3 h-3 text-emerald-400" />
              <span>Consolidated Logistics Hub</span>
            </div>
            <h1 className="font-display text-2xl sm:text-4xl text-foreground font-normal tracking-tight">
              Bookings & Document Vault
            </h1>
            <p className="font-body text-xs sm:text-sm text-muted-foreground mt-1">
              One unified vault for IRCTC trains, flights, stays, pass tickets, ID documents, and offline PDFs.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Link
              href={`/secret/vault/${trip.id}/assistant`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-purple-500/10 border border-purple-500/30 hover:border-purple-400 text-purple-300 font-medium text-xs font-sans tracking-wide transition-colors"
              title="Parse raw ticket confirmation SMS or email"
            >
              <Ticket className="w-3.5 h-3.5 text-purple-400" />
              <span>Smart Parser</span>
            </Link>

            <button
              onClick={() => handleOpenUploadModal()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 hover:border-emerald-400 text-emerald-300 font-medium text-xs font-sans tracking-wide transition-colors cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5 text-emerald-400" />
              <span>Upload Doc</span>
            </button>

            <button
              onClick={() => handleOpenAddBooking()}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-semibold text-xs font-sans tracking-wide shadow-soft transition-all active:scale-[0.98] cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Booking</span>
            </button>
          </div>
        </div>

        {/* COMBINED METRICS BANNER */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-3xl border border-muted bg-surface/80 shadow-soft">
          <div className="p-3 rounded-2xl bg-background border border-muted/50">
            <span className="text-[10px] font-mono uppercase text-muted-foreground tracking-wider block">
              Total Booking Tariff
            </span>
            <span className="text-sm sm:text-base font-semibold font-mono text-cyan-400 mt-0.5 block">
              {trip.currency} {financials.totalCost.toLocaleString()}
            </span>
            <span className="text-[10px] text-muted-foreground mt-0.5 block">
              {financials.totalCount} Confirmed bookings
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-background border border-muted/50">
            <span className="text-[10px] font-mono uppercase text-muted-foreground tracking-wider block">
              Advance Deposits Paid
            </span>
            <span className="text-sm sm:text-base font-semibold font-mono text-emerald-400 mt-0.5 block">
              {trip.currency} {financials.totalDeposits.toLocaleString()}
            </span>
            <span className="text-[10px] text-muted-foreground mt-0.5 block">
              Pre-paid securely
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-background border border-muted/50">
            <span className="text-[10px] font-mono uppercase text-muted-foreground tracking-wider block">
              Balance Due on Arrival
            </span>
            <span
              className={`text-sm sm:text-base font-semibold font-mono mt-0.5 block ${
                financials.totalBalanceDue > 0 ? "text-amber-400" : "text-emerald-400"
              }`}
            >
              {trip.currency} {financials.totalBalanceDue.toLocaleString()}
            </span>
            <span className="text-[10px] text-muted-foreground mt-0.5 block">
              {financials.totalBalanceDue > 0 ? "Payable at check-in" : "Fully settled"}
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-background border border-muted/50">
            <span className="text-[10px] font-mono uppercase text-muted-foreground tracking-wider block">
              Offline Documents
            </span>
            <span className="text-sm sm:text-base font-semibold font-mono text-purple-400 mt-0.5 block">
              {documents.length} Stored Files
            </span>
            <span className="text-[10px] text-muted-foreground mt-0.5 block">
              {docStats?.pdfCount || 0} PDFs • {docStats?.imageCount || 0} Passes
            </span>
          </div>
        </div>
      </header>

      {/* MASTER SEGMENTED CONTROL TABS */}
      <div className="grid grid-cols-2 gap-2 p-1.5 rounded-2xl bg-surface border border-muted shadow-soft">
        <button
          type="button"
          onClick={() => setMasterTab("BOOKINGS")}
          className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs sm:text-sm font-medium transition-all cursor-pointer ${
            masterTab === "BOOKINGS"
              ? "bg-cyan-600 text-white font-semibold shadow-md"
              : "text-muted-foreground hover:text-foreground hover:bg-surface-hover"
          }`}
        >
          <Ticket className="w-4 h-4 shrink-0" />
          <span>Bookings & Tickets ({bookings.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setMasterTab("DOCUMENTS")}
          className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs sm:text-sm font-medium transition-all cursor-pointer ${
            masterTab === "DOCUMENTS"
              ? "bg-emerald-600 text-white font-semibold shadow-md"
              : "text-muted-foreground hover:text-foreground hover:bg-surface-hover"
          }`}
        >
          <FileText className="w-4 h-4 shrink-0" />
          <span>Offline Document Vault ({documents.length})</span>
        </button>
      </div>

      {/* VIEW A: BOOKINGS & TICKETS */}
      {masterTab === "BOOKINGS" && (
        <section className="space-y-6 animate-in fade-in duration-200">
          {/* Sub-Filters */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 p-1 bg-surface border border-muted rounded-xl text-xs">
              {(
                [
                  { id: "ALL", label: `All (${bookings.length})` },
                  { id: "TRANSPORT", label: `Transport (${bookings.filter((b) => b.category === "TRANSPORT").length})` },
                  { id: "ACCOMMODATION", label: `Stays (${bookings.filter((b) => b.category === "ACCOMMODATION").length})` },
                ] as { id: BookingTabFilter; label: string }[]
              ).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setBookingTab(tab.id)}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    bookingTab === tab.id
                      ? "bg-background text-foreground border border-muted shadow-xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <button
              onClick={() => handleOpenAddBooking()}
              className="text-xs text-cyan-400 hover:text-cyan-300 font-medium flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Ticket</span>
            </button>
          </div>

          {/* Bookings Feed */}
          {filteredBookings.length === 0 ? (
            <div className="p-12 text-center rounded-3xl border border-muted bg-surface/50 space-y-3">
              <Ticket className="w-8 h-8 text-muted-foreground mx-auto opacity-50" />
              <h3 className="font-display text-lg text-foreground font-normal">
                No Bookings Recorded
              </h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Keep flights, train tickets, hotel vouchers, and PNRs organized offline in your expedition vault.
              </p>
              <button
                onClick={() => handleOpenAddBooking()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-medium text-xs font-sans transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add First Booking</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filteredBookings.map((bkg) => {
                const isTransport = bkg.category === "TRANSPORT";
                const isCopied = copiedPNRId === bkg.id;
                const attachedDocs = documents.filter((d) => d.bookingId === bkg.id);

                return (
                  <div
                    key={bkg.id}
                    className="group rounded-3xl border border-muted bg-surface hover:border-cyan-500/40 p-5 sm:p-6 transition-all duration-200 shadow-soft space-y-4"
                  >
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="p-2.5 rounded-2xl bg-background border border-muted shrink-0 mt-0.5">
                          {getBookingIcon(bkg.category, bkg.type)}
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-md bg-background border border-muted text-muted-foreground font-semibold">
                              {bkg.type}
                            </span>

                            <span
                              className={`text-[10px] font-mono uppercase tracking-wider px-2.5 py-0.5 rounded-full font-semibold border ${
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

                          <h3 className="font-display text-lg sm:text-xl text-foreground font-normal tracking-tight">
                            {bkg.title}
                          </h3>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-wrap items-center gap-2 self-start sm:self-center">
                        {bkg.pnrNumber && (
                          <button
                            onClick={() => handleCopyPNR(bkg.pnrNumber!, bkg.id)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all shadow-xs cursor-pointer ${
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
                          onClick={() => handleOpenUploadModal(bkg.id)}
                          className="p-2 rounded-xl bg-background border border-muted hover:border-emerald-400 text-muted-foreground hover:text-emerald-400 transition-colors cursor-pointer"
                          title="Attach document to this booking"
                        >
                          <Paperclip className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => handleOpenEditBooking(bkg)}
                          className="p-2 rounded-xl bg-background border border-muted hover:border-foreground/30 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                          title="Edit Booking"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => setDeleteBookingCandidate(bkg)}
                          className="p-2 rounded-xl bg-background border border-muted hover:border-rose-500/40 text-muted-foreground hover:text-rose-400 transition-colors cursor-pointer"
                          title="Delete Booking"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Logistics Row */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-muted/50 text-xs text-muted-foreground">
                      <div className="space-y-1">
                        <span className="text-[10px] font-mono uppercase text-muted-foreground/80 block">
                          {isTransport ? "Route Details" : "Property Location"}
                        </span>
                        <div className="text-foreground font-medium flex items-center gap-1.5">
                          {isTransport ? (
                            <>
                              <span>{bkg.departureOrPropertyAddress || "Departure"}</span>
                              <span className="text-muted-foreground">→</span>
                              <span>{bkg.arrivalAddress || "Arrival"}</span>
                            </>
                          ) : (
                            <>
                              <MapPin className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                              <span className="line-clamp-1">
                                {bkg.departureOrPropertyAddress || trip.destination}
                              </span>
                            </>
                          )}
                        </div>

                        {bkg.seatOrRoomDetails && (
                          <div className="text-[11px] font-mono text-cyan-400 bg-background px-2.5 py-0.5 rounded-lg border border-muted inline-block mt-1">
                            {isTransport ? "Seat / Berth:" : "Room Type:"} {bkg.seatOrRoomDetails}
                          </div>
                        )}
                      </div>

                      <div className="space-y-1">
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
                        </div>

                        <div className="flex items-center gap-3 text-xs font-mono pt-1">
                          <span className="text-foreground font-semibold">
                            Tariff: {bkg.currency} {bkg.totalCost.toLocaleString()}
                          </span>
                          {bkg.balanceDue > 0 ? (
                            <span className="text-amber-400 font-medium">
                              Due: {bkg.currency} {bkg.balanceDue.toLocaleString()}
                            </span>
                          ) : (
                            <span className="text-emerald-400 font-medium">Fully Paid</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Attached Documents Row */}
                    {attachedDocs.length > 0 && (
                      <div className="pt-3 border-t border-muted/50 flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-mono uppercase text-muted-foreground mr-1 flex items-center gap-1">
                          <Paperclip className="w-3 h-3 text-emerald-400" />
                          <span>Attached Files:</span>
                        </span>
                        {attachedDocs.map((doc) => (
                          <button
                            key={doc.id}
                            type="button"
                            onClick={() => handleOpenPreview(doc)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-background border border-emerald-500/30 hover:border-emerald-400 text-[11px] font-mono text-emerald-300 transition-colors cursor-pointer"
                          >
                            {doc.fileType === "PDF" ? (
                              <FileText className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <ImageIcon className="w-3 h-3 text-cyan-400" />
                            )}
                            <span className="truncate max-w-[140px]">{doc.title}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* VIEW B: OFFLINE DOCUMENT VAULT */}
      {masterTab === "DOCUMENTS" && (
        <section className="space-y-6 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 p-1 bg-surface border border-muted rounded-xl text-xs">
              {(
                [
                  { id: "ALL", label: `All Documents (${documents.length})` },
                  { id: "PDF", label: `PDF Tickets (${documents.filter((d) => d.fileType === "PDF").length})` },
                  { id: "IMAGE", label: `Photos & Passes (${documents.filter((d) => d.fileType === "IMAGE").length})` },
                ] as { id: DocTabFilter; label: string }[]
              ).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setDocFilter(tab.id)}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    docFilter === tab.id
                      ? "bg-background text-foreground border border-muted shadow-xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <button
              onClick={() => handleOpenUploadModal()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs font-sans transition-colors cursor-pointer shadow-xs self-start sm:self-auto"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload Offline Document</span>
            </button>
          </div>

          {filteredDocuments.length === 0 ? (
            <div className="p-12 text-center rounded-3xl border border-muted bg-surface/50 space-y-3">
              <FileText className="w-8 h-8 text-muted-foreground mx-auto opacity-50" />
              <h3 className="font-display text-lg text-foreground font-normal">
                No Documents in Vault
              </h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Store PDF flight tickets, boarding passes, ID cards, and permits directly in your device’s offline storage.
              </p>
              <button
                onClick={() => handleOpenUploadModal()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs font-sans transition-colors cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span>Upload First Document</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {filteredDocuments.map((doc) => {
                const linkedBooking = bookings.find((b) => b.id === doc.bookingId);

                return (
                  <div
                    key={doc.id}
                    className="p-5 rounded-3xl border border-muted bg-surface hover:border-emerald-500/40 transition-all shadow-soft flex flex-col justify-between space-y-4"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="p-2.5 rounded-2xl bg-background border border-muted">
                          {doc.fileType === "PDF" ? (
                            <FileText className="w-5 h-5 text-emerald-400" />
                          ) : (
                            <ImageIcon className="w-5 h-5 text-cyan-400" />
                          )}
                        </div>

                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-background border border-muted text-muted-foreground">
                          {formatBytes(doc.sizeBytes)}
                        </span>
                      </div>

                      <div>
                        <h4 className="font-display text-base text-foreground font-normal truncate" title={doc.title}>
                          {doc.title}
                        </h4>
                        <p className="text-[11px] font-mono text-muted-foreground truncate mt-0.5">
                          {doc.fileName}
                        </p>
                      </div>

                      {linkedBooking && (
                        <div className="text-[10px] font-mono text-cyan-400 bg-background px-2.5 py-1 rounded-lg border border-muted truncate">
                          Linked: {linkedBooking.title}
                        </div>
                      )}
                    </div>

                    <div className="pt-3 border-t border-muted/50 flex items-center justify-between">
                      <button
                        onClick={() => handleOpenPreview(doc)}
                        className="inline-flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 font-medium cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View Offline</span>
                      </button>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleDownloadDoc(doc)}
                          className="p-1.5 rounded-lg bg-background border border-muted hover:border-foreground/30 text-muted-foreground hover:text-foreground cursor-pointer"
                          title="Download File"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => setDeleteDocCandidate(doc)}
                          className="p-1.5 rounded-lg bg-background border border-muted hover:border-rose-400 text-muted-foreground hover:text-rose-400 cursor-pointer"
                          title="Delete File"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* MODAL: ADD / EDIT BOOKING */}
      {showBookingModal && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setShowBookingModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in overscroll-contain"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-w-lg w-full p-6 rounded-3xl border border-muted bg-surface shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-muted pb-3">
              <h3 className="font-display text-lg text-foreground font-normal">
                {editingBooking ? "Edit Booking Voucher" : "Add New Booking Voucher"}
              </h3>
              <button
                type="button"
                onClick={() => setShowBookingModal(false)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveBooking} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-sans font-medium text-foreground">
                    Booking Category
                  </label>
                  <Select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as BookingCategory)}
                  >
                    <option value="TRANSPORT">Transport (Flight, Train, Bus)</option>
                    <option value="ACCOMMODATION">Accommodation (Hotel, Hostel)</option>
                  </Select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-sans font-medium text-foreground">
                    Specific Type
                  </label>
                  {category === "TRANSPORT" ? (
                    <Select
                      value={transportType}
                      onChange={(e) => setTransportType(e.target.value as TransportType)}
                    >
                      <option value="TRAIN">Indian Railways (IRCTC)</option>
                      <option value="FLIGHT">Flight Airline</option>
                      <option value="BUS">Intercity Bus / Volvo</option>
                      <option value="CAB">Private Cab / Taxi</option>
                      <option value="SELF_DRIVE">Self Drive Vehicle</option>
                      <option value="FERRY">Boat / Ferry</option>
                    </Select>
                  ) : (
                    <Select
                      value={accommodationType}
                      onChange={(e) => setAccommodationType(e.target.value as AccommodationType)}
                    >
                      <option value="HOTEL">Hotel</option>
                      <option value="HOSTEL">Backpacker Hostel</option>
                      <option value="HOMESTAY">Local Homestay</option>
                      <option value="CAMP">Alpine Campsite / Tent</option>
                      <option value="RESORT">Resort</option>
                    </Select>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-sans font-medium text-foreground">
                  Title / Name *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={category === "TRANSPORT" ? "e.g. Vande Bharat Express 22436" : "e.g. Zostel Spiti Valley Dorm"}
                  className="w-full px-3.5 py-2 rounded-xl bg-background border border-muted focus:border-cyan-500 focus:outline-hidden text-xs text-foreground"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-sans font-medium text-foreground">
                    PNR / Confirmation #
                  </label>
                  <input
                    type="text"
                    value={pnrNumber}
                    onChange={(e) => setPnrNumber(e.target.value)}
                    placeholder="e.g. 2458910234"
                    className="w-full px-3.5 py-2 rounded-xl bg-background border border-muted focus:border-cyan-500 focus:outline-hidden text-xs font-mono text-foreground"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-sans font-medium text-foreground">
                    Seat / Berth / Room
                  </label>
                  <input
                    type="text"
                    value={seatOrRoomDetails}
                    onChange={(e) => setSeatOrRoomDetails(e.target.value)}
                    placeholder="e.g. Coach B3 Berth 24 (SL)"
                    className="w-full px-3.5 py-2 rounded-xl bg-background border border-muted focus:border-cyan-500 focus:outline-hidden text-xs text-foreground"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-sans font-medium text-foreground">
                    {category === "TRANSPORT" ? "Departure Station / City" : "Property Address"}
                  </label>
                  <input
                    type="text"
                    value={departureOrPropertyAddress}
                    onChange={(e) => setDepartureOrPropertyAddress(e.target.value)}
                    placeholder={category === "TRANSPORT" ? "e.g. NDLS (New Delhi)" : "e.g. Main Market, Kaza"}
                    className="w-full px-3.5 py-2 rounded-xl bg-background border border-muted focus:border-cyan-500 focus:outline-hidden text-xs text-foreground"
                  />
                </div>

                {category === "TRANSPORT" && (
                  <div className="space-y-1">
                    <label className="text-xs font-sans font-medium text-foreground">
                      Arrival Destination
                    </label>
                    <input
                      type="text"
                      value={arrivalAddress}
                      onChange={(e) => setArrivalAddress(e.target.value)}
                      placeholder="e.g. CDG (Chandigarh)"
                      className="w-full px-3.5 py-2 rounded-xl bg-background border border-muted focus:border-cyan-500 focus:outline-hidden text-xs text-foreground"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-sans font-medium text-foreground">
                    {category === "TRANSPORT" ? "Departure Time" : "Check-in Time"}
                  </label>
                  <input
                    type="datetime-local"
                    value={departureOrCheckInTime}
                    onChange={(e) => setDepartureOrCheckInTime(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-background border border-muted focus:border-cyan-500 focus:outline-hidden text-xs font-mono text-foreground"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-sans font-medium text-foreground">
                    Status
                  </label>
                  <Select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as BookingStatus)}
                  >
                    <option value="CONFIRMED">Confirmed</option>
                    <option value="WAITLISTED">Waitlisted</option>
                    <option value="CANCELLED">Cancelled</option>
                    <option value="DRAFT">Draft</option>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-sans font-medium text-foreground">
                    Total Cost ({currency})
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={totalCost}
                    onChange={(e) => setTotalCost(parseFloat(e.target.value) || 0)}
                    className="w-full px-3.5 py-2 rounded-xl bg-background border border-muted focus:border-cyan-500 focus:outline-hidden text-xs font-mono text-foreground"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-sans font-medium text-foreground">
                    Advance Deposit Paid ({currency})
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={depositPaid}
                    onChange={(e) => setDepositPaid(parseFloat(e.target.value) || 0)}
                    className="w-full px-3.5 py-2 rounded-xl bg-background border border-muted focus:border-cyan-500 focus:outline-hidden text-xs font-mono text-foreground"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-muted">
                <button
                  type="button"
                  onClick={() => setShowBookingModal(false)}
                  className="px-4 py-2 rounded-xl border border-muted text-xs font-sans text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingBooking}
                  className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-medium text-xs font-sans transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {isSubmittingBooking ? "Saving..." : editingBooking ? "Save Changes" : "Save Booking"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: UPLOAD OFFLINE DOCUMENT */}
      {showUploadModal && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setShowUploadModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in overscroll-contain"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-w-md w-full p-6 rounded-3xl border border-muted bg-surface shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-muted pb-3">
              <h3 className="font-display text-lg text-foreground font-normal">
                Upload Document to Offline Vault
              </h3>
              <button
                type="button"
                onClick={() => setShowUploadModal(false)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="space-y-4">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="p-6 rounded-2xl border border-dashed border-emerald-500/40 hover:border-emerald-500 bg-background/50 hover:bg-emerald-500/5 text-center cursor-pointer transition-colors space-y-2"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".pdf,image/png,image/jpeg,image/webp"
                  className="hidden"
                />

                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                  <Upload className="w-5 h-5 text-emerald-400" />
                </div>

                {selectedFile ? (
                  <div>
                    <div className="text-xs font-semibold text-foreground truncate max-w-xs mx-auto">
                      {selectedFile.name}
                    </div>
                    <div className="text-[10px] font-mono text-muted-foreground mt-0.5">
                      {formatBytes(selectedFile.size)} • Ready to encrypt & store
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="text-xs font-medium text-foreground">
                      Click to choose PDF ticket or screenshot
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      PDF, PNG, JPG (cached directly in device IndexedDB)
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-sans font-medium text-foreground">
                  Document Label / Title *
                </label>
                <input
                  type="text"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder="e.g. IRCTC Train 12011 E-Ticket PDF"
                  className="w-full px-3.5 py-2 rounded-xl bg-background border border-muted focus:border-emerald-500 focus:outline-hidden text-xs text-foreground"
                  required
                />
              </div>

              {bookings.length > 0 && (
                <div className="space-y-1">
                  <label className="text-xs font-sans font-medium text-foreground">
                    Attach to Booking (Optional)
                  </label>
                  <Select
                    value={associatedBookingId}
                    onChange={(e) => setAssociatedBookingId(e.target.value)}
                  >
                    <option value="">No Booking (General Document)</option>
                    {bookings.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.title} ({b.type})
                      </option>
                    ))}
                  </Select>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-muted">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 rounded-xl border border-muted text-xs font-sans text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!selectedFile || isUploading}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-medium text-xs font-sans transition-colors cursor-pointer shadow-xs"
                >
                  {isUploading ? "Storing in Vault..." : "Store Offline"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: IN-APP DOCUMENT PREVIEWER */}
      {previewDoc && previewUrl && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={handleClosePreview}
          className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/75 backdrop-blur-xs animate-fade-in overscroll-contain"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-4xl h-[92vh] flex flex-col rounded-3xl border border-muted bg-surface shadow-2xl overflow-hidden"
          >
            {/* Previewer Header */}
            <div className="flex items-center justify-between p-3 sm:p-4 border-b border-muted bg-background/80 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shrink-0">
                  {previewDoc.fileType}
                </span>
                <span className="text-xs sm:text-sm font-semibold text-foreground truncate">
                  {previewDoc.title}
                </span>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {previewDoc.fileType === "IMAGE" && (
                  <>
                    <button
                      type="button"
                      onClick={() => setZoomLevel((z) => Math.max(0.5, z - 0.25))}
                      className="p-1.5 rounded-lg bg-surface border border-muted text-muted-foreground hover:text-foreground cursor-pointer"
                      title="Zoom Out"
                    >
                      <ZoomOut className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-[10px] font-mono text-muted-foreground px-1">
                      {Math.round(zoomLevel * 100)}%
                    </span>
                    <button
                      type="button"
                      onClick={() => setZoomLevel((z) => Math.min(3, z + 0.25))}
                      className="p-1.5 rounded-lg bg-surface border border-muted text-muted-foreground hover:text-foreground cursor-pointer"
                      title="Zoom In"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}

                <button
                  type="button"
                  onClick={() => handleDownloadDoc(previewDoc)}
                  className="p-1.5 rounded-lg bg-surface border border-muted text-muted-foreground hover:text-foreground cursor-pointer"
                  title="Download File"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={handleClosePreview}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
                  title="Close Preview"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Preview Canvas */}
            <div className="flex-1 bg-black/40 overflow-auto flex items-center justify-center p-2 sm:p-4">
              {previewDoc.fileType === "IMAGE" ? (
                <div className="overflow-auto max-w-full max-h-full flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewUrl}
                    alt={previewDoc.title}
                    style={{ transform: `scale(${zoomLevel})`, transformOrigin: "center center" }}
                    className="max-h-[80vh] w-auto object-contain rounded transition-transform duration-150"
                  />
                </div>
              ) : (
                <iframe
                  src={previewUrl}
                  title={previewDoc.title}
                  className="w-full h-full rounded border-0 bg-white"
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DELETE BOOKING CONFIRMATION */}
      {deleteBookingCandidate && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setDeleteBookingCandidate(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-w-sm w-full p-6 rounded-3xl border border-muted bg-surface shadow-2xl space-y-4"
          >
            <div className="space-y-1">
              <h3 className="font-display text-lg text-foreground font-normal">
                Delete Booking?
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Are you sure you want to delete &ldquo;{deleteBookingCandidate.title}&rdquo;?
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-muted">
              <button
                type="button"
                onClick={() => setDeleteBookingCandidate(null)}
                className="px-3.5 py-2 rounded-xl border border-muted text-xs font-sans text-muted-foreground hover:text-foreground cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteBooking}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-sans font-medium transition-colors cursor-pointer"
              >
                Delete Booking
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DELETE DOCUMENT CONFIRMATION */}
      {deleteDocCandidate && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setDeleteDocCandidate(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-w-sm w-full p-6 rounded-3xl border border-muted bg-surface shadow-2xl space-y-4"
          >
            <div className="space-y-1">
              <h3 className="font-display text-lg text-foreground font-normal">
                Delete Document?
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Remove &ldquo;{deleteDocCandidate.title}&rdquo; from device offline storage?
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-muted">
              <button
                type="button"
                onClick={() => setDeleteDocCandidate(null)}
                className="px-3.5 py-2 rounded-xl border border-muted text-xs font-sans text-muted-foreground hover:text-foreground cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteDoc}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-sans font-medium transition-colors cursor-pointer"
              >
                Delete Document
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
