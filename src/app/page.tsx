import Hero from "@/components/home/Hero";
import FeaturedTrips from "@/components/home/FeaturedTrips";
import LifeStatistics from "@/components/home/LifeStatistics";
import TimelinePreview from "@/components/home/TimelinePreview";
import PhotographyStory from "@/components/home/PhotographyStory";
import LifeBeyondTravel from "@/components/home/LifeBeyondTravel";
import Link from "next/link";
import { getHomepageData } from "@/lib/queries/home";

import LazyGlobe from "@/components/home/LazyGlobe";

export default async function Home() {
  const { stats, featuredTrips, timelinePreview, photos, experiences, globePlaces } = await getHomepageData();

  return (
    <main className="bg-background text-foreground min-h-screen">
      <Hero />
      <LazyGlobe places={globePlaces} />
      
      <FeaturedTrips trips={featuredTrips} />
      <LifeStatistics stats={stats} />
      <TimelinePreview events={timelinePreview} />
      <PhotographyStory photos={photos} />
      <LifeBeyondTravel experiences={experiences} />

      {/* Final CTA */}
      <section className="py-32 px-6 text-center border-t border-muted/20">
        <h2 className="font-display text-4xl md:text-5xl text-foreground mb-6 italic">
          Keep moving.<br/><span className="text-accent not-italic">Keep remembering.</span>
        </h2>
        <Link href="/explore" className="inline-block mt-4 font-sans text-sm uppercase tracking-widest text-muted-foreground hover:text-accent transition-colors font-semibold">
          Explore the atlas &rarr;
        </Link>
      </section>
    </main>
  );
}
