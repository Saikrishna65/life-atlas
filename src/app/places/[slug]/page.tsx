import { notFound } from "next/navigation";
import { getPlaceBySlug } from "@/lib/queries/places";
import PlaceHero from "@/components/places/PlaceHero";
import PlaceOverview from "@/components/places/PlaceOverview";
import PlaceTrips from "@/components/places/PlaceTrips";
import TripExperiences from "@/components/trips/TripExperiences";
import TripGallery from "@/components/trips/TripGallery";
import { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const place = await getPlaceBySlug(slug);
  
  if (!place) {
    return { title: "Place Not Found | Life Atlas" };
  }
  
  return {
    title: `${place.name} | Life Atlas`,
    description: place.description || `Memories from ${place.name}, ${place.country}`,
    openGraph: {
      title: `${place.name} | Life Atlas`,
      description: place.description || `Memories from ${place.name}, ${place.country}`,
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
  const place = await getPlaceBySlug(slug);

  if (!place) {
    notFound();
  }

  return (
    <main className="bg-background text-foreground min-h-screen pb-24">
      <PlaceHero place={place} />
      <PlaceOverview place={place} />
      
      {/* Route map placeholder */}
      <section className="py-24 px-6 max-w-7xl mx-auto border-t border-muted">
        <div className="aspect-[21/9] bg-surface border border-muted flex items-center justify-center rounded-sm">
          <span className="font-sans text-xs uppercase tracking-widest text-muted-foreground/80">Location Map (Coming Soon)</span>
        </div>
      </section>

      <PlaceTrips tripPlaces={place.tripPlaces} />
      
      <TripExperiences experiences={place.experiences} />
      
      <TripGallery photos={place.photos} />
    </main>
  );
}
