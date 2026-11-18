export const revalidate=300;
import {getTripArchive} from "@/lib/queries/trip-archive";
import {getPublicPlaces} from "@/lib/queries/public-content";
import type { Metadata } from "next";
import PublicPage from "@/components/world/PublicPage";
import AtlasDirectory from "@/components/world/AtlasDirectory";
export const metadata: Metadata = {
  title: "Find your somewhere",
  description: "Search my published journeys and places.",
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const [trips,places]=await Promise.all([getTripArchive(),getPublicPlaces()]);
  return (
    <PublicPage
      title="Follow your curiosity."
      kicker="A place, a road, or the beginning of a story."
    >
      <AtlasDirectory trips={trips} places={places} initialQuery={q ?? ""} />
    </PublicPage>
  );
}
