"use client";

import dynamic from "next/dynamic";

const HeroScene = dynamic(() => import("./hero/HeroScene"), {
  ssr: false,
  loading: () => (
    <div 
      className="absolute inset-0 w-full h-full"
      style={{
        background: "linear-gradient(180deg, #1d4372 0%, #3e6ea7 26%, #7aa5d6 52%, #b5d1ed 74%, #e2eef7 100%)",
      }}
    />
  ),
});

export default function Hero() {
  return (
    <section 
      className="relative h-screen w-full flex flex-col justify-between overflow-hidden bg-background text-foreground"
      aria-label="Life Atlas Hero"
    >
      {/* 3D Foreground Scene */}
      <div className="absolute inset-0 z-0">
        <HeroScene />
      </div>

      {/* Spacer to keep bottom scroll indicator pinned cleanly */}
      <div className="relative z-10 pointer-events-none flex-1" />

      {/* Bottom Scroll Prompt */}
      <div className="relative z-10 pointer-events-none pb-6 flex flex-col items-center gap-2">
        <span className="font-sans text-[10px] uppercase tracking-[0.3em] text-white/80 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] font-semibold">
          Scroll to explore
        </span>
        <div className="w-[1px] h-8 bg-white/50 shadow-sm" />
      </div>
    </section>
  );
}
