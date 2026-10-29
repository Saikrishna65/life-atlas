"use client";

import { ReactNode } from "react";

interface SecretAppGuardProps {
  children: ReactNode;
}

/**
 * SecretAppGuard: Authentication removed fully per user request.
 * Directly renders protected children without any lock screen or biometric prompt.
 */
export default function SecretAppGuard({ children }: SecretAppGuardProps) {
  return <>{children}</>;
}
