import { notFound } from "next/navigation";
import { getTripBySlug, getNextTrip } from "@/lib/queries/trips";
import TripHero from "@/components/trips/TripHero";
import TripOverview from "@/components/trips/TripOverview";
import TripDays from "@/components/trips/TripDays";
import TripExperiences from "@/components/trips/TripExperiences";
import TripJournals from "@/components/trips/TripJournals";
import TripGallery from "@/components/trips/TripGallery";
import NextJourney from "@/components/trips/NextJourney";
import { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const trip = await getTripBySlug(slug);
  
  if (!trip) {
    return { title: "Trip Not Found | Life Atlas" };
  }
  
  return {
    title: `${trip.title} | Life Atlas`,
    description: trip.description || `Journey to ${trip.destination}`,
    openGraph: {
      title: `${trip.title} | Life Atlas`,
      description: trip.description || `Journey to ${trip.destination}`,
      images: trip.coverImage ? [trip.coverImage] : undefined,
    },
  };
}

export default async function TripDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const trip = await getTripBySlug(slug);

  if (!trip) {
    notFound();
  }

  const nextTrip = await getNextTrip(trip.startDate, trip.id);

  return (
    <main className="bg-background text-foreground min-h-screen pb-24">
      <TripHero trip={trip} />
      <TripOverview trip={trip} photoCount={trip.photos.length} />
      
      {/* Route map placeholder */}
      <section className="py-24 px-6 max-w-7xl mx-auto border-t border-white/10">
        <div className="aspect-[21/9] bg-white/5 border border-white/10 flex items-center justify-center rounded-sm">
          <span className="font-sans text-xs uppercase tracking-widest text-white/40">Route Map Visualizer (Coming Soon)</span>
        </div>
      </section>

      <TripDays days={trip.tripDays} />
      
      <TripExperiences experiences={trip.experiences} />
      
      <TripJournals journals={trip.journalEntries} />
      
      <TripGallery photos={trip.photos} />
      
      {nextTrip && <NextJourney trip={nextTrip} />}
    </main>
  );
}
