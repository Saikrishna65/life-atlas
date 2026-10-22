"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, FolderArchive, ArrowRight } from "lucide-react";

export default function TripDocumentsPage() {
  const params = useParams();
  const router = useRouter();
  const tripId = params.tripId as string;

  useEffect(() => {
    if (tripId) {
      router.replace(`/secret/vault/${tripId}/bookings?tab=documents`);
    }
  }, [tripId, router]);

  return (
    <div className="max-w-xl mx-auto py-20 px-4 text-center space-y-6 animate-fade-in">
      <div className="w-16 h-16 rounded-3xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto shadow-lg shadow-indigo-500/5">
        <FolderArchive className="w-8 h-8 text-indigo-400" />
      </div>

      <div className="space-y-2">
        <span className="text-[10px] font-mono uppercase tracking-widest text-indigo-400 font-semibold">
          Unified Experience
        </span>
        <h1 className="font-display text-2xl sm:text-3xl text-foreground font-normal tracking-tight">
          Documents Merged with Bookings
        </h1>
        <p className="font-body text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-md mx-auto">
          The Offline Document Vault has been unified with Bookings &amp; Tickets into a single, comprehensive hub with direct ticket attachments.
        </p>
      </div>

      <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
        <Link
          href={`/secret/vault/${tripId}/bookings?tab=documents`}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-400 hover:to-indigo-500 text-white font-semibold text-xs font-sans tracking-wide shadow-md shadow-indigo-500/20 transition-all active:scale-[0.98]"
        >
          <span>Open Unified Bookings &amp; Documents</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
        <Link
          href={`/secret/vault/${tripId}`}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-muted bg-surface/80 hover:bg-surface text-muted-foreground hover:text-foreground text-xs font-sans transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Return to Command Center</span>
        </Link>
      </div>
    </div>
  );
}
