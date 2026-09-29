import { getTimelineEvents } from "@/lib/queries/timeline";
import { Metadata } from "next";
import AnimatedTimeline from "@/components/timeline/AnimatedTimeline";

export const metadata: Metadata = {
  title: "Timeline | Life Atlas",
  description: "A chronological archive of moments and journeys.",
};

export default async function TimelinePage() {
  const timelineData = await getTimelineEvents();

  return (
    <main className="min-h-screen bg-background pt-32 pb-32">
      <div className="max-w-5xl mx-auto px-6 md:px-12">
        <header className="mb-24">
          <h1 className="font-display text-5xl md:text-7xl tracking-tighter mb-6 text-foreground">Timeline.</h1>
          <p className="font-sans text-muted-foreground text-lg md:text-xl font-light tracking-wide max-w-xl">
            A chronological archive of places, experiences, and moments that shaped the journey.
          </p>
        </header>

        <AnimatedTimeline timelineData={timelineData} />
      </div>
    </main>
  );
}
