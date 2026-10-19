"use client";

import { useEffect, useState, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Capacitor } from "@capacitor/core";

interface SecretAppGuardProps {
  children: ReactNode;
}

export default function SecretAppGuard({ children }: SecretAppGuardProps) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const isNative = typeof window !== "undefined" && Capacitor.isNativePlatform();
    const isDev = process.env.NODE_ENV === "development";

    if (!isNative && !isDev) {
      router.replace("/");
    }
    setMounted(true);
  }, [router]);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-[#05070a] flex items-center justify-center">
        <div className="w-5 h-5 rounded-full border border-amber-400/40 border-t-amber-300 animate-spin" />
      </div>
    );
  }

  const isAuthorized =
    (typeof window !== "undefined" && Capacitor.isNativePlatform()) ||
    process.env.NODE_ENV === "development";

  if (!isAuthorized) {
    return null;
  }

  return <>{children}</>;
}
