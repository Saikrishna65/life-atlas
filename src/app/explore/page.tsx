import type { Metadata } from "next";
import PublicPage from "@/components/world/PublicPage";
import AtlasDirectory from "@/components/world/AtlasDirectory";
export const metadata: Metadata = {
  title: "Every direction, a possibility.",
  description: "Follow a place, a feeling, or a road you haven’t taken.",
};
export default function Page() {
  return (
    <PublicPage
      title={"Every direction, a possibility."}
      kicker={"Follow a place, a feeling, or a road you haven’t taken."}
    >
      <AtlasDirectory />
    </PublicPage>
  );
}
