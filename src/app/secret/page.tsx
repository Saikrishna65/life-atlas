"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  ArrowLeft, 
  SlidersHorizontal, 
  Compass, 
  Lock, 
  Sparkles, 
  ShieldCheck, 
  ArrowUpRight 
} from "lucide-react";

export default function SecretDashboard() {
  const router = useRouter();

  const handleBackToPublic = () => {
    router.push("/");
  };

  return (
    <div className="max-w-6xl mx-auto space-y-12 animate-fade-in">
      {/* Top Navigation Bar */}
      <nav className="flex items-center justify-between border-b border-white/10 pb-6">
        <button
          onClick={handleBackToPublic}
          className="group inline-flex items-center gap-2.5 px-4 py-2 rounded-full border border-white/10 bg-white/[0.03] text-sm text-neutral-300 hover:text-white hover:bg-white/[0.08] hover:border-white/20 transition-all duration-200"
          aria-label="Back to Public Atlas"
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
          <span className="font-sans tracking-wider uppercase text-xs">Public Atlas</span>
        </button>

        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-300 text-[11px] font-sans uppercase tracking-widest">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>Private Vault • App Mode</span>
        </div>
      </nav>

      {/* Hero Header */}
      <header className="space-y-4 pt-2">
        <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-amber-400/90 font-mono">
          <ShieldCheck className="w-4 h-4 text-amber-400" />
          <span>Restricted Portal</span>
        </div>
        <h1 className="font-display text-4xl sm:text-6xl md:text-7xl tracking-tight text-white font-normal">
          Private Atlas
        </h1>
        <p className="font-body text-neutral-400 text-base sm:text-lg max-w-2xl leading-relaxed">
          Your secluded personal sanctuary. Curate journeys, publish expedition media, log memories, and access existing control studio tools directly within the mobile app.
        </p>
      </header>

      {/* Active Modules Grid */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="font-sans text-xs uppercase tracking-[0.2em] text-neutral-400 font-semibold">
            Active Control Modules
          </h2>
          <span className="text-xs text-neutral-500 font-mono">1 Available</span>
        </div>

        {/* Primary Feature Card: Admin Studio */}
        <Link
          href="/secret/studio"
          className="group block relative rounded-2xl border border-white/15 bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-6 sm:p-8 hover:border-amber-400/50 hover:bg-white/[0.08] transition-all duration-300 shadow-xl"
        >
          {/* Subtle glow highlight on hover */}
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-amber-500/10 via-transparent to-amber-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-start gap-5">
              <div className="w-12 h-12 rounded-xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center text-amber-300 shrink-0 group-hover:scale-105 group-hover:bg-amber-400/20 transition-all duration-300">
                <SlidersHorizontal className="w-6 h-6" />
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <h3 className="font-display text-2xl sm:text-3xl text-white group-hover:text-amber-200 transition-colors">
                    Admin Studio
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider bg-amber-400/15 text-amber-300 border border-amber-400/30">
                    Live
                  </span>
                </div>
                <p className="font-body text-neutral-400 text-sm sm:text-base max-w-xl leading-relaxed">
                  Full trip creation, destination mapping, photo cataloguing, memory journaling, and timeline sequencing powered by your existing studio backend.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start md:self-center px-5 py-3 rounded-xl bg-white/10 border border-white/20 text-white font-sans text-xs uppercase tracking-widest group-hover:bg-amber-400 group-hover:text-black group-hover:border-amber-400 transition-all duration-300 shrink-0">
              <span>Open Studio</span>
              <ArrowUpRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </div>
          </div>
        </Link>
      </section>

      {/* Future Sections (Empty State / Upcoming Modules Placeholder) */}
      <section className="space-y-6 pt-4 border-t border-white/10">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h2 className="font-sans text-xs uppercase tracking-[0.2em] text-neutral-400 font-semibold">
              Future Personal Modules
            </h2>
            <p className="text-xs text-neutral-500 font-body">
              Planned personal expansions. Unlocking in upcoming phases.
            </p>
          </div>
          <span className="text-xs text-neutral-500 font-mono">Phase 2+</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Future Card 1 */}
          <div className="rounded-xl border border-white/5 bg-white/[0.015] p-5 space-y-3 relative overflow-hidden opacity-60">
            <div className="flex items-center justify-between text-neutral-500">
              <Compass className="w-5 h-5" />
              <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider bg-white/5 px-2 py-0.5 rounded-full">
                <Lock className="w-3 h-3" />
                <span>Phase 2</span>
              </div>
            </div>
            <div>
              <h4 className="font-display text-lg text-neutral-300">Personal Journal</h4>
              <p className="text-xs text-neutral-500 font-body mt-1 leading-relaxed">
                Reflective daily thoughts, private musings, and inner-circle travel logs.
              </p>
            </div>
          </div>

          {/* Future Card 2 */}
          <div className="rounded-xl border border-white/5 bg-white/[0.015] p-5 space-y-3 relative overflow-hidden opacity-60">
            <div className="flex items-center justify-between text-neutral-500">
              <Sparkles className="w-5 h-5" />
              <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider bg-white/5 px-2 py-0.5 rounded-full">
                <Lock className="w-3 h-3" />
                <span>Future Phase</span>
              </div>
            </div>
            <div>
              <h4 className="font-display text-lg text-neutral-300">Private Records</h4>
              <p className="text-xs text-neutral-500 font-body mt-1 leading-relaxed">
                Confidential trip documents, personal travel vitals, and private records.
              </p>
            </div>
          </div>

          {/* Future Card 3 */}
          <div className="rounded-xl border border-white/5 bg-white/[0.015] p-5 space-y-3 relative overflow-hidden opacity-60">
            <div className="flex items-center justify-between text-neutral-500">
              <Lock className="w-5 h-5" />
              <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider bg-white/5 px-2 py-0.5 rounded-full">
                <Lock className="w-3 h-3" />
                <span>Future Phase</span>
              </div>
            </div>
            <div>
              <h4 className="font-display text-lg text-neutral-300">Confidential Vault</h4>
              <p className="text-xs text-neutral-500 font-body mt-1 leading-relaxed">
                End-to-end encrypted notes and private memory archives.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
