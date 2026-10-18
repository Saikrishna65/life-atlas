"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Capacitor } from "@capacitor/core";

export default function AdminMobileGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [isMobileApp] = useState(() => {
    return typeof window !== "undefined" && Capacitor.isNativePlatform();
  });

  useEffect(() => {
    if (typeof window !== "undefined" && Capacitor.isNativePlatform()) {
      router.replace("/");
    }
  }, [router]);

  if (isMobileApp) {
    return null;
  }

  return <>{children}</>;
}
