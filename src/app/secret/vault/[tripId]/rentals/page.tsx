"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, ShieldAlert } from "lucide-react";

export default function TripRentalsPage() {
  const params = useParams();
  const router = useRouter();
  const tripId = typeof params?.tripId === "string" ? params.tripId : "";

  // Auto redirect to Command Center
  useEffect(() => {
    if (tripId) {
      const timer = setTimeout(() => {
        router.replace(`/secret/vault/${tripId}`);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [tripId, router]);

  return (
    <div className="max-w-md mx-auto py-24 text-center space-y-5 animate-fade-in px-4">
      <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center mx-auto">
        <CheckCircle2 className="w-7 h-7 text-amber-500" />
      </div>

      <div className="space-y-2">
        <h2 className="font-display text-2xl text-foreground font-normal">
          Rentals Module Decommissioned
        </h2>
        <p className="font-body text-xs text-muted-foreground leading-relaxed">
          Vehicle rental tracking has been removed from the Trip Vault. Managing all tickets, trains, stays, and transport is now consolidated under Bookings & Document Vault.
        </p>
      </div>

      <div className="pt-2">
        <Link
          href={`/secret/vault/${tripId}`}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent hover:bg-accent/90 text-white font-medium text-xs font-sans transition-colors shadow-xs"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Return to Trip Command Center</span>
        </Link>
      </div>
    </div>
  );
}
