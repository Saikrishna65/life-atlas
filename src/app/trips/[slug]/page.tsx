import { notFound } from "next/navigation";
import { getTripBySlug, getNextTrip, getAllTripSlugs } from "@/lib/queries/trips";
import TripHero from "@/components/trips/TripHero";
import TripOverview from "@/components/trips/TripOverview";
import PublicTripRouteMap from "@/components/trips/PublicTripRouteMap";
import TripDays from "@/components/trips/TripDays";
import TripExperiences from "@/components/trips/TripExperiences";
import TripGallery from "@/components/trips/TripGallery";
import NextJourney from "@/components/trips/NextJourney";
import { Metadata } from "next";

export async function generateStaticParams() {
  return await getAllTripSlugs();
}

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
      
      {/* Interactive Expedition Route Map */}
      <PublicTripRouteMap
        tripTitle={trip.title}
        destination={trip.destination}
        totalDistanceKm={trip.totalDistanceKm}
        elevationGainMeters={trip.elevationGainMeters}
        maxElevationMeters={trip.maxElevationMeters}
        routeData={trip.routeData}
        tripPlaces={trip.tripPlaces}
      />

      <TripDays days={trip.tripDays} />
      
      <TripExperiences experiences={trip.experiences} />
      
      <TripGallery photos={trip.photos} />
      
      {nextTrip && <NextJourney trip={nextTrip} />}
    </main>
  );
}
