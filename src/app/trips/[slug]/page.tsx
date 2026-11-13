import { expeditions } from "@/data/demo/expeditions";
import JourneyStory, { JourneyFrame } from "@/components/world/JourneyStory";
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
  const trip = await getTripBySlug(slug).catch(() => null);
  const demo = expeditions.find((e) => e.slug === slug);
  if (!trip && demo) return { title: demo.name, description: demo.overview };

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
  const trip = await getTripBySlug(slug).catch(() => null);
  const demo = expeditions.find((e) => e.slug === slug);
  if (!trip && demo) return <JourneyStory expedition={demo} />;

  if (!trip) {
    notFound();
  }

  const nextTrip = await getNextTrip(trip.startDate, trip.id);

  return (
    <JourneyFrame
      title={trip.title}
      image={trip.coverImage || "/images/world/mountains.webp"}
      intro={trip.description || `A journey through ${trip.destination}.`}
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

      <TripGallery
        collection={{ slug: trip.slug, title: trip.title }}
        photos={trip.photos}
      />

      {nextTrip && <NextJourney trip={nextTrip} />}
    </JourneyFrame>
  );
}
