"use client";
import type { ReactNode } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
const TripVaultFrame = dynamic(() => import("./TripVaultFrame"));

export default function PrivateTripFrame({
  children,
}: {
  children: ReactNode;
}) {
  const path = usePathname();
  return path.startsWith("/secret/vault") ? (
    <TripVaultFrame>{children}</TripVaultFrame>
  ) : (
    children
  );
}
