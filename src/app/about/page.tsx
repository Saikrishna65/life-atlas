import PublicPage from "@/components/world/PublicPage";
import Link from "next/link";
export const metadata = {
  title: "A world worth remembering",
  description: "About the Life Atlas Living World public demonstration.",
};
export default function Page() {
  return (
    <PublicPage
      title="A life is more than a list."
      kicker="Life Atlas — The Living World. Reality meets imagination."
    >
      <article className="about-manifesto">
        <span className="world-eyebrow">A note from the atlas</span>
        <h2>
          Go a little further.
          <br />
          Look a little closer.
          <br />
          <em>Keep what matters.</em>
        </h2>
        <div className="about-prose">
          <p>
            The world is not short of things to see. Sometimes what we need is a
            little space to notice them. Life Atlas brings places, journeys,
            memories, sound, and practical plans into one connected public
            experience.
          </p>
          <p>
            This edition is a demonstration. The journals, journeys, budgets,
            financial records, reminders, music catalog, and Atlas conversations
            are fictional local examples. They are designed to show
            possibilities, not to claim verified personal achievements or live
            AI execution.
          </p>
          <p>
            No private vault, bank record, personal memory, assistant
            credential, or native data is connected to these scenes. The orb is
            an interactive visual presence. The sound dimension is a visual
            catalog with no audio playback.
          </p>
          <h3>The collection</h3>
          <p>
            36 destinations, 24 detailed expeditions, 120 timeline events, 108
            memories, 180 image metadata records, and 42 imagined travel
            milestones. The fictional music catalog includes 45 artists, 36
            albums, 216 tracks, and 20 playlists. Explore 56 authored
            conversations, 28 workflows, 108 ecosystem activities, 64 planning
            examples, and 120 sample transactions.
          </p>
          <h3>Images & geography</h3>
          <p>
            Landscape studies are illustrative and do not document the named
            destinations. The archive’s 180 metadata entries use six shared
            image studies rather than 180 unique photographs. The Arrival holds
            the original hero’s last frame. Additional landscapes come from
            existing Life Atlas artwork and the MIT-licensed Start Bootstrap
            collections. Abstract album art and the orb are procedural. Map
            coordinates are rounded approximate centers for orientation, not
            navigation or trail safety.
          </p>
          <a
            className="world-link"
            href="/images/world/LICENSES.txt"
            target="_blank"
            rel="noreferrer"
          >
            Read image license notices ↗
          </a>
          <h3>A world for different ways of exploring</h3>
          <p>
            Use chapter navigation, a keyboard, or a touch screen. New ambient
            animations respect reduced-motion preferences. Destination details
            remain available when WebGL is unavailable. Every itinerary, price,
            weather expectation, and transport note needs current independent
            confirmation before a real journey.
          </p>
          <Link className="world-button dark" href="/">
            Step into the living world ↗
          </Link>
        </div>
      </article>
    </PublicPage>
  );
}
