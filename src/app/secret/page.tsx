"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, BookOpen, ArrowUpRight, Lock, Compass } from "lucide-react";
import { revokeSecretAccess } from "@/lib/deviceAuth";

export default function SecretDashboard() {
  const router = useRouter();

  const handleBackToPublic = () => {
    router.push("/");
  };

  const handleLockVault = () => {
    revokeSecretAccess();
    router.push("/");
  };

  return (
    <div className="max-w-2xl mx-auto space-y-10 sm:space-y-12 animate-fade-in pt-2 sm:pt-4">
      {/* Quiet Top Navigation */}
      <nav className="flex items-center justify-between border-b border-muted pb-4 sm:pb-5">
        <button
          onClick={handleBackToPublic}
          className="group inline-flex items-center gap-2 text-xs font-sans tracking-wide text-muted-foreground hover:text-foreground transition-colors py-1.5"
          aria-label="Back to Public Atlas"
        >
          <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" />
          <span>Return to Atlas</span>
        </button>

        <div className="flex items-center gap-4">
          <span className="text-[10px] font-sans tracking-[0.2em] uppercase text-muted-foreground/80 select-none">
            Private Journal
          </span>
          <button
            onClick={handleLockVault}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-muted hover:border-foreground/30 text-[11px] font-sans text-muted-foreground hover:text-foreground transition-colors"
            title="Lock Private Atlas and revoke session"
          >
            <Lock className="w-3 h-3 text-amber-500" />
            <span>Lock</span>
          </button>
        </div>
      </nav>

      {/* Editorial Header */}
      <header className="space-y-3">
        <h1 className="font-display text-4xl sm:text-5xl text-foreground font-normal tracking-tight">
          Private Atlas
        </h1>
        <p className="font-body text-muted-foreground text-sm sm:text-base leading-relaxed">
          Your personal sanctuary for documenting expeditions, cataloguing visual memories, and quietly expanding your archive.
        </p>
      </header>

      {/* Primary Feature Cards Grid: Trip Vault & Creator Studio */}
      <section className="grid grid-cols-1 gap-6">
        {/* Card 1: Trip Vault (Offline Travel Command Center) */}
        <Link
          href="/secret/vault"
          className="group block relative rounded-2xl border border-amber-500/20 bg-surface hover:bg-surface-hover/80 hover:border-amber-400/40 p-6 sm:p-7 transition-all duration-300 shadow-soft overflow-hidden active:scale-[0.99] ring-1 ring-amber-400/10"
        >
          {/* Subtle Golden Ambient Wash */}
          <div
            className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none group-hover:bg-amber-500/10 transition-colors"
            aria-hidden="true"
          />

          <div className="relative z-10 flex flex-col gap-6">
            <div className="flex items-start justify-between gap-4">
              <div className="w-11 h-11 rounded-xl bg-background border border-amber-500/30 flex items-center justify-center text-amber-500 group-hover:scale-105 group-hover:border-amber-400/60 group-hover:bg-amber-500/10 transition-all duration-300 shrink-0 shadow-xs">
                <Compass className="w-5 h-5 text-amber-500" />
              </div>

              <div className="flex items-center gap-2">
                <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-[10px] font-mono uppercase tracking-wider text-amber-400 font-semibold">
                  Offline Command
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs font-sans tracking-wider uppercase text-amber-500 font-semibold group-hover:text-amber-400 transition-colors pt-1">
                  <span>Enter Vault</span>
                  <ArrowUpRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <h2 className="font-display text-2xl sm:text-3xl text-foreground group-hover:text-amber-500 transition-colors font-normal tracking-tight">
                Trip Vault
              </h2>
              <p className="font-body text-muted-foreground text-xs sm:text-sm leading-relaxed max-w-lg">
                Your offline travel command center for live itineraries, transport tickets, PNRs, stay vouchers, bike rentals, gear checklists, and expense tracking.
              </p>
            </div>
          </div>
        </Link>

        {/* Card 2: Creator Studio (Public Inscriptions) */}
        <Link
          href="/secret/studio"
          className="group block relative rounded-2xl border border-muted bg-surface hover:bg-surface-hover/70 hover:border-foreground/20 p-6 sm:p-7 transition-all duration-300 shadow-soft overflow-hidden active:scale-[0.99]"
        >
          <div className="relative z-10 flex flex-col gap-6">
            <div className="flex items-start justify-between gap-4">
              <div className="w-11 h-11 rounded-xl bg-background border border-muted flex items-center justify-center text-accent group-hover:scale-105 group-hover:border-accent/40 group-hover:bg-accent/5 transition-all duration-300 shrink-0 shadow-xs">
                <BookOpen className="w-5 h-5 text-accent" />
              </div>

              <span className="inline-flex items-center gap-1.5 text-xs font-sans tracking-wider uppercase text-accent font-semibold group-hover:text-accent/80 transition-colors pt-1">
                <span>Open Studio</span>
                <ArrowUpRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </span>
            </div>

            <div className="space-y-1.5">
              <h2 className="font-display text-2xl sm:text-3xl text-foreground group-hover:text-accent transition-colors font-normal tracking-tight">
                Creator Studio
              </h2>
              <p className="font-body text-muted-foreground text-xs sm:text-sm leading-relaxed max-w-lg">
                Log journeys, record visited lands, archive photographs, and sequence memories directly in your public database.
              </p>
            </div>
          </div>
        </Link>
      </section>
    </div>
  );
}
