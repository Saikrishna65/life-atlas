import { expeditions } from "@/data/demo/expeditions";
import PublicPage from "@/components/world/PublicPage";
import ExpeditionDetail from "@/components/world/ExpeditionDetail";
import { notFound } from "next/navigation";
import { getTripBySlug, getNextTrip } from "@/lib/queries/trips";
import TripOverview from "@/components/trips/TripOverview";
import PublicTripRouteMap from "@/components/trips/PublicTripRouteMap";
import TripDays from "@/components/trips/TripDays";
import TripExperiences from "@/components/trips/TripExperiences";
import TripGallery from "@/components/trips/TripGallery";
import NextJourney from "@/components/trips/NextJourney";
import { Metadata } from "next";

export async function generateStaticParams() {
  // Existing database journeys still resolve dynamically; demo builds need no database.
  return expeditions.map((e) => ({ slug: e.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const demo = expeditions.find((e) => e.slug === slug);
  if (demo) return { title: demo.name, description: demo.overview };
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
  const demo = expeditions.find((e) => e.slug === slug);
  if (demo)
    return (
      <PublicPage
        title={demo.name}
        kicker="An imagined journey. A real sense of possibility."
      >
        <div className="public-detail-wrap">
          <ExpeditionDetail expedition={demo} />
        </div>
      </PublicPage>
    );
  const trip = await getTripBySlug(slug);

  if (!trip) {
    notFound();
  }

  const nextTrip = await getNextTrip(trip.startDate, trip.id);

  return (
    <PublicPage
      title={trip.title}
      kicker={trip.description || `A journey through ${trip.destination}.`}
    >
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
    </PublicPage>
  );
}
