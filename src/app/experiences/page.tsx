export const revalidate=300;
import {getTripArchive} from "@/lib/queries/trip-archive";
import {getPublicPlaces} from "@/lib/queries/public-content";
import type { Metadata } from "next";
import PublicPage from "@/components/world/PublicPage";
import AtlasDirectory from "@/components/world/AtlasDirectory";
export const metadata: Metadata = {
  title: "What moves you?",
  description:
    "A little adventure. A new perspective. A different way to be here.",
};
export default async function Page() {
  const [trips,places]=await Promise.all([getTripArchive(),getPublicPlaces()]);
  return (
    <PublicPage
      title={"What moves you?"}
      kicker={
        "A little adventure. A new perspective. A different way to be here."
      }
    >
      <AtlasDirectory trips={trips} places={places} />
    </PublicPage>
  );
}
