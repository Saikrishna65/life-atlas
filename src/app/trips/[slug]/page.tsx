import { expeditions } from "@/data/demo/expeditions";
import TripDetailExperience from "@/components/trips/TripDetailExperience";
import { demoTripDetail, publicTripDetail } from "@/lib/public-trips/detail";
import { notFound } from "next/navigation";
import { getTripBySlug, getNextTrip } from "@/lib/queries/trips";
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
  if (!trip && demo) return <TripDetailExperience key={demo.id} trip={demoTripDetail(demo)} />;
  if (!trip) notFound();
  const next = await getNextTrip(trip.startDate, trip.id).catch(() => null);
  return <TripDetailExperience key={trip.id} trip={publicTripDetail(trip, next)} />;
}
