import type { Metadata } from "next";
import PublicPage from "@/components/world/PublicPage";
import PublicTimeline from "@/components/world/PublicTimeline";
export const metadata: Metadata = {
  title: "The days become the story.",
  description:
    "A chronological collection of imagined journeys and small discoveries.",
};
export default function Page() {
  return (
    <PublicPage
      title={"The days become the story."}
      kicker={
        "A chronological collection of imagined journeys and small discoveries."
      }
    >
      <PublicTimeline />
    </PublicPage>
  );
}
