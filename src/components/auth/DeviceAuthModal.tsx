"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Fingerprint,
  Lock,
  Unlock,
  ShieldCheck,
  AlertCircle,
  KeyRound,
  X,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import {
  authenticateWithDevice,
  verifyPasscode,
  triggerHaptic,
  DEFAULT_GUARDIAN_PIN,
  checkBiometricSupport,
  BiometricCheckResult,
} from "@/lib/deviceAuth";

interface DeviceAuthModalProps {
  isOpen: boolean;
  onSuccess: () => void;
  onClose: () => void;
}

export default function DeviceAuthModal({
  isOpen,
  onSuccess,
  onClose,
}: DeviceAuthModalProps) {
  const [authMode, setAuthMode] = useState<"fingerprint" | "pin">("fingerprint");
  const [status, setStatus] = useState<"idle" | "scanning" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [pinInput, setPinInput] = useState<string>("");
  const [bioSupport, setBioSupport] = useState<BiometricCheckResult | null>(null);

  // Check biometric capability on mount
  useEffect(() => {
    if (isOpen) {
      checkBiometricSupport().then((res) => {
        setBioSupport(res);
        // If device has no biometric hardware, default directly to PIN mode
        if (!res.hasHardware && !res.available) {
          setAuthMode("pin");
        }
      });
    }
  }, [isOpen]);

  const handleFingerprintScan = useCallback(async () => {
    setStatus("scanning");
    setErrorMessage("");
    triggerHaptic("tap");

    try {
      const result = await authenticateWithDevice();

      if (result.success) {
        setStatus("success");
        setTimeout(() => {
          onSuccess();
        }, 600);
      } else if (result.cancelled) {
        setStatus("idle");
        setErrorMessage("Biometric prompt dismissed. Tap to try again or use PIN.");
      } else {
        setStatus("error");
        setErrorMessage(result.error || "Biometric sensor unavailable. Please use PIN.");
      }
    } catch {
      setStatus("error");
      setErrorMessage("Authentication failed. Please try again.");
    }
  }, [onSuccess]);

  // Handle PIN input
  const handlePinDigit = useCallback((digit: string) => {
    setPinInput((prev) => {
      if (prev.length >= 6) return prev;
      triggerHaptic("tap");
      const nextPin = prev + digit;
      setErrorMessage("");

      if (nextPin.length === 4) {
        const ok = verifyPasscode(nextPin);
        if (ok) {
          setStatus("success");
          setTimeout(() => {
            onSuccess();
          }, 500);
        } else {
          setStatus("error");
          setErrorMessage("Incorrect guardian PIN. Default is 1984.");
          setTimeout(() => {
            setPinInput("");
            setStatus("idle");
          }, 1200);
        }
      }
      return nextPin;
    });
  }, [onSuccess]);

  const handleBackspace = useCallback(() => {
    triggerHaptic("tap");
    setPinInput((prev) => prev.slice(0, -1));
    setErrorMessage("");
  }, []);

  const handleClearPin = useCallback(() => {
    setPinInput("");
    setErrorMessage("");
    setStatus("idle");
  }, []);

  // Keyboard support for PIN entry
  useEffect(() => {
    if (!isOpen || authMode !== "pin") return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= "0" && e.key <= "9") {
        handlePinDigit(e.key);
      } else if (e.key === "Backspace") {
        handleBackspace();
      } else if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, authMode, handlePinDigit, handleBackspace, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Device Biometric Authentication"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md animate-fade-in select-none"
    >
      {/* Background ambient lighting */}
      <div
        className="absolute w-96 h-96 rounded-full bg-amber-500/10 blur-3xl pointer-events-none -top-10 -left-10"
        aria-hidden="true"
      />
      <div
        className="absolute w-96 h-96 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none -bottom-10 -right-10"
        aria-hidden="true"
      />

      {/* Modal Container */}
      <div className="relative w-full max-w-sm rounded-3xl border border-white/10 bg-neutral-900/90 shadow-[0_0_60px_rgba(0,0,0,0.85)] p-6 sm:p-8 flex flex-col items-center text-center overflow-hidden">
        {/* Subtle top close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
          aria-label="Cancel authentication"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header Badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.06] border border-white/10 text-[11px] font-mono tracking-wider text-amber-300/90 uppercase mb-5">
          <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
          <span>{bioSupport?.label || "Device Security Gate"}</span>
        </div>

        {/* Title */}
        <h2 className="font-display text-2xl sm:text-3xl font-medium tracking-tight text-white mb-2">
          Private Atlas
        </h2>
        <p className="font-body text-xs sm:text-sm text-neutral-400 mb-6 max-w-xs leading-relaxed">
          {authMode === "fingerprint"
            ? "Scan device fingerprint or authenticate using device credentials to pass through the door."
            : "Enter guardian passcode to open the secret door (Default: 1984)."}
        </p>

        {/* Switch Mode Tabs */}
        <div className="flex items-center gap-1 p-1 bg-neutral-950/70 border border-white/10 rounded-xl mb-6 text-xs">
          <button
            onClick={() => {
              setAuthMode("fingerprint");
              setStatus("idle");
              setErrorMessage("");
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
              authMode === "fingerprint"
                ? "bg-amber-400/15 text-amber-300 border border-amber-400/30 font-medium"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            <Fingerprint className="w-3.5 h-3.5" />
            <span>Fingerprint</span>
          </button>
          <button
            onClick={() => {
              setAuthMode("pin");
              setStatus("idle");
              setErrorMessage("");
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
              authMode === "pin"
                ? "bg-amber-400/15 text-amber-300 border border-amber-400/30 font-medium"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Passcode</span>
          </button>
        </div>

        {/* FINGERPRINT MODE */}
        {authMode === "fingerprint" && (
          <div className="flex flex-col items-center w-full">
            {/* Interactive Fingerprint Scanner Visualizer */}
            <button
              onClick={handleFingerprintScan}
              disabled={status === "scanning" || status === "success"}
              className="relative group p-6 rounded-full transition-transform active:scale-95 focus:outline-none"
              aria-label="Scan Fingerprint"
            >
              {/* Outer Sonar Waves */}
              {status === "scanning" && (
                <div className="absolute inset-0 rounded-full border-2 border-cyan-400/40 animate-ping pointer-events-none" />
              )}
              {status === "success" && (
                <div className="absolute inset-0 rounded-full border-2 border-emerald-400/60 animate-ping pointer-events-none" />
              )}

              {/* Glowing Aura Ring */}
              <div
                className={`w-28 h-28 rounded-full flex items-center justify-center transition-all duration-500 border ${
                  status === "success"
                    ? "bg-emerald-500/20 border-emerald-400 text-emerald-300 shadow-[0_0_35px_rgba(52,211,153,0.4)]"
                    : status === "error"
                    ? "bg-rose-500/20 border-rose-400 text-rose-300 shadow-[0_0_35px_rgba(244,63,94,0.3)]"
                    : status === "scanning"
                    ? "bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-[0_0_35px_rgba(34,211,238,0.4)] animate-pulse"
                    : "bg-neutral-800/80 border-white/20 text-amber-300/90 group-hover:border-amber-400/50 group-hover:bg-amber-500/10 shadow-[0_0_25px_rgba(251,191,36,0.15)]"
                }`}
              >
                {status === "success" ? (
                  <Unlock className="w-12 h-12 text-emerald-300 animate-bounce" />
                ) : status === "scanning" ? (
                  <div className="relative">
                    <Fingerprint className="w-12 h-12 text-cyan-300" />
                    {/* Laser scanning bar */}
                    <div className="absolute -top-1 left-0 right-0 h-1 bg-cyan-300 shadow-[0_0_10px_#22d3ee] rounded-full animate-bounce" />
                  </div>
                ) : status === "error" ? (
                  <AlertCircle className="w-12 h-12 text-rose-400" />
                ) : (
                  <Fingerprint className="w-12 h-12 text-amber-300 group-hover:scale-105 transition-transform" />
                )}
              </div>
            </button>

            {/* Status indicator message */}
            <div className="mt-4 mb-5 min-h-[2.5rem] flex items-center justify-center">
              {status === "scanning" ? (
                <span className="inline-flex items-center gap-2 text-xs font-mono text-cyan-300 animate-pulse">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Awaiting fingerprint verification...
                </span>
              ) : status === "success" ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-mono text-emerald-400 font-medium">
                  <Sparkles className="w-3.5 h-3.5" />
                  Access Granted • Opening Portal...
                </span>
              ) : status === "error" ? (
                <span className="text-xs text-rose-400 px-3">{errorMessage}</span>
              ) : errorMessage ? (
                <span className="text-xs text-neutral-400 px-3">{errorMessage}</span>
              ) : (
                <span className="text-xs text-neutral-400">
                  Tap sensor or press button to trigger biometric prompt
                </span>
              )}
            </div>

            {/* Primary Action Button */}
            <button
              onClick={handleFingerprintScan}
              disabled={status === "scanning" || status === "success"}
              className="w-full py-3 px-4 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-neutral-950 shadow-[0_0_20px_rgba(245,158,11,0.3)] active:scale-[0.98] disabled:opacity-50"
            >
              <Fingerprint className="w-4 h-4" />
              <span>{status === "scanning" ? "Verifying..." : "Verify Fingerprint"}</span>
            </button>
          </div>
        )}

        {/* PIN CODE MODE */}
        {authMode === "pin" && (
          <div className="flex flex-col items-center w-full">
            {/* PIN Dots Display */}
            <div className="flex items-center justify-center gap-3.5 py-4 mb-4">
              {[0, 1, 2, 3].map((idx) => {
                const filled = pinInput.length > idx;
                return (
                  <div
                    key={idx}
                    className={`w-4 h-4 rounded-full transition-all duration-200 border ${
                      status === "success"
                        ? "bg-emerald-400 border-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)] scale-110"
                        : status === "error"
                        ? "bg-rose-500 border-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.8)] animate-pulse"
                        : filled
                        ? "bg-amber-400 border-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.6)] scale-105"
                        : "bg-neutral-800/80 border-white/20"
                    }`}
                  />
                );
              })}
            </div>

            {/* Error or hint */}
            <div className="min-h-[1.5rem] mb-3 text-center">
              {errorMessage ? (
                <span className="text-xs text-rose-400">{errorMessage}</span>
              ) : (
                <span className="text-[11px] font-mono text-neutral-500">
                  Hint: Default sanctuary code is {DEFAULT_GUARDIAN_PIN}
                </span>
              )}
            </div>

            {/* Numeric Keypad for Touch & Quick Mouse Click */}
            <div className="grid grid-cols-3 gap-2.5 w-full max-w-[240px] mb-4">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => handlePinDigit(num)}
                  className="h-12 rounded-xl bg-neutral-800/60 hover:bg-neutral-700/60 active:bg-amber-500/20 active:border-amber-400/40 border border-white/10 text-white text-lg font-mono font-medium transition-colors"
                >
                  {num}
                </button>
              ))}
              <button
                type="button"
                onClick={handleClearPin}
                className="h-12 rounded-xl bg-neutral-900/60 hover:bg-neutral-800/60 border border-white/10 text-neutral-400 text-xs font-mono uppercase tracking-wider transition-colors"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => handlePinDigit("0")}
                className="h-12 rounded-xl bg-neutral-800/60 hover:bg-neutral-700/60 active:bg-amber-500/20 active:border-amber-400/40 border border-white/10 text-white text-lg font-mono font-medium transition-colors"
              >
                0
              </button>
              <button
                type="button"
                onClick={handleBackspace}
                className="h-12 rounded-xl bg-neutral-900/60 hover:bg-neutral-800/60 border border-white/10 text-neutral-400 text-sm font-mono transition-colors"
              >
                ⌫
              </button>
            </div>
          </div>
        )}

        {/* Quiet Footer Note */}
        <div className="mt-5 pt-4 border-t border-white/10 w-full flex items-center justify-between text-[11px] text-neutral-500">
          <span className="flex items-center gap-1">
            <Lock className="w-3 h-3 text-neutral-400" />
            <span>Biometric Guardian</span>
          </span>
          <button
            onClick={onClose}
            className="hover:text-neutral-300 transition-colors underline underline-offset-2"
          >
            Stay in Public Atlas
          </button>
        </div>
      </div>
    </div>
  );
}
