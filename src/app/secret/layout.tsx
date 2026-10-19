import { ReactNode } from "react";
import { Metadata } from "next";
import SecretAppGuard from "@/components/secret/SecretAppGuard";

export const metadata: Metadata = {
  title: "Private Atlas | Life Atlas",
  description: "Restricted private archive and management studio.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function SecretLayout({ children }: { children: ReactNode }) {
  return (
    <SecretAppGuard>
      <div className="min-h-screen bg-[#05070a] text-[#f2f4f8] selection:bg-amber-400/20 selection:text-amber-200">
        {/* Subtle cinematic radial vignette */}
        <div
          className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(120,80,20,0.12),transparent_70%)] z-0"
          aria-hidden="true"
        />

        <div className="relative z-10 pt-[max(env(safe-area-inset-top),2rem)] pb-[max(env(safe-area-inset-bottom),3rem)] px-5 sm:px-8 md:px-12">
          {children}
        </div>
      </div>
    </SecretAppGuard>
  );
}
