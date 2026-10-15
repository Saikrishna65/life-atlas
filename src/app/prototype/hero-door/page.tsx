"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import Image from "next/image";
import { Eye, Sliders, SplitSquareVertical, ArrowLeft, RotateCcw } from "lucide-react";

// Dynamically import the 3D scene without SSR
const DoorPrototypeScene = dynamic(
  () => import("@/components/home/hero-prototype/DoorPrototypeScene"),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center bg-slate-900 text-white font-sans text-sm">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          <span className="tracking-widest uppercase text-xs text-slate-400">Loading 3D Prototype...</span>
        </div>
      </div>
    ),
  }
);

export default function HeroDoorPrototypePage() {
  const [doorAngle, setDoorAngle] = useState<number>(65); // 65 deg matches reference artwork
  const [showTypography, setShowTypography] = useState<boolean>(true);
  const [compareMode, setCompareMode] = useState<"3d" | "side-by-side" | "split" | "reference">("3d");
  const [splitPos, setSplitPos] = useState<number>(50); // percentage for split slider
  const [exposure, setExposure] = useState<number>(1.05);
  const [sunIntensity, setSunIntensity] = useState<number>(2.6);
  const [showToolbar, setShowToolbar] = useState<boolean>(true);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 select-none">
      {/* ------------------------------------------------------------------- */}
      {/* 1. TOP HEADER / BACK NAVIGATION                                      */}
      {/* ------------------------------------------------------------------- */}
      <header className="absolute top-0 left-0 right-0 z-40 flex items-center justify-between px-6 py-4 bg-gradient-to-b from-black/60 to-transparent pointer-events-none">
        <div className="flex items-center gap-4 pointer-events-auto">
          <Link
            href="/"
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-sans backdrop-blur-md transition-all border border-white/10"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Production Site</span>
          </Link>
          <div className="hidden sm:flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-white/80 font-sans text-xs tracking-wider uppercase font-semibold">
              Prototype &bull; The Door to the Outside World
            </span>
          </div>
        </div>

        {/* Toggle toolbar button */}
        <button
          onClick={() => setShowToolbar(!showToolbar)}
          className="pointer-events-auto px-3 py-1.5 rounded-full bg-white/15 hover:bg-white/25 text-white text-xs font-sans backdrop-blur-md transition-all border border-white/10 flex items-center gap-1.5"
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>{showToolbar ? "Hide Controls" : "Show Controls"}</span>
        </button>
      </header>

      {/* ------------------------------------------------------------------- */}
      {/* 2. MAIN VIEWPORT (COMPARE MODES)                                     */}
      {/* ------------------------------------------------------------------- */}
      <main className="w-full h-full relative">
        {/* MODE A: 3D PROTOTYPE ONLY */}
        {compareMode === "3d" && (
          <div className="w-full h-full relative">
            <DoorPrototypeScene
              doorAngleDeg={doorAngle}
              exposure={exposure}
              sunIntensity={sunIntensity}
            />
          </div>
        )}

        {/* MODE B: REFERENCE ARTWORK ONLY */}
        {compareMode === "reference" && (
          <div className="w-full h-full relative flex items-center justify-center bg-black">
            <img
              src="/images/new_hero_reference.png"
              alt="Reference Artwork: The Door to the Outside World"
              className="w-full h-full object-cover"
            />
            <div className="absolute top-16 left-6 px-3 py-1 bg-black/70 text-white/90 text-xs rounded border border-white/15 backdrop-blur-sm">
              Primary Visual Target (Reference Image)
            </div>
          </div>
        )}

        {/* MODE C: SIDE-BY-SIDE COMPARISON */}
        {compareMode === "side-by-side" && (
          <div className="w-full h-full grid grid-cols-1 md:grid-cols-2 relative">
            {/* Left: Reference Target */}
            <div className="relative w-full h-full border-r border-white/20 bg-black overflow-hidden">
              <img
                src="/images/new_hero_reference.png"
                alt="Target Reference"
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-6 left-6 px-3 py-1.5 bg-black/75 text-white text-xs font-semibold rounded-md border border-white/20 backdrop-blur-md">
                1. Reference Artwork (Target)
              </div>
            </div>

            {/* Right: 3D Prototype */}
            <div className="relative w-full h-full bg-slate-900 overflow-hidden">
              <DoorPrototypeScene
                doorAngleDeg={doorAngle}
                exposure={exposure}
                sunIntensity={sunIntensity}
              />
              <div className="absolute bottom-6 left-6 px-3 py-1.5 bg-emerald-950/80 text-emerald-200 text-xs font-semibold rounded-md border border-emerald-500/30 backdrop-blur-md">
                2. Real-Time 3D WebGL Prototype
              </div>
            </div>
          </div>
        )}

        {/* MODE D: SPLIT INTERACTIVE SLIDER OVERLAY */}
        {compareMode === "split" && (
          <div className="w-full h-full relative overflow-hidden select-none">
            {/* Background Layer: Real-Time 3D Scene */}
            <div className="absolute inset-0 w-full h-full">
              <DoorPrototypeScene
                doorAngleDeg={doorAngle}
                exposure={exposure}
                sunIntensity={sunIntensity}
              />
            </div>

            {/* Foreground Layer: Reference Artwork with clipPath */}
            <div
              className="absolute inset-0 w-full h-full pointer-events-none"
              style={{
                clipPath: `polygon(0 0, ${splitPos}% 0, ${splitPos}% 100%, 0 100%)`,
              }}
            >
              <img
                src="/images/new_hero_reference.png"
                alt="Reference Target"
                className="w-full h-full object-cover"
              />
            </div>

            {/* Divider Line & Handle */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-white cursor-ew-resize z-30"
              style={{ left: `${splitPos}%` }}
            >
              <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-white text-black flex items-center justify-center shadow-lg border border-slate-300">
                <SplitSquareVertical className="w-4 h-4" />
              </div>
            </div>

            {/* Invisible Slider Input over full screen */}
            <input
              type="range"
              min="0"
              max="100"
              value={splitPos}
              onChange={(e) => setSplitPos(Number(e.target.value))}
              className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize z-40"
            />

            {/* Badges */}
            <div className="absolute bottom-6 left-6 z-30 px-3 py-1 bg-black/70 text-white text-xs rounded border border-white/20 backdrop-blur-sm pointer-events-none">
              Left: Target Reference
            </div>
            <div className="absolute bottom-6 right-6 z-30 px-3 py-1 bg-emerald-950/80 text-emerald-200 text-xs rounded border border-emerald-500/30 backdrop-blur-sm pointer-events-none">
              Right: 3D Prototype
            </div>
          </div>
        )}

        {/* ----------------------------------------------------------------- */}
        {/* 3. LIFE ATLAS EDITORIAL TYPOGRAPHY OVERLAY                         */}
        {/* Demonstrates how copy sits peacefully in the room negative space   */}
        {/* ----------------------------------------------------------------- */}
        {showTypography && compareMode === "3d" && (
          <div className="absolute inset-0 pointer-events-none z-20 flex flex-col justify-between px-6 md:px-14 lg:px-20 pt-24 md:pt-32 pb-12">
            {/* Left Editorial Box */}
            <div className="max-w-md lg:max-w-lg flex flex-col items-start text-left pointer-events-auto">
              <span className="font-sans text-[10px] md:text-[11px] uppercase tracking-[0.3em] text-slate-700/80 font-semibold mb-3">
                Life Atlas &bull; Archive &amp; Memories
              </span>

              <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl text-slate-900 tracking-[-0.025em] font-light leading-[1.06] mb-5">
                A place for the <span className="italic font-normal">moments</span> I want to remember.
              </h1>

              <p className="font-body text-xs sm:text-sm text-slate-600/90 leading-relaxed mb-6 max-w-sm">
                Behind every door lies a quiet world waiting to be remembered. An intimate atlas of journeys,
                hidden places, and the landscapes that stay with us long after coming home.
              </p>

              <div className="flex items-center gap-3">
                <Link
                  href="/explore"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-slate-900 text-white font-sans font-semibold text-[11px] uppercase tracking-widest rounded-lg shadow-sm hover:bg-slate-800 transition-all duration-300"
                >
                  Explore the atlas &rarr;
                </Link>
                <button
                  onClick={() => setDoorAngle(doorAngle === 0 ? 65 : 0)}
                  className="inline-flex items-center gap-2 px-4 py-3 bg-white/80 hover:bg-white text-slate-800 font-sans font-medium text-[11px] rounded-lg shadow-sm border border-slate-300/60 backdrop-blur-sm transition-all"
                >
                  {doorAngle === 0 ? "Open Door" : "Close Door"}
                </button>
              </div>
            </div>

            {/* Bottom Status Indicator */}
            <div className="flex items-center justify-between text-[11px] text-slate-500/80 font-sans">
              <span>Interactive 3D Prototype &bull; Standalone dev build</span>
              <span>Coordinates: 45&deg; Architectural FOV</span>
            </div>
          </div>
        )}
      </main>

      {/* ------------------------------------------------------------------- */}
      {/* 4. FLOATING DEVELOPER INSPECTION & CONTROLS TOOLBAR                 */}
      {/* ------------------------------------------------------------------- */}
      {showToolbar && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900/90 border border-white/15 backdrop-blur-xl rounded-2xl shadow-2xl px-5 py-3 text-white flex flex-wrap items-center gap-5 max-w-5xl">
          {/* Comparison Modes */}
          <div className="flex items-center gap-1 bg-white/10 p-1 rounded-xl">
            <button
              onClick={() => setCompareMode("3d")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                compareMode === "3d" ? "bg-white text-slate-950 shadow-sm" : "text-white/70 hover:text-white"
              }`}
            >
              3D Prototype
            </button>
            <button
              onClick={() => setCompareMode("side-by-side")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                compareMode === "side-by-side" ? "bg-white text-slate-950 shadow-sm" : "text-white/70 hover:text-white"
              }`}
            >
              Side-by-Side
            </button>
            <button
              onClick={() => setCompareMode("split")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                compareMode === "split" ? "bg-white text-slate-950 shadow-sm" : "text-white/70 hover:text-white"
              }`}
            >
              Split Slider
            </button>
            <button
              onClick={() => setCompareMode("reference")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                compareMode === "reference" ? "bg-white text-slate-950 shadow-sm" : "text-white/70 hover:text-white"
              }`}
            >
              Reference
            </button>
          </div>

          {/* Door State Presets */}
          <div className="flex items-center gap-1.5 border-l border-white/15 pl-4">
            <span className="text-[11px] text-white/60 uppercase tracking-wider font-semibold mr-1">Door:</span>
            <button
              onClick={() => setDoorAngle(0)}
              className={`px-2.5 py-1 rounded text-xs transition-all ${
                doorAngle === 0 ? "bg-amber-400 text-slate-950 font-bold" : "bg-white/10 text-white/80 hover:bg-white/20"
              }`}
            >
              Closed (0&deg;)
            </button>
            <button
              onClick={() => setDoorAngle(65)}
              className={`px-2.5 py-1 rounded text-xs transition-all ${
                doorAngle === 65 ? "bg-emerald-400 text-slate-950 font-bold" : "bg-white/10 text-white/80 hover:bg-white/20"
              }`}
            >
              Reference (65&deg;)
            </button>
            <button
              onClick={() => setDoorAngle(95)}
              className={`px-2.5 py-1 rounded text-xs transition-all ${
                doorAngle === 95 ? "bg-blue-400 text-slate-950 font-bold" : "bg-white/10 text-white/80 hover:bg-white/20"
              }`}
            >
              Wide (95&deg;)
            </button>
          </div>

          {/* Door Angle Slider */}
          <div className="flex items-center gap-2 border-l border-white/15 pl-4">
            <label className="text-[11px] text-white/60 font-semibold">{doorAngle}&deg;</label>
            <input
              type="range"
              min="0"
              max="115"
              step="1"
              value={doorAngle}
              onChange={(e) => setDoorAngle(Number(e.target.value))}
              className="w-20 accent-emerald-400 cursor-pointer"
            />
          </div>

          {/* Typography Overlay Toggle */}
          <div className="flex items-center gap-2 border-l border-white/15 pl-4">
            <button
              onClick={() => setShowTypography(!showTypography)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                showTypography ? "bg-white/20 text-white" : "bg-white/5 text-white/40 hover:text-white"
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Typography</span>
            </button>
          </div>

          {/* Reset button */}
          <button
            onClick={() => {
              setDoorAngle(65);
              setExposure(1.05);
              setSunIntensity(2.6);
              setCompareMode("3d");
              setShowTypography(true);
            }}
            title="Reset Settings"
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-all ml-auto"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
