"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  FileText,
  Upload,
  Trash2,
  Eye,
  Download,
  Link2,
  ShieldCheck,
  Lock,
  File,
  Image as ImageIcon,
  AlertCircle,
  X,
  ZoomIn,
  ZoomOut,
  Ticket,
} from "lucide-react";
import { getTrip, getBookingsForTrip } from "@/lib/vault/storage";
import { useDocuments } from "@/lib/vault/useDocuments";
import {
  TripRecord,
  BookingRecord,
  DocumentAttachmentRecord,
} from "@/lib/vault/types";
import { revokeSecretAccess } from "@/lib/deviceAuth";
import { useLockBodyScroll } from "@/lib/vault/useLockBodyScroll";
import { Select } from "@/components/ui/Select";

type DocTabFilter = "ALL" | "PDF" | "IMAGE";

export default function TripDocumentsPage() {
  const params = useParams();
  const router = useRouter();
  const tripId = params.tripId as string;

  const [trip, setTrip] = useState<TripRecord | null>(null);
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [isTripLoading, setIsTripLoading] = useState(true);

  const {
    documents,
    isLoading: isDocsLoading,
    stats,
    uploadDocument,
    removeDocument,
    updateDocumentMeta,
  } = useDocuments(tripId);

  const [activeTab, setActiveTab] = useState<DocTabFilter>("ALL");
  const [selectedBookingFilter, setSelectedBookingFilter] = useState<string>("ALL");

  // Upload modal state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadTitle, setUploadTitle] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [associatedBookingId, setAssociatedBookingId] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Previewer modal state (REQ-DOC-02)
  const [previewDoc, setPreviewDoc] = useState<DocumentAttachmentRecord | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  // Link booking modal state (REQ-DOC-03)
  const [linkingDoc, setLinkingDoc] = useState<DocumentAttachmentRecord | null>(null);
  const [targetBookingId, setTargetBookingId] = useState<string>("");

  // Delete modal state
  const [deleteCandidate, setDeleteCandidate] = useState<DocumentAttachmentRecord | null>(null);

  // Lock body scroll when any modal or previewer is open
  useLockBodyScroll(showUploadModal || !!previewDoc || !!linkingDoc || !!deleteCandidate);

  // Load trip and bookings
  useEffect(() => {
    let mounted = true;
    if (!tripId) return;

    (async () => {
      try {
        const [tripData, bookingsData] = await Promise.all([
          getTrip(tripId),
          getBookingsForTrip(tripId),
        ]);
        if (mounted) {
          setTrip(tripData);
          setBookings(bookingsData);
        }
      } catch (err) {
        console.error("Failed loading trip & bookings:", err);
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

  // Open previewer and create Object URL (REQ-DOC-02)
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
      console.error("Failed creating blob URL for preview:", err);
    }
  };

  // Close previewer and revoke Object URL
  const handleClosePreview = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setPreviewDoc(null);
    setZoomLevel(1);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  // Lock vault session
  const handleLockVault = () => {
    revokeSecretAccess();
    router.push("/");
  };

  // Filtered documents
  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      if (activeTab === "PDF" && doc.fileType !== "PDF") return false;
      if (activeTab === "IMAGE" && doc.fileType !== "IMAGE") return false;
      if (selectedBookingFilter !== "ALL" && doc.bookingId !== selectedBookingFilter) return false;
      return true;
    });
  }, [documents, activeTab, selectedBookingFilter]);

  // Format bytes helper
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  // File selection handler
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

  // Upload handler
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

  // Download document
  const handleDownload = (doc: DocumentAttachmentRecord) => {
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

  // Link booking submit
  const handleSaveLinking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkingDoc) return;

    try {
      await updateDocumentMeta({
        ...linkingDoc,
        bookingId: targetBookingId || undefined,
      });
      setLinkingDoc(null);
    } catch (err) {
      console.error("Failed linking document:", err);
    }
  };

  // Delete confirm
  const handleConfirmDelete = async () => {
    if (!deleteCandidate) return;
    try {
      await removeDocument(deleteCandidate.id);
      setDeleteCandidate(null);
    } catch (err) {
      console.error("Failed deleting document:", err);
    }
  };

  if (isTripLoading || isDocsLoading) {
    return (
      <div className="max-w-4xl mx-auto py-24 text-center text-xs font-mono text-muted-foreground flex items-center justify-center gap-2">
        <div className="w-4 h-4 rounded-full border border-muted border-t-amber-500 animate-spin" />
        <span>Loading offline document vault...</span>
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
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-[11px] font-mono tracking-wider text-indigo-400 font-semibold uppercase">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
            <span>Document Vault</span>
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

      {/* HEADER & METRICS BANNER */}
      <header className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-widest text-indigo-400 font-semibold">
              Pillar 04 • Offline Document Vault
            </span>
            <h1 className="font-display text-3xl sm:text-4xl text-foreground font-normal tracking-tight mt-1">
              Offline Tickets & Attachments
            </h1>
            <p className="font-body text-xs sm:text-sm text-muted-foreground mt-1">
              IRCTC PDFs, flight boarding passes, hotel vouchers, and ID copies stored as raw binary blobs in local storage.
            </p>
          </div>

          <button
            onClick={() => setShowUploadModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-400 hover:to-indigo-500 text-white font-semibold text-xs font-sans tracking-wide shadow-soft transition-all active:scale-[0.98] shrink-0"
          >
            <Upload className="w-4 h-4" />
            <span>Upload Document</span>
          </button>
        </div>

        {/* METRICS BANNER */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-2xl border border-muted bg-surface/80 shadow-soft">
          <div className="p-3 rounded-xl bg-background border border-muted/50">
            <span className="text-[10px] font-mono uppercase text-muted-foreground tracking-wider block">
              Total Documents
            </span>
            <span className="text-base font-semibold font-mono text-foreground mt-0.5 block">
              {stats.totalCount} Cached
            </span>
          </div>

          <div className="p-3 rounded-xl bg-background border border-muted/50">
            <span className="text-[10px] font-mono uppercase text-muted-foreground tracking-wider block">
              PDF Tickets
            </span>
            <span className="text-base font-semibold font-mono text-indigo-400 mt-0.5 block">
              {stats.pdfCount} Documents
            </span>
          </div>

          <div className="p-3 rounded-xl bg-background border border-muted/50">
            <span className="text-[10px] font-mono uppercase text-muted-foreground tracking-wider block">
              Image Screenshots
            </span>
            <span className="text-base font-semibold font-mono text-emerald-400 mt-0.5 block">
              {stats.imageCount} Passes
            </span>
          </div>

          <div className="p-3 rounded-xl bg-background border border-muted/50">
            <span className="text-[10px] font-mono uppercase text-muted-foreground tracking-wider block">
              Offline Cache Size
            </span>
            <span className="text-base font-semibold font-mono text-amber-400 mt-0.5 block">
              {formatBytes(stats.totalBytes)}
            </span>
          </div>
        </div>
      </header>

      {/* FILTER TABS & BOOKING SELECTOR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Type tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-surface border border-muted rounded-xl text-xs overflow-x-auto [scrollbar-width:none]">
          {(
            [
              { id: "ALL", label: `All Files (${stats.totalCount})` },
              { id: "PDF", label: `PDFs (${stats.pdfCount})` },
              { id: "IMAGE", label: `Images (${stats.imageCount})` },
            ] as { id: DocTabFilter; label: string }[]
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded-lg transition-all whitespace-nowrap select-none ${
                activeTab === tab.id
                  ? "bg-background text-foreground border border-muted shadow-xs font-medium"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Booking Association filter */}
        {bookings.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-muted-foreground shrink-0">Filter by Booking:</span>
            <Select
              value={selectedBookingFilter}
              onChange={(e) => setSelectedBookingFilter(e.target.value)}
              className="text-xs"
            >
              <option value="ALL">All Bookings</option>
              {bookings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.title} ({b.type})
                </option>
              ))}
            </Select>
          </div>
        )}
      </div>

      {/* DOCUMENTS GRID */}
      {filteredDocuments.length === 0 ? (
        <div className="p-12 rounded-3xl border border-muted border-dashed bg-surface/40 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto">
            <FileText className="w-6 h-6 text-indigo-400" />
          </div>
          <h3 className="font-display text-lg text-foreground font-normal">
            No offline documents found
          </h3>
          <p className="font-body text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
            Attach PDF e-tickets, IRCTC boarding passes, passport/ID scans, and hotel vouchers. They will remain 100% accessible in airplane mode.
          </p>
          <button
            onClick={() => setShowUploadModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-medium text-xs font-sans transition-colors"
          >
            <Upload className="w-4 h-4" />
            <span>Upload Document</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredDocuments.map((doc) => {
            const linkedBooking = bookings.find((b) => b.id === doc.bookingId);
            const isPDF = doc.fileType === "PDF";
            const isImage = doc.fileType === "IMAGE";

            return (
              <div
                key={doc.id}
                className="group rounded-2xl border border-muted bg-surface hover:border-foreground/20 p-4 sm:p-5 transition-all duration-200 shadow-soft flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      {/* Document Thumbnail / Icon */}
                      {isImage && doc.thumbnailDataUrl ? (
                        <div className="w-12 h-12 rounded-xl overflow-hidden border border-muted bg-background shrink-0">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={doc.thumbnailDataUrl}
                            alt={doc.title}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div
                          className={`w-12 h-12 rounded-xl border flex items-center justify-center shrink-0 ${
                            isPDF
                              ? "bg-rose-500/10 border-rose-500/20 text-rose-400"
                              : "bg-indigo-500/10 border-indigo-500/20 text-indigo-400"
                          }`}
                        >
                          {isPDF ? (
                            <FileText className="w-6 h-6" />
                          ) : isImage ? (
                            <ImageIcon className="w-6 h-6" />
                          ) : (
                            <File className="w-6 h-6" />
                          )}
                        </div>
                      )}

                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`text-[9px] font-mono uppercase tracking-wider px-2 py-0.5 rounded font-bold border ${
                              isPDF
                                ? "bg-rose-500/15 border-rose-500/30 text-rose-400"
                                : isImage
                                ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                                : "bg-muted border-muted text-muted-foreground"
                            }`}
                          >
                            {doc.fileType}
                          </span>
                          <span className="text-[10px] font-mono text-muted-foreground">
                            {formatBytes(doc.sizeBytes)}
                          </span>
                        </div>

                        <h3 className="font-display text-base text-foreground font-normal tracking-tight line-clamp-1 group-hover:text-indigo-400 transition-colors">
                          {doc.title}
                        </h3>

                        <p className="text-[11px] font-mono text-muted-foreground/80 line-clamp-1">
                          {doc.fileName}
                        </p>
                      </div>
                    </div>

                    {/* Delete button */}
                    <button
                      onClick={() => setDeleteCandidate(doc)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-400 hover:bg-background transition-colors"
                      title="Delete document"
                      aria-label="Delete document"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Association Badge (REQ-DOC-03) */}
                  {linkedBooking ? (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-background border border-muted text-[11px] font-sans text-cyan-400">
                      <Ticket className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      <span className="truncate">Linked to: {linkedBooking.title}</span>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setLinkingDoc(doc);
                        setTargetBookingId("");
                      }}
                      className="inline-flex items-center gap-1 text-[11px] font-sans text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Link2 className="w-3 h-3 text-muted-foreground" />
                      <span>Link to transport or hotel booking</span>
                    </button>
                  )}
                </div>

                {/* Footer Actions: View Offline & Download */}
                <div className="pt-2.5 border-t border-muted/50 flex items-center justify-between gap-2">
                  <button
                    onClick={() => handleOpenPreview(doc)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 text-indigo-300 font-medium text-xs font-sans transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5 text-indigo-400" />
                    <span>View Offline</span>
                  </button>

                  <button
                    onClick={() => handleDownload(doc)}
                    className="p-1.5 rounded-xl bg-background border border-muted hover:border-foreground/30 text-muted-foreground hover:text-foreground transition-colors"
                    title="Export / Download"
                    aria-label="Download document"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}      {/* MODAL: UPLOAD DOCUMENT */}
      {showUploadModal && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setShowUploadModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in overscroll-contain"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-w-md w-full p-6 rounded-2xl border border-muted bg-surface shadow-2xl space-y-4"
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
              {/* File Dropzone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="p-6 rounded-2xl border border-dashed border-accent/40 hover:border-accent bg-background/50 hover:bg-accent/5 text-center cursor-pointer transition-colors space-y-2"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".pdf,image/png,image/jpeg,image/webp"
                  className="hidden"
                />

                <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/20 text-accent flex items-center justify-center mx-auto">
                  <Upload className="w-5 h-5 text-accent" />
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

              {/* Title */}
              <div className="space-y-1">
                <label className="text-xs font-sans font-medium text-foreground">
                  Document Label / Title *
                </label>
                <input
                  type="text"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder="e.g. IRCTC Train 12011 E-Ticket PDF"
                  className="w-full px-3 py-2 rounded-xl bg-background border border-muted focus:border-accent focus:outline-hidden text-xs text-foreground"
                  required
                />
              </div>

              {/* Link Booking Optional (REQ-DOC-03) */}
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
                  className="px-3.5 py-2 rounded-xl border border-muted text-xs font-sans text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!selectedFile || isUploading}
                  className="px-5 py-2 rounded-xl bg-accent hover:bg-accent/90 disabled:opacity-40 text-white font-medium text-xs font-sans transition-colors cursor-pointer shadow-xs"
                >
                  {isUploading ? "Storing in Vault..." : "Store Offline"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: IN-APP DOCUMENT PREVIEWER (REQ-DOC-02) */}
      {previewDoc && previewUrl && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={handleClosePreview}
          className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/75 backdrop-blur-xs animate-fade-in overscroll-contain"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-4xl h-[92vh] flex flex-col rounded-2xl border border-muted bg-surface shadow-2xl overflow-hidden"
          >
            {/* Previewer Header */}
            <div className="flex items-center justify-between p-3 sm:p-4 border-b border-muted bg-background/80 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded font-bold bg-accent/10 border border-accent/20 text-accent shrink-0">
                  {previewDoc.fileType}
                </span>
                <span className="text-xs sm:text-sm font-semibold text-foreground truncate">
                  {previewDoc.title}
                </span>
              </div>

              {/* Controls */}
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
                  onClick={() => handleDownload(previewDoc)}
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
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Previewer Content */}
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-black/40">
              {previewDoc.fileType === "PDF" ? (
                <iframe
                  src={previewUrl}
                  title={previewDoc.title}
                  className="w-full h-full rounded-xl border border-muted bg-white"
                />
              ) : previewDoc.fileType === "IMAGE" ? (
                <div className="overflow-auto max-h-full max-w-full flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewUrl}
                    alt={previewDoc.title}
                    style={{ transform: `scale(${zoomLevel})`, transformOrigin: "center center" }}
                    className="max-h-full max-w-full object-contain rounded-xl transition-transform duration-150"
                  />
                </div>
              ) : (
                <div className="text-center space-y-3">
                  <File className="w-12 h-12 text-muted-foreground mx-auto" />
                  <p className="text-xs text-muted-foreground">
                    This file format cannot be rendered in-app.
                  </p>
                  <button
                    type="button"
                    onClick={() => handleDownload(previewDoc)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent text-white text-xs font-sans cursor-pointer shadow-xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download to Device</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: LINK BOOKING (REQ-DOC-03) */}
      {linkingDoc && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setLinkingDoc(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in overscroll-contain"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-w-md w-full p-6 rounded-2xl border border-muted bg-surface shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-muted pb-3">
              <h3 className="font-display text-lg text-foreground font-normal">
                Link Document to Booking
              </h3>
              <button
                type="button"
                onClick={() => setLinkingDoc(null)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveLinking} className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Associate <strong className="text-foreground">{linkingDoc.title}</strong> directly with a transport ticket or hotel stay.
              </p>

              <div className="space-y-1">
                <label className="text-xs font-sans font-medium text-foreground">
                  Select Booking
                </label>
                <Select
                  value={targetBookingId}
                  onChange={(e) => setTargetBookingId(e.target.value)}
                >
                  <option value="">No Association (Unlink)</option>
                  {bookings.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.title} ({b.type})
                    </option>
                  ))}
                </Select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-muted">
                <button
                  type="button"
                  onClick={() => setLinkingDoc(null)}
                  className="px-3.5 py-2 rounded-xl border border-muted text-xs font-sans text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-accent hover:bg-accent/90 text-white font-medium text-xs font-sans transition-colors cursor-pointer shadow-xs"
                >
                  Save Link
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
              Delete Document?
            </h3>
            <p className="font-body text-xs text-muted-foreground leading-relaxed">
              Are you sure you want to permanently delete <strong className="text-foreground">{deleteCandidate.title}</strong>? It will be removed from your offline vault.
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
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
