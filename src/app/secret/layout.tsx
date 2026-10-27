import { ReactNode } from "react";
import { Metadata } from "next";
import SecretAppGuard from "@/components/secret/SecretAppGuard";
import { MusicPlayerProvider } from "@/lib/music/MusicPlayerContext";
import MiniPlayer from "@/components/music/MiniPlayer";
import NowPlayingModal from "@/components/music/NowPlayingModal";
import GlobalYouTubeShareHandler from "@/components/secret/GlobalYouTubeShareHandler";

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
        <div className="min-h-screen bg-surface text-foreground font-body selection:bg-amber-500/20 selection:text-foreground relative overflow-x-hidden">
          {/* Subtle Cartographic & Audiophile Ambient Wash */}
          <div
            className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_75%_45%_at_50%_-5%,rgba(245,158,11,0.06),transparent_70%),radial-gradient(ellipse_55%_45%_at_90%_80%,rgba(31,79,216,0.04),transparent_65%),radial-gradient(ellipse_50%_40%_at_10%_70%,rgba(15,157,107,0.03),transparent_60%)] z-0"
            aria-hidden="true"
          />

          <div className="relative z-10 pt-[max(env(safe-area-inset-top),1.25rem)] pb-[max(env(safe-area-inset-bottom),5.5rem)] px-3.5 sm:px-6 md:px-8">
            {children}
          </div>

          <MiniPlayer />
          <NowPlayingModal />
          <GlobalYouTubeShareHandler />
        </div>
      </MusicPlayerProvider>
    </SecretAppGuard>
  );
}
