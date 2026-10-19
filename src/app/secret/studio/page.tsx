"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, SlidersHorizontal } from "lucide-react";
import Studio from "@/app/admin/Studio";

export default function SecretStudioPage() {
  const router = useRouter();

  const handleBackToSecretHome = () => {
    router.push("/secret");
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-fade-in">
      {/* Navigation Header */}
      <nav className="flex items-center justify-between border-b border-white/10 pb-5">
        <button
          onClick={handleBackToSecretHome}
          className="group inline-flex items-center gap-2.5 px-4 py-2 rounded-full border border-white/10 bg-white/[0.03] text-sm text-neutral-300 hover:text-white hover:bg-white/[0.08] hover:border-white/20 transition-all duration-200"
          aria-label="Back to Private Atlas"
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
          <span className="font-sans tracking-wider uppercase text-xs">Private Atlas Home</span>
        </button>

        <div className="flex items-center gap-2 text-xs font-mono text-neutral-400">
          <Link href="/secret" className="hover:text-amber-300 transition-colors">
            Private Atlas
          </Link>
          <span className="text-neutral-600">/</span>
          <span className="text-amber-300">Admin Studio</span>
        </div>
      </nav>

      {/* Page Title & Scope */}
      <header className="space-y-2">
        <div className="flex items-center gap-2.5 text-amber-400 text-xs font-mono uppercase tracking-widest">
          <SlidersHorizontal className="w-4 h-4" />
          <span>Native Creator Control</span>
        </div>
        <h1 className="font-display text-3xl sm:text-5xl text-white tracking-tight">
          Creator Studio
        </h1>
        <p className="font-body text-neutral-400 text-sm sm:text-base max-w-2xl leading-relaxed">
          Manage and expand your atlas directly from your mobile device. All changes synchronize immediately with your central database.
        </p>
      </header>

      {/* Existing Studio Component Integration */}
      <div className="w-full">
        <Studio />
      </div>
    </div>
  );
}
