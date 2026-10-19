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
    (Capacitor.isNativePlatform() ||
      process.env.NODE_ENV === "development" ||
      (typeof window !== "undefined" &&
        sessionStorage.getItem("life_atlas_secret_unlocked") === "true"));

  useEffect(() => {
    if (isClient && !isAuthorized) {
      router.replace("/");
    }
  }, [isClient, isAuthorized, router]);

  if (!isClient) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-5 h-5 rounded-full border border-muted border-t-accent animate-spin" />
      </div>
    );
  }

  if (!isAuthorized) {
    return null;
  }

  return <>{children}</>;
}
