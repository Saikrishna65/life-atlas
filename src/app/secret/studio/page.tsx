"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Studio from "@/app/admin/Studio";

export default function SecretStudioPage() {
  const router = useRouter();

  const handleBackToSecretHome = () => {
    router.push("/secret");
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-fade-in pt-2 sm:pt-4">
      {/* Quiet Top Navigation */}
      <nav className="flex items-center justify-between border-b border-muted pb-4 sm:pb-5">
        <button
          onClick={handleBackToSecretHome}
          className="group inline-flex items-center gap-2 text-xs font-sans tracking-wide text-muted-foreground hover:text-foreground transition-colors py-1.5"
          aria-label="Back to Private Atlas"
        >
          <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" />
          <span>Private Atlas</span>
        </button>

        <span className="text-[10px] font-sans tracking-[0.2em] uppercase text-muted-foreground/80 select-none">
          Chronicle Studio
        </span>
      </nav>

      {/* Editorial Header */}
      <header className="space-y-2">
        <h1 className="font-display text-3xl sm:text-4xl text-foreground font-normal tracking-tight">
          Creator Studio
        </h1>
        <p className="font-body text-muted-foreground text-xs sm:text-sm max-w-lg leading-relaxed">
          Document expeditions, pin destinations, archive visual impressions, and inscribe reflections.
        </p>
      </header>

      {/* Mobile-First Editorial Travel Journal Studio */}
      <div className="w-full">
        <Studio variant="journal" />
      </div>
    </div>
  );
}
