"use client";

import { useState, useEffect, useSyncExternalStore, ReactNode, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Capacitor } from "@capacitor/core";
import {
  Fingerprint,
  Lock,
  ArrowLeft,
  ShieldCheck,
  RefreshCw,
  KeyRound,
  Delete,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import {
  isSecretAccessGranted,
  grantSecretAccess,
  revokeSecretAccess,
  authenticateWithDevice,
  verifyPasscode,
  triggerHaptic,
  checkBiometricSupport,
  BiometricCheckResult,
} from "@/lib/deviceAuth";

interface SecretAppGuardProps {
  children: ReactNode;
}

const emptySubscribe = () => () => {};

export default function SecretAppGuard({ children }: SecretAppGuardProps) {
  const router = useRouter();
  const isClient = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const [isUnlocked, setIsUnlocked] = useState(() => {
    return typeof window !== "undefined" && isSecretAccessGranted();
  });
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [authMode, setAuthMode] = useState<"fingerprint" | "pin">("fingerprint");
  const [pinInput, setPinInput] = useState("");
  const [isNative, setIsNative] = useState(false);
  const [bioSupport, setBioSupport] = useState<BiometricCheckResult | null>(null);

  const hasAutoTriggeredRef = useRef(false);

  // Detect platform and check biometrics on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const native = Capacitor.isNativePlatform();
      setIsNative(native);
      checkBiometricSupport().then((res) => {
        setBioSupport(res);
        if (!res.available || !res.hasHardware) {
          setAuthMode("pin");
        }
      });
    }
  }, []);

  // Listen to vault-locked and vault-unlocked events
  useEffect(() => {
    const handleVaultLocked = () => {
      setIsUnlocked(false);
      hasAutoTriggeredRef.current = false;
      setPinInput("");
      setErrorMessage("");
    };

    const handleVaultUnlocked = () => {
      setIsUnlocked(true);
      setErrorMessage("");
    };

    window.addEventListener("vault-locked", handleVaultLocked);
    window.addEventListener("vault-unlocked", handleVaultUnlocked);

    return () => {
      window.removeEventListener("vault-locked", handleVaultLocked);
      window.removeEventListener("vault-unlocked", handleVaultUnlocked);
    };
  }, []);

  // Biometric verification handler
  const handleVerifyBiometric = useCallback(async () => {
    if (isAuthenticating) return;
    setIsAuthenticating(true);
    setErrorMessage("");

    try {
      const result = await authenticateWithDevice();
      if (result.success) {
        grantSecretAccess();
        setIsUnlocked(true);
      } else if (result.cancelled) {
        setErrorMessage("Biometric prompt dismissed. Tap to retry or use PIN.");
      } else {
        setErrorMessage(result.error || "Authentication failed. Tap to retry or use PIN.");
      }
    } catch {
      setErrorMessage("Authentication error. Tap to retry or use PIN.");
    } finally {
      setIsAuthenticating(false);
    }
  }, [isAuthenticating]);

  // AUTO-TRIGGER ON COLD START / LAUNCH
  useEffect(() => {
    if (isClient && !isUnlocked && !hasAutoTriggeredRef.current) {
      hasAutoTriggeredRef.current = true;
      // Slight delay for Android view to settle
      const timer = setTimeout(() => {
        handleVerifyBiometric();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [isClient, isUnlocked, handleVerifyBiometric]);

  // PIN keypad handlers
  const handlePinDigit = (digit: string) => {
    if (pinInput.length >= 4) return;
    triggerHaptic("tap");
    const nextPin = pinInput + digit;
    setPinInput(nextPin);
    setErrorMessage("");

    if (nextPin.length === 4) {
      const ok = verifyPasscode(nextPin);
      if (ok) {
        grantSecretAccess();
        setIsUnlocked(true);
      } else {
        setErrorMessage("Incorrect PIN code. Try again.");
        setTimeout(() => setPinInput(""), 350);
      }
    }
  };

  const handlePinDelete = () => {
    triggerHaptic("tap");
    setPinInput((prev) => prev.slice(0, -1));
    setErrorMessage("");
  };

  const handlePinClear = () => {
    triggerHaptic("tap");
    setPinInput("");
    setErrorMessage("");
  };

  const handleReturnHome = () => {
    revokeSecretAccess();
    router.replace("/");
  };

  if (!isClient) {
    return (
      <div className="min-h-screen bg-[#07080a] flex items-center justify-center">
        <div className="w-6 h-6 rounded-full border-2 border-amber-500/30 border-t-amber-500 animate-spin" />
      </div>
    );
  }

  // If locked, render the dedicated Atlas Vault Biometric Enclave
  if (!isUnlocked) {
    return (
      <div className="min-h-screen bg-[#07080a] text-foreground flex flex-col items-center justify-center p-4 sm:p-6 text-center select-none overflow-hidden relative">
        {/* Ambient Radial Glow */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-gradient-to-b from-amber-500/10 via-amber-500/5 to-transparent pointer-events-none blur-3xl"
          aria-hidden="true"
        />

        <div className="relative max-w-sm w-full p-6 sm:p-8 rounded-3xl border border-white/10 bg-[#0f1218]/90 backdrop-blur-xl shadow-2xl flex flex-col items-center animate-fade-in z-10">
          {/* Status Chip */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-[10px] font-mono tracking-widest text-amber-400 uppercase font-bold mb-5">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
            <span>Atlas Vault Protected</span>
          </div>

          {/* Glowing Aura Lock Icon */}
          <div className="relative mb-4">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-b from-amber-500/20 to-amber-500/5 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-[0_0_40px_rgba(245,158,11,0.2)]">
              {authMode === "fingerprint" ? (
                <Fingerprint className="w-10 h-10 animate-pulse" />
              ) : (
                <KeyRound className="w-9 h-9 text-amber-400" />
              )}
            </div>
            {isAuthenticating && (
              <div className="absolute inset-0 rounded-3xl border-2 border-amber-400 animate-ping opacity-30 pointer-events-none" />
            )}
          </div>

          <h1 className="font-display text-2xl sm:text-3xl font-medium tracking-tight text-white mb-1.5">
            Atlas Vault
          </h1>
          <p className="font-body text-xs text-neutral-400 leading-relaxed mb-5 max-w-[280px]">
            {authMode === "fingerprint"
              ? "Scan your fingerprint to access your offline trip plans, tickets & documents."
              : "Enter your 4-digit guardian PIN to unlock your offline expedition archives."}
          </p>

          {/* Error Message */}
          {errorMessage && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-sans mb-4 max-w-full truncate">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{errorMessage}</span>
            </div>
          )}

          {/* MODE 1: FINGERPRINT SCANNER */}
          {authMode === "fingerprint" && (
            <div className="w-full space-y-3">
              <button
                type="button"
                onClick={handleVerifyBiometric}
                disabled={isAuthenticating}
                className="w-full py-3.5 px-4 rounded-2xl font-semibold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-neutral-950 shadow-[0_0_25px_rgba(245,158,11,0.3)] active:scale-[0.98] disabled:opacity-50 cursor-pointer"
              >
                {isAuthenticating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-neutral-950" />
                    <span>Touch Sensor Now...</span>
                  </>
                ) : (
                  <>
                    <Fingerprint className="w-4 h-4 text-neutral-950" />
                    <span>Verify Fingerprint</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setAuthMode("pin");
                  setErrorMessage("");
                }}
                className="w-full py-2.5 px-4 rounded-xl text-xs font-sans tracking-wide text-neutral-400 hover:text-white hover:bg-white/5 transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Enter PIN Code Instead</span>
              </button>
            </div>
          )}

          {/* MODE 2: PIN KEYPAD */}
          {authMode === "pin" && (
            <div className="w-full space-y-4">
              {/* PIN Dots Display */}
              <div className="flex items-center justify-center gap-3 py-2">
                {[0, 1, 2, 3].map((idx) => {
                  const isFilled = pinInput.length > idx;
                  return (
                    <div
                      key={idx}
                      className={`w-3.5 h-3.5 rounded-full border transition-all duration-200 ${
                        isFilled
                          ? "bg-amber-400 border-amber-300 scale-110 shadow-[0_0_12px_rgba(245,158,11,0.5)]"
                          : "bg-white/5 border-white/20"
                      }`}
                    />
                  );
                })}
              </div>

              {/* Numeric Keypad Grid */}
              <div className="grid grid-cols-3 gap-2 w-full max-w-[240px] mx-auto pt-1">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
                  <button
                    key={digit}
                    type="button"
                    onClick={() => handlePinDigit(digit)}
                    className="h-11 rounded-xl bg-white/5 hover:bg-white/10 active:bg-amber-500/20 active:text-amber-300 border border-white/5 text-base font-mono font-medium text-white transition-all cursor-pointer flex items-center justify-center select-none"
                  >
                    {digit}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={handlePinClear}
                  className="h-11 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white text-[11px] font-sans tracking-wider uppercase transition-colors cursor-pointer flex items-center justify-center select-none"
                >
                  Clear
                </button>

                <button
                  type="button"
                  onClick={() => handlePinDigit("0")}
                  className="h-11 rounded-xl bg-white/5 hover:bg-white/10 active:bg-amber-500/20 active:text-amber-300 border border-white/5 text-base font-mono font-medium text-white transition-all cursor-pointer flex items-center justify-center select-none"
                >
                  0
                </button>

                <button
                  type="button"
                  onClick={handlePinDelete}
                  className="h-11 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white transition-colors cursor-pointer flex items-center justify-center select-none"
                  aria-label="Backspace"
                >
                  <Delete className="w-4 h-4" />
                </button>
              </div>

              {bioSupport?.available && (
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("fingerprint");
                    setErrorMessage("");
                  }}
                  className="w-full py-2 rounded-xl text-xs font-sans tracking-wide text-neutral-400 hover:text-white hover:bg-white/5 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Fingerprint className="w-3.5 h-3.5 text-amber-400" />
                  <span>Use Fingerprint Sensor</span>
                </button>
              )}
            </div>
          )}

          {/* Web fallback back link (hidden on native APK) */}
          {!isNative && (
            <button
              type="button"
              onClick={handleReturnHome}
              className="mt-4 pt-3 border-t border-white/5 w-full text-[11px] font-sans tracking-wide text-neutral-500 hover:text-neutral-300 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-3 h-3" />
              <span>Return to Public Atlas</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
