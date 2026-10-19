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
      <nav className="flex items-center justify-between border-b border-muted pb-4 sm:pb-5">
        <button
          onClick={handleBackToPublic}
          className="group inline-flex items-center gap-2 text-xs font-sans tracking-wide text-muted-foreground hover:text-foreground transition-colors py-1.5"
          aria-label="Back to Public Atlas"
        >
          <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" />
          <span>Return to Atlas</span>
        </button>

        <span className="text-[10px] font-sans tracking-[0.2em] uppercase text-muted-foreground/80 select-none">
          Private Journal
        </span>
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

      {/* Primary Feature Card: Creator Studio */}
      <section>
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
                Log journeys, record visited lands, archive photographs, and sequence memories directly in your database.
              </p>
            </div>
          </div>
        </Link>
      </section>
    </div>
  );
}
