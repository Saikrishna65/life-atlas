"use client";

import { useEffect, useSyncExternalStore, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Capacitor } from "@capacitor/core";

interface SecretAppGuardProps {
  children: ReactNode;
}

const emptySubscribe = () => () => {};

export default function SecretAppGuard({ children }: SecretAppGuardProps) {
  const router = useRouter();
  const isClient = useSyncExternalStore(emptySubscribe, () => true, () => false);

  const isAuthorized =
    isClient &&
    (Capacitor.isNativePlatform() || process.env.NODE_ENV === "development");

  useEffect(() => {
    if (isClient && !isAuthorized) {
      router.replace("/");
    }
  }, [isClient, isAuthorized, router]);

  if (!isClient) {
    return (
      <div className="min-h-screen bg-[#07090d] flex items-center justify-center">
        <div className="w-5 h-5 rounded-full border border-amber-400/40 border-t-amber-300 animate-spin" />
      </div>
    );
  }

  if (!isAuthorized) {
    return null;
  }

  return <>{children}</>;
}
