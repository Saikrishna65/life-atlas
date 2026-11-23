"use client";
import type { ReactNode } from "react";

// Historical storage epochs no longer perform migrations. Keep the wrapper for
// compatibility without flashing a loading screen on every workspace mount.
export default function DataEpochGate({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
