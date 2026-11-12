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
            memories and sound into one connected public
            experience.
          </p>
          <p>
            Sample journeys and illustrative photography are labeled throughout the atlas. Published travel journals are presented separately from these studies.
          </p>
          <p>
            A journal of places, photographs and the stories that connect them.
          </p>
          <h3>The collection</h3>
          <p>
            Explore destinations, field journals, photographs and visual music collections. Each journey follows a place, a route and the moments along the way.
          </p>
          <h3>Images & geography</h3>
          <p>
            Landscape studies are illustrative and do not document the named
            destinations. The archive’s 180 metadata entries use six shared
            image studies rather than 180 unique photographs. The opening door leads directly into the atlas. Additional landscapes come from
            existing Life Atlas artwork and the MIT-licensed Start Bootstrap
            collections. Abstract album artwork is procedural. Map
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
