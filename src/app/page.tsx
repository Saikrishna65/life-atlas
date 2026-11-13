import type { Metadata } from "next";
import TripFilmHero from "@/components/home/TripFilmHero";
import { getLatestHeroTrips, getHeroGalleryPhotos } from "@/lib/queries/hero-trips";
import { NativeAppRedirect } from "@/components/native/NativeAppRedirect";
import LivingWorld from "@/components/world/LivingWorld";
export const metadata: Metadata = {
  title: "Life Atlas — The Living World",
  description:
    "A cinematic journey through places, moments, and possibility. Reality meets imagination in the Living World.",
};
export const revalidate = 300;

export default async function Home() {
  const [trips, galleryPhotos] = await Promise.all([getLatestHeroTrips(), getHeroGalleryPhotos()]);
  return (
    <>
      <NativeAppRedirect />
      <div className="bg-background text-foreground min-h-screen">
        <TripFilmHero trips={trips} galleryPhotos={galleryPhotos} />
        <LivingWorld />
      </div>
    </>
  );
}
