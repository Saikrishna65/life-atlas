"use client";

import { useState, useSyncExternalStore, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Fingerprint, Lock, ArrowLeft, ShieldCheck } from "lucide-react";
import DeviceAuthModal from "@/components/auth/DeviceAuthModal";
import { isSecretAccessGranted, grantSecretAccess } from "@/lib/deviceAuth";

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
  const [isModalOpen, setIsModalOpen] = useState(() => {
    return typeof window !== "undefined" && !isSecretAccessGranted();
  });

  const handleAuthSuccess = () => {
    grantSecretAccess();
    setIsUnlocked(true);
    setIsModalOpen(false);
  };

  const handleReturnHome = () => {
    setIsModalOpen(false);
    router.replace("/");
  };

  if (!isClient) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-5 h-5 rounded-full border border-muted border-t-accent animate-spin" />
      </div>
    );
  }

  // If locked, render an elegant editorial Lock Screen with Device Authentication trigger
  if (!isUnlocked) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6 text-center select-none">
        <div className="relative max-w-sm w-full p-8 rounded-3xl border border-muted bg-surface shadow-soft flex flex-col items-center">
          {/* Subtle Ambient Aura */}
          <div
            className="w-20 h-20 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center text-accent mb-6 shadow-[0_0_30px_rgba(31,79,216,0.15)]"
            aria-hidden="true"
          >
            <Lock className="w-8 h-8" />
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted/60 border border-muted text-[11px] font-mono tracking-wider text-muted-foreground uppercase mb-3">
            <ShieldCheck className="w-3.5 h-3.5 text-accent" />
            <span>Vault Protected</span>
          </div>

          <h1 className="font-display text-2xl sm:text-3xl font-medium tracking-tight text-foreground mb-2">
            Private Atlas
          </h1>
          <p className="font-body text-xs sm:text-sm text-muted-foreground leading-relaxed mb-6">
            Device biometric authentication is required to access your private expeditions and journal entries.
          </p>

          <div className="w-full space-y-3">
            <button
              onClick={() => setIsModalOpen(true)}
              className="w-full py-3 px-4 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-neutral-950 shadow-[0_0_20px_rgba(245,158,11,0.25)] active:scale-[0.98]"
            >
              <Fingerprint className="w-4 h-4" />
              <span>Verify Fingerprint</span>
            </button>

            <button
              onClick={handleReturnHome}
              className="w-full py-2.5 px-4 rounded-xl text-xs font-sans tracking-wide text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Return to Public Atlas</span>
            </button>
          </div>
        </div>

        <DeviceAuthModal
          isOpen={isModalOpen}
          onSuccess={handleAuthSuccess}
          onClose={() => {
            setIsModalOpen(false);
            if (!isSecretAccessGranted()) {
              handleReturnHome();
            }
          }}
        />
      </div>
    );
  }

  return <>{children}</>;
}

