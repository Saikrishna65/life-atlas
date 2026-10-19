"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, BookOpen, ArrowUpRight } from "lucide-react";

export default function SecretDashboard() {
  const router = useRouter();

  const handleBackToPublic = () => {
    router.push("/");
  };

  return (
    <div className="max-w-2xl mx-auto space-y-10 sm:space-y-12 animate-fade-in pt-2 sm:pt-4">
      {/* Quiet Top Navigation */}
      <nav className="flex items-center justify-between border-b border-white/[0.08] pb-5">
        <button
          onClick={handleBackToPublic}
          className="group inline-flex items-center gap-2 text-xs font-sans tracking-wide text-neutral-400 hover:text-[#f5f2eb] transition-colors py-1.5"
          aria-label="Back to Public Atlas"
        >
          <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" />
          <span>Return to Atlas</span>
        </button>

        <span className="text-[10px] font-sans tracking-[0.2em] uppercase text-neutral-500 select-none">
          Private Journal
        </span>
      </nav>

      {/* Editorial Header */}
      <header className="space-y-3">
        <h1 className="font-display text-4xl sm:text-5xl text-[#f5f2eb] font-normal tracking-tight">
          Private Atlas
        </h1>
        <p className="font-body text-neutral-400 text-sm sm:text-base leading-relaxed">
          Your personal sanctuary for documenting expeditions, cataloguing visual memories, and quietly expanding your archive.
        </p>
      </header>

      {/* Primary Feature Card: Creator Studio */}
      <section>
        <Link
          href="/secret/studio"
          className="group block relative rounded-2xl border border-white/[0.08] bg-[#0c0f16] p-6 sm:p-7 hover:border-amber-400/30 hover:bg-[#0f131c] transition-all duration-300 shadow-xl overflow-hidden active:scale-[0.99]"
        >
          {/* Subtle warm glow accent */}
          <div
            className="absolute inset-0 bg-gradient-to-br from-amber-500/[0.03] via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
            aria-hidden="true"
          />

          <div className="relative z-10 flex flex-col gap-6">
            <div className="flex items-start justify-between gap-4">
              <div className="w-11 h-11 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-center text-amber-300/90 group-hover:scale-105 group-hover:bg-amber-400/10 transition-all duration-300 shrink-0">
                <BookOpen className="w-5 h-5" />
              </div>

              <span className="inline-flex items-center gap-1.5 text-xs font-sans tracking-wider uppercase text-amber-300/90 group-hover:text-amber-200 transition-colors pt-1">
                <span>Open Studio</span>
                <ArrowUpRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </span>
            </div>

            <div className="space-y-1.5">
              <h2 className="font-display text-2xl sm:text-3xl text-[#f5f2eb] group-hover:text-amber-200 transition-colors font-normal tracking-tight">
                Creator Studio
              </h2>
              <p className="font-body text-neutral-400 text-xs sm:text-sm leading-relaxed max-w-lg">
                Log journeys, record visited lands, archive photographs, and sequence memories directly in your database.
              </p>
            </div>
          </div>
        </Link>
      </section>
    </div>
  );
}
