"use client";
import TripHeroEditor from "@/components/studio/TripHeroEditor";
import TripWebsitePublisher from "@/components/trip-vault/TripWebsitePublisher";
import type { TripRecord } from "@/lib/vault/types";
import "@/components/studio/creator-studio.css";
export default function GalleryTripControls({ trip }: { trip: TripRecord }) {
  return (
    <section
      className="creator-studio pg-website-panel"
      aria-label="Trip website controls"
    >
      <p className="pg-muted">
        Upload status and website publishing are separate. Review exactly what
        becomes public, then choose this journey’s opening photo or video.
      </p>
      <TripWebsitePublisher key={trip.id} tripId={trip.id} organized />
      <TripHeroEditor key={`cover-${trip.id}`} trip={trip} />
    </section>
  );
}
