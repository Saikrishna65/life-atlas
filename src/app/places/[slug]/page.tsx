import { destinations } from "@/data/demo/expeditions";
import PublicPage from "@/components/world/PublicPage";
import PlaceDetail from "@/components/world/PlaceDetail";
import { notFound } from "next/navigation";
import { getPlaceBySlug } from "@/lib/queries/places";
import PlaceOverview from "@/components/places/PlaceOverview";
import PlaceTrips from "@/components/places/PlaceTrips";
import TripExperiences from "@/components/trips/TripExperiences";
import TripGallery from "@/components/trips/TripGallery";
import { Metadata } from "next";
import Link from "next/link";

export async function generateStaticParams() {
  return destinations.map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const demo = destinations.find((d) => d.slug === slug);
  if (demo) return { title: demo.name, description: demo.description };
  const place = await getPlaceBySlug(slug);

  if (!place) {
    return { title: "Place Not Found | Life Atlas" };
  }

  return {
    title: `${place.name} | Life Atlas`,
    description:
      place.description || `Memories from ${place.name}, ${place.country}`,
    openGraph: {
      title: `${place.name} | Life Atlas`,
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
  const demo = destinations.find((d) => d.slug === slug);
  if (demo)
    return (
      <PublicPage
        title={demo.name}
        kicker={`${demo.region} / ${demo.country} — A destination study.`}
      >
        <PlaceDetail place={demo} />
      </PublicPage>
    );
  const place = await getPlaceBySlug(slug);

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

      <TripGallery photos={place.photos} />
    </PublicPage>
  );
}
