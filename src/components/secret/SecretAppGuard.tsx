"use client";

import { useState, useEffect, useSyncExternalStore, ReactNode, useCallback, useRef } from "react";
import { Fingerprint, KeyRound, ArrowRight, ShieldCheck, RefreshCw } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import {
  isSecretAccessGranted,
  grantSecretAccess,
  revokeSecretAccess,
  authenticateWithDevice,
  verifyPasscode,
  DEFAULT_GUARDIAN_PIN,
} from "@/lib/deviceAuth";

interface SecretAppGuardProps {
  children: ReactNode;
}

const emptySubscribe = () => () => {};

export default function SecretAppGuard({ children }: SecretAppGuardProps) {
  const isClient = useSyncExternalStore(emptySubscribe, () => true, () => false);

  // Cold start ALWAYS starts locked so authentication is strictly requested on every launch
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [showPinFallback, setShowPinFallback] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState(false);
  const authInProgressRef = useRef(false);

  // Biometric verification handler: triggers native Android fingerprint prompt
  const handleVerifyBiometric = useCallback(async () => {
    if (authInProgressRef.current) return;
    authInProgressRef.current = true;
    setIsAuthenticating(true);

    try {
      const result = await authenticateWithDevice();
      if (result.success) {
        grantSecretAccess();
        setIsUnlocked(true);
        setShowPinFallback(false);
        setPinError(false);
      }
    } catch (err) {
      console.warn("Biometric verification error:", err);
    } finally {
      setIsAuthenticating(false);
      authInProgressRef.current = false;
    }
  }, []);

  // Handle Guardian PIN verification
  const handlePinSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!pinInput.trim()) return;

    const success = verifyPasscode(pinInput);
    if (success) {
      grantSecretAccess();
      setIsUnlocked(true);
      setShowPinFallback(false);
      setPinInput("");
      setPinError(false);
    } else {
      setPinError(true);
      setPinInput("");
      setTimeout(() => setPinError(false), 2000);
    }
  };

  // 1. AUTO-LOCK on App Background & AUTO-PROMPT on Resume
  useEffect(() => {
    let appStateSub: { remove: () => void } | null = null;

    // Capacitor Native App Lifecycle
    if (Capacitor.isNativePlatform()) {
      import("@capacitor/app")
        .then(({ App }) => {
          App.addListener("appStateChange", ({ isActive }) => {
            if (!isActive) {
              // App minimized, switched away, or screen locked -> IMMEDIATELY LOCK
              revokeSecretAccess();
              setIsUnlocked(false);
            } else {
              // App returned to foreground -> Prompt fingerprint immediately
              setTimeout(() => {
                if (!authInProgressRef.current) {
                  handleVerifyBiometric();
                }
              }, 100);
            }
          }).then((sub) => {
            appStateSub = sub;
          });
        })
        .catch((e) => console.warn("Capacitor App listener error:", e));
    }

    // Web & Browser Visibility Lifecycle
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        revokeSecretAccess();
        setIsUnlocked(false);
      } else if (document.visibilityState === "visible") {
        setTimeout(() => {
          if (!authInProgressRef.current) {
            handleVerifyBiometric();
          }
        }, 100);
      }
    };

    // Native Bridge Events from MainActivity
    const handleVaultLocked = () => {
      setIsUnlocked(false);
    };

    const handleVaultUnlocked = () => {
      setIsUnlocked(true);
    };

    const handleAppResumed = () => {
      setIsUnlocked(false);
      setTimeout(() => {
        if (!authInProgressRef.current) {
          handleVerifyBiometric();
        }
      }, 50);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("vault-locked", handleVaultLocked);
    window.addEventListener("vault-unlocked", handleVaultUnlocked);
    window.addEventListener("app-resumed", handleAppResumed);

    return () => {
      appStateSub?.remove();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("vault-locked", handleVaultLocked);
      window.removeEventListener("vault-unlocked", handleVaultUnlocked);
      window.removeEventListener("app-resumed", handleAppResumed);
    };
  }, [handleVerifyBiometric]);

  // 2. AUTO-TRIGGER FINGERPRINT ON INITIAL COLD START
  useEffect(() => {
    if (isClient && !isUnlocked && !authInProgressRef.current) {
      handleVerifyBiometric();
    }
  }, [isClient, isUnlocked, handleVerifyBiometric]);

  if (!isClient) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="w-6 h-6 rounded-full border-2 border-amber-500/30 border-t-amber-500 animate-spin" />
      </div>
    );
  }

  // 3. Vault Lock Screen (Editorial Light Aesthetic)
  if (!isUnlocked) {
    return (
      <div className="fixed inset-0 bg-surface/98 backdrop-blur-2xl z-50 flex flex-col items-center justify-center p-6 select-none animate-in fade-in duration-200">
        <div className="w-full max-w-sm flex flex-col items-center text-center space-y-6">
          {/* Vault Icon Header */}
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-[11px] font-mono tracking-wider text-amber-700 font-semibold uppercase">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
              <span>Atlas Vault • Protected</span>
            </div>
            <h2 className="font-display text-2xl sm:text-3xl font-normal text-foreground">
              Private Atlas
            </h2>
            <p className="text-xs text-muted-foreground max-w-xs">
              Authenticate with your device biometric fingerprint or Guardian PIN to access your vault.
            </p>
          </div>

          {!showPinFallback ? (
            /* Fingerprint Unlock View */
            <div className="flex flex-col items-center space-y-5 pt-2">
              <button
                type="button"
                onClick={handleVerifyBiometric}
                className="group relative w-20 h-20 rounded-3xl bg-white border border-amber-500/30 hover:border-amber-500/60 flex items-center justify-center text-amber-600 shadow-md hover:shadow-lg transition-all duration-300 active:scale-95 cursor-pointer"
                aria-label="Authenticate with Fingerprint"
              >
                {/* Pulsing radar rings */}
                <span className="absolute inset-0 rounded-3xl bg-amber-500/10 animate-ping opacity-30" />
                <Fingerprint
                  className={`w-10 h-10 ${
                    isAuthenticating ? "animate-pulse scale-105" : "group-hover:scale-105"
                  } transition-transform text-amber-600`}
                />
              </button>

              <div className="space-y-1">
                <span className="text-xs font-semibold text-foreground block">
                  {isAuthenticating ? "Scanning Fingerprint..." : "Touch Fingerprint Sensor"}
                </span>
                <span className="text-[11px] text-muted-foreground block">
                  Tap the sensor icon to prompt again
                </span>
              </div>

              {/* PIN Fallback Link */}
              <button
                type="button"
                onClick={() => setShowPinFallback(true)}
                className="inline-flex items-center gap-1.5 text-xs text-amber-700 hover:text-amber-800 font-semibold pt-4 hover:underline cursor-pointer"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Use Guardian PIN instead</span>
              </button>
            </div>
          ) : (
            /* PIN Fallback View */
            <form onSubmit={handlePinSubmit} className="w-full space-y-4 pt-2">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground block">
                  Enter Guardian PIN (Default: 1984)
                </label>
                <div className="relative">
                  <input
                    type="password"
                    inputMode="numeric"
                    autoFocus
                    maxLength={8}
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value)}
                    placeholder="Enter PIN..."
                    className={`w-full px-4 py-2.5 rounded-xl bg-white border text-center font-mono text-lg tracking-widest text-foreground focus:outline-none transition-colors ${
                      pinError
                        ? "border-rose-500 bg-rose-50 text-rose-700 animate-shake"
                        : "border-muted focus:border-amber-500"
                    }`}
                  />
                  {pinInput.length >= 4 && (
                    <button
                      type="submit"
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center cursor-pointer shadow-xs"
                    >
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  )}
                </div>
                {pinError && (
                  <p className="text-[11px] font-semibold text-rose-600 animate-fade-in">
                    Incorrect PIN. Please try again.
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowPinFallback(false);
                    handleVerifyBiometric();
                  }}
                  className="inline-flex items-center gap-1.5 text-xs text-amber-700 hover:text-amber-800 font-semibold cursor-pointer"
                >
                  <Fingerprint className="w-3.5 h-3.5" />
                  <span>Use Fingerprint</span>
                </button>

                <button
                  type="submit"
                  disabled={pinInput.length < 4}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 text-xs font-bold transition-all cursor-pointer shadow-xs"
                >
                  Unlock Vault
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
