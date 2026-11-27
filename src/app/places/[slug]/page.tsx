import PublicPage from "@/components/world/PublicPage";
import { notFound } from "next/navigation";
import { getPlaceBySlug, getAllPlaceSlugs } from "@/lib/queries/places";
import PlaceOverview from "@/components/places/PlaceOverview";
import PlaceTrips from "@/components/places/PlaceTrips";
import TripExperiences from "@/components/trips/TripExperiences";
import PublishedGallery from "@/components/world/PublishedGallery";
import {placeGalleryFrames} from "@/lib/public-trips/place-gallery";
import { Metadata } from "next";
import Link from "next/link";

export async function generateStaticParams() {
  return getAllPlaceSlugs();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const place = await getPlaceBySlug(slug).catch(()=>null);

  if (!place) {
    return { title: "Place Not Found | Atlas" };
  }

  return {
    title: `${place.name} | Atlas`,
    description:
      place.description || `Memories from ${place.name}, ${place.country}`,
    openGraph: {
      title: `${place.name} | Atlas`,
      description:
        place.description || `Memories from ${place.name}, ${place.country}`,
      images: place.coverImage ? [place.coverImage] : undefined,
    },
  };
}

export default async function PlaceDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const place = await getPlaceBySlug(slug).catch(()=>null);

  if (!place) {
    notFound();
  }

  return (
    <PublicPage
      title={place.name}
      kicker={place.description || `A place in ${place.country}.`}
    >
      <PlaceOverview place={place} />

      <section className="public-coordinate-note">
        <span className="world-eyebrow">A point in the atlas</span>
        <h2>
          {place.name}, {place.country}
        </h2>
        {place.latitude !== null && place.longitude !== null && (
          <p>
            Stored map coordinate: {place.latitude}°, {place.longitude}°
          </p>
        )}
        <Link href="/map" className="world-link">
          Explore the public observatory ↗
        </Link>
      </section>

      <PlaceTrips tripPlaces={place.tripPlaces} />

      <TripExperiences experiences={place.experiences} />

      <PublishedGallery includeCatalog={false} frames={placeGalleryFrames(place.name,place.photos,place.tripPlaces)} />
    </PublicPage>
  );
}
