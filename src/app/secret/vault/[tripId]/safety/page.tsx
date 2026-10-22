"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function SafetyPillarRetiredPage() {
  const params = useParams();
  const router = useRouter();
  const tripId = params.tripId as string;

  useEffect(() => {
    if (tripId) {
      router.replace(`/secret/vault/${tripId}`);
    }
  }, [tripId, router]);

  return (
    <div className="max-w-md mx-auto py-24 text-center space-y-4">
      <h2 className="font-display text-2xl text-foreground font-normal">
        Section Retired
      </h2>
      <p className="font-body text-xs text-muted-foreground leading-relaxed">
        Pillar 10 has been decommissioned from the Expedition Vault. Redirecting back to your command center...
      </p>
      <div className="pt-2">
        <Link
          href={`/secret/vault/${tripId}`}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-surface border border-muted hover:border-foreground/30 text-xs font-sans text-foreground transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Return to Expedition Command Center</span>
        </Link>
      </div>
    </div>
  );
}
