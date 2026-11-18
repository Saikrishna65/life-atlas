export const revalidate=300;
import {getTripArchive} from "@/lib/queries/trip-archive";
import {getPublicPlaces} from "@/lib/queries/public-content";
import type { Metadata } from "next";
import PublicPage from "@/components/world/PublicPage";
import AtlasDirectory from "@/components/world/AtlasDirectory";
export const metadata: Metadata = {
  title: "A world of somewhere.",
  description: "The places from my published journeys.",
};
export default async function Page() {
  const [trips,places]=await Promise.all([getTripArchive(),getPublicPlaces()]);
  return (
    <PublicPage
      title={"A world of somewhere."}
      kicker={"The places from my published journeys."}
    >
      <AtlasDirectory trips={trips} places={places} initial="Places" />
    </PublicPage>
  );
}
