import { ReactNode } from "react";
import { Metadata } from "next";
import SecretAppGuard from "@/components/secret/SecretAppGuard";
import { MusicPlayerProvider } from "@/lib/music/MusicPlayerContext";
import MiniPlayer from "@/components/music/MiniPlayer";
import NowPlayingModal from "@/components/music/NowPlayingModal";

export const metadata: Metadata = {
  title: "Private Atlas | Life Atlas",
  description: "Private expedition journal, music vault, and creator chronicle.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function SecretLayout({ children }: { children: ReactNode }) {
  return (
    <SecretAppGuard>
      <MusicPlayerProvider>
        <div className="min-h-screen bg-[#04060a] text-white font-body selection:bg-amber-500/25 selection:text-white relative overflow-x-hidden">
          {/* Multi-chromatic Holographic Ambient Wash */}
          <div
            className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_75%_45%_at_50%_-5%,rgba(245,158,11,0.09),transparent_70%),radial-gradient(ellipse_55%_45%_at_90%_80%,rgba(6,182,212,0.06),transparent_65%),radial-gradient(ellipse_50%_40%_at_10%_70%,rgba(99,102,241,0.05),transparent_60%)] z-0"
            aria-hidden="true"
          />

          <div className="relative z-10 pt-[max(env(safe-area-inset-top),1.25rem)] pb-[max(env(safe-area-inset-bottom),5.5rem)] px-3.5 sm:px-6 md:px-8">
            {children}
          </div>

          <MiniPlayer />
          <NowPlayingModal />
        </div>
      </MusicPlayerProvider>
    </SecretAppGuard>
  );
}
