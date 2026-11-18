export const revalidate=300;
import {getTripArchive} from "@/lib/queries/trip-archive";
import {getPublicPlaces} from "@/lib/queries/public-content";
import type { Metadata } from "next";
import PublicPage from "@/components/world/PublicPage";
import AtlasDirectory from "@/components/world/AtlasDirectory";
export const metadata: Metadata = {
  title: "Every direction, a possibility.",
  description: "Follow a place, a feeling, or a road you haven’t taken.",
};
export default async function Page() {
  const [trips,places]=await Promise.all([getTripArchive(),getPublicPlaces()]);
  return (
    <PublicPage
      title={"Every direction, a possibility."}
      kicker={"Follow a place, a feeling, or a road you haven’t taken."}
    >
      <AtlasDirectory trips={trips} places={places} />
    </PublicPage>
  );
}
