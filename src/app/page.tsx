import Hero from "@/components/home/Hero";
import GlobePlaceholder from "@/components/home/GlobePlaceholder";
import FeaturedTrips from "@/components/home/FeaturedTrips";
import LifeStatistics from "@/components/home/LifeStatistics";
import TimelinePreview from "@/components/home/TimelinePreview";
import PhotographyStory from "@/components/home/PhotographyStory";
import LifeBeyondTravel from "@/components/home/LifeBeyondTravel";
import Link from "next/link";
import { getHomepageData } from "@/lib/queries/home";

export default async function Home() {
  const { stats, featuredTrips, timelinePreview, photos, experiences } = await getHomepageData();

  return (
    <main className="bg-background text-foreground min-h-screen">
      <Hero />
      <GlobePlaceholder />
      
      <FeaturedTrips trips={featuredTrips} />
      <LifeStatistics stats={stats} />
      <TimelinePreview events={timelinePreview} />
      <PhotographyStory photos={photos} />
      <LifeBeyondTravel experiences={experiences} />

      {/* Final CTA */}
      <section className="py-32 px-6 text-center border-t border-white/10">
        <h2 className="font-display text-4xl md:text-5xl text-white mb-6">
          Keep moving.<br/>Keep remembering.
        </h2>
        <Link href="/explore" className="inline-block mt-4 font-sans text-sm uppercase tracking-widest text-white/50 hover:text-white transition-colors">
          Explore the atlas &rarr;
        </Link>
      </section>
    </main>
  );
}
