import type { Metadata } from "next";
import TripFilmHero from "@/components/home/TripFilmHero";
import { getLatestHeroTrips } from "@/lib/queries/hero-trips";
import { NativeAppRedirect } from "@/components/native/NativeAppRedirect";
import LivingWorld from "@/components/world/LivingWorld";
export const metadata: Metadata = {
  title: "Life Atlas — The Living World",
  description:
    "A cinematic journey through places, moments, and possibility. Reality meets imagination in the Living World.",
};
export default async function Home() {
  const trips = await getLatestHeroTrips();
  return (
    <>
      <NativeAppRedirect />
      <div className="bg-background text-foreground min-h-screen">
        <TripFilmHero trips={trips} />
        <LivingWorld />
      </div>
    </>
  );
}
