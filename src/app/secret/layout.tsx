import { ReactNode } from "react";
import { Metadata } from "next";
import SecretAppGuard from "@/components/secret/SecretAppGuard";

export const metadata: Metadata = {
  title: "Private Atlas | Life Atlas",
  description: "Private expedition journal and creator chronicle.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function SecretLayout({ children }: { children: ReactNode }) {
  return (
    <SecretAppGuard>
      <div className="min-h-screen bg-background text-foreground font-body selection:bg-accent/15 selection:text-foreground">
        {/* Subtle editorial atlas ambient wash */}
        <div
          className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_75%_50%_at_50%_0%,rgba(31,79,216,0.03),transparent_70%)] z-0"
          aria-hidden="true"
        />

        <div className="relative z-10 pt-[max(env(safe-area-inset-top),1.5rem)] pb-[max(env(safe-area-inset-bottom),2.5rem)] px-4 sm:px-6 md:px-8">
          {children}
        </div>
      </div>
    </SecretAppGuard>
  );
}
