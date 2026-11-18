export const revalidate=300;
import type { Metadata } from "next";
import PublicPage from "@/components/world/PublicPage";
import TripArchive from "@/components/world/TripArchive";
import {getTripArchive} from "@/lib/queries/trip-archive";
export const metadata: Metadata = {
  title: "Take the long way.",
  description:
    "The journeys I have chosen to share.",
};
export default async function Page() {
  const trips=await getTripArchive();
  return (
    <PublicPage
      title={"Take the long way."}
      kicker={
        "The journeys I have chosen to share."
      }
    >
      <TripArchive trips={trips} />
    </PublicPage>
  );
}
