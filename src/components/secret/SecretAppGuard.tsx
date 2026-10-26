"use client";

import { useState, useEffect, useSyncExternalStore, ReactNode, useCallback, useRef } from "react";
import { Fingerprint } from "lucide-react";
import {
  isSecretAccessGranted,
  grantSecretAccess,
  authenticateWithDevice,
} from "@/lib/deviceAuth";

interface SecretAppGuardProps {
  children: ReactNode;
}

const emptySubscribe = () => () => {};

export default function SecretAppGuard({ children }: SecretAppGuardProps) {
  const isClient = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const [isUnlocked, setIsUnlocked] = useState(() => {
    return typeof window !== "undefined" && isSecretAccessGranted();
  });
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const authInProgressRef = useRef(false);

  // Biometric verification handler: triggers native Android fingerprint prompt directly
  const handleVerifyBiometric = useCallback(async () => {
    if (authInProgressRef.current) return;
    authInProgressRef.current = true;
    setIsAuthenticating(true);

    try {
      const result = await authenticateWithDevice();
      if (result.success) {
        grantSecretAccess();
        setIsUnlocked(true);
      }
    } catch (err) {
      console.warn("Biometric verification error:", err);
    } finally {
      setIsAuthenticating(false);
      authInProgressRef.current = false;
    }
  }, []);

  // Listen to vault-locked and vault-unlocked events
  useEffect(() => {
    const handleVaultLocked = () => {
      setIsUnlocked(false);
    };

    const handleVaultUnlocked = () => {
      setIsUnlocked(true);
    };

    window.addEventListener("vault-locked", handleVaultLocked);
    window.addEventListener("vault-unlocked", handleVaultUnlocked);

    return () => {
      window.removeEventListener("vault-locked", handleVaultLocked);
      window.removeEventListener("vault-unlocked", handleVaultUnlocked);
    };
  }, []);

  // AUTO-TRIGGER NATIVE FINGERPRINT IMMEDIATELY ON COLD START OR LOCK
  useEffect(() => {
    if (isClient && !isUnlocked && !authInProgressRef.current) {
      handleVerifyBiometric();
    }
  }, [isClient, isUnlocked, handleVerifyBiometric]);

  if (!isClient) {
    return (
      <div className="min-h-screen bg-[#07080a] flex items-center justify-center">
        <div className="w-6 h-6 rounded-full border-2 border-amber-500/30 border-t-amber-500 animate-spin" />
      </div>
    );
  }

  // If locked, render pure, distraction-free native unlock background with tap-to-trigger
  // NO PIN pad, NO buttons, NO intermediate forms - purely native fingerprint prompt
  if (!isUnlocked) {
    return (
      <div
        onClick={handleVerifyBiometric}
        className="fixed inset-0 bg-[#07080a] z-50 flex flex-col items-center justify-center cursor-pointer select-none"
      >
        <div className="flex flex-col items-center gap-3 animate-fade-in">
          <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Fingerprint className={`w-8 h-8 ${isAuthenticating ? "animate-pulse" : ""} text-amber-400`} />
          </div>
          <span className="text-[11px] font-mono uppercase tracking-widest text-neutral-500">
            Touch fingerprint sensor
          </span>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
