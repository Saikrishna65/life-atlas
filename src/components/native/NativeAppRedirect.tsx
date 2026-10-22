"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Capacitor } from "@capacitor/core";

export function NativeAppRedirect() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== "undefined" && Capacitor.isNativePlatform()) {
      router.replace("/secret/vault");
    }
  }, [router]);

  return null;
}
