import AppUpdates from "@/components/updates/AppUpdates";
import PrivateTripFrame from "@/components/trip-vault/PrivateTripFrame";
import AtlasLauncher from "@/components/secret/AtlasLauncher";
import DataEpochGate from "@/components/secret/DataEpochGate";
import ControlRoomBridge from "@/components/control-room/ControlRoomBridge";
import TripFinanceBridge from "@/components/finance/trips/TripFinanceBridge";
import { ReactNode } from "react";
import { Metadata } from "next";
import SecretAppGuard from "@/components/secret/SecretAppGuard";
import { MusicPlayerProvider } from "@/lib/music/MusicPlayerContext";
import MiniPlayer from "@/components/music/MiniPlayer";
import NowPlayingOverlay from "@/components/music/NowPlayingOverlay";
import GlobalYouTubeShareHandler from "@/components/secret/GlobalYouTubeShareHandler";

export const metadata: Metadata = {
  title: "Atlas | Atlas",
  description:
    "Private expedition journal, Atlas Music, and creator chronicle.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function SecretLayout({ children }: { children: ReactNode }) {
  return (
    <DataEpochGate>
      <MusicPlayerProvider>
        <SecretAppGuard>
          <div className="atlas-private-shell min-h-screen bg-surface text-foreground font-body selection:bg-amber-500/20 selection:text-foreground relative overflow-x-hidden">
            {/* Subtle Cartographic & Audiophile Ambient Wash */}
            <div
              className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_75%_45%_at_50%_-5%,rgba(245,158,11,0.06),transparent_70%),radial-gradient(ellipse_55%_45%_at_90%_80%,rgba(31,79,216,0.04),transparent_65%),radial-gradient(ellipse_50%_40%_at_10%_70%,rgba(15,157,107,0.03),transparent_60%)] z-0"
              aria-hidden="true"
            />

            <div className="relative z-10 pt-[max(env(safe-area-inset-top),1.25rem)] pb-[max(env(safe-area-inset-bottom),5.5rem)] px-3.5 sm:px-6 md:px-8">
              <ControlRoomBridge />
              <TripFinanceBridge />
              <PrivateTripFrame>{children}</PrivateTripFrame>
            </div>

            <AppUpdates />
            <AtlasLauncher />
            <MiniPlayer />
            <NowPlayingOverlay />
            <GlobalYouTubeShareHandler />
          </div>
        </SecretAppGuard>
      </MusicPlayerProvider>
    </DataEpochGate>
  );
}
