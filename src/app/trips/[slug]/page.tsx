import {cache} from "react";
import TripDetailExperience from "@/components/trips/TripDetailExperience";
import { publicTripDetail } from "@/lib/public-trips/detail";
import { notFound } from "next/navigation";
import { getTripBySlug, getNextTrip, getAllTripSlugs } from "@/lib/queries/trips";
import { Metadata } from "next";

const readTrip=cache((slug:string)=>getTripBySlug(slug).catch(()=>null));

export async function generateStaticParams() {
  return getAllTripSlugs();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const trip = await readTrip(slug);

  if (!trip) {
    return { title: "Trip Not Found | Atlas" };
  }

  return {
    title: `${trip.title} | Atlas`,
    description: trip.description || `Journey to ${trip.destination}`,
    openGraph: {
      title: `${trip.title} | Atlas`,
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
  const trip = await readTrip(slug);
  if (!trip) notFound();
  const next = await getNextTrip(trip.startDate, trip.id).catch(() => null);
  return <TripDetailExperience key={trip.id} trip={publicTripDetail(trip, next)} />;
}
