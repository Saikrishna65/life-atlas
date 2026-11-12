import type { Metadata } from "next";
import PublicPage from "@/components/world/PublicPage";
import AtlasDirectory from "@/components/world/AtlasDirectory";
export const metadata: Metadata = {
  title: "What moves you?",
  description:
    "A little adventure. A new perspective. A different way to be here.",
};
export default function Page() {
  return (
    <PublicPage
      title={"What moves you?"}
      kicker={
        "A little adventure. A new perspective. A different way to be here."
      }
    >
      <AtlasDirectory />
    </PublicPage>
  );
}
