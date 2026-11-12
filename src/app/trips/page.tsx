import type { Metadata } from "next";
import PublicPage from "@/components/world/PublicPage";
import Expeditions from "@/components/world/Expeditions";
export const metadata: Metadata = {
  title: "Take the long way.",
  description:
    "Twenty-four imagined journeys. Countless ways to make them your own.",
};
export default function Page() {
  return (
    <PublicPage
      title={"Take the long way."}
      kicker={
        "Twenty-four imagined journeys. Countless ways to make them your own."
      }
    >
      <Expeditions />
    </PublicPage>
  );
}
